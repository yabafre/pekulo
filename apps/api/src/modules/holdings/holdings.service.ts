// Business logic for the holdings domain.
//
// Translation rules:
//   - create: probe findAccountForUser → throw AccountError("ACCOUNT_NOT_FOUND")
//     on missing/cross-user.
//   - close: returns { ok: true } whether the repository reports 'closed' or
//     'already-closed' (idempotent close — no error on second call). On
//     'not-found', throw HoldingError("HOLDING_NOT_FOUND").
//   - recordLot: delegate to repository.recordLot (probe + insert in a single
//     transaction); translate { outcome: "not-found" } → HoldingError(HOLDING_NOT_FOUND)
//     and { outcome: "closed" } → HoldingError(HOLDING_CLOSED).
//   - getDerived: probe findByIdForUser → throw HoldingError("HOLDING_NOT_FOUND")
//     on missing/cross-user, fetch lots, run deriveFromLots; zero-lot falls
//     back to manual row data (source: "manual"), otherwise source: "lots".
//   - list: delegate with includeClosed flag.
//
// Story 3-2 additions:
//   - resolveQuote: 4-tier price orchestrator (prices-service → yahoo →
//     boursorama → twelve-data) with 60 s in-memory cache. Boursorama tier is
//     short-circuited for kind="crypto".
//   - Explicit child spans `prices.tier_<n>` via trace.getTracer (lesson L56:
//     @elysiajs/opentelemetry rootSpan hooks broken under Elysia 1.4.4 + Bun).

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type {
  CloseHoldingInput,
  CloseHoldingOutput,
  CreateHoldingInput,
  DerivedHolding,
  GetDerivedHoldingInput,
  Holding,
  HoldingLot,
  ListHoldingsInput,
  PriceProvider,
  PriceProviderAttempt,
  PriceQuote,
  PriceQuoteInput,
  RecordLotInput,
} from "@pekulo/validators";
import { deriveFromLots } from "../../common/derive/holding-quantity";
import { accountNotFound } from "../accounts/accounts.errors";
import type { PricesCache } from "./holdings.cache";
import { holdingClosed, holdingNotFound, PriceProviderError } from "./holdings.errors";
import type { HoldingRepository } from "./holdings.repository";
import { BoursoramaError, type BoursoramaScraper } from "./services/boursorama-scraper";
import { PricesServiceError, type PricesClient } from "./services/prices-client";
import { TwelveDataError, type TwelveDataClient } from "./services/twelve-data-client";
import { resolveYahooSymbol, YahooError, type YahooClient } from "./services/yahoo-client";

const TRACER_NAME = "pekulo-api-holdings";

export interface HoldingService {
  create(userId: string, input: CreateHoldingInput): Promise<Holding>;
  recordLot(userId: string, input: RecordLotInput): Promise<HoldingLot>;
  close(userId: string, input: CloseHoldingInput): Promise<CloseHoldingOutput>;
  list(userId: string, input: ListHoldingsInput): Promise<Holding[]>;
  getDerived(userId: string, input: GetDerivedHoldingInput): Promise<DerivedHolding>;
  /** Story 3-2: 4-tier price orchestrator, service-internal (no oRPC surface). */
  resolveQuote(input: PriceQuoteInput): Promise<PriceQuote>;
}

export interface HoldingServiceDeps {
  repository: HoldingRepository;
  /** Story 3-2 — price chain deps. All required at construction time. */
  pricesClient: PricesClient;
  yahooClient: YahooClient;
  boursoramaScraper: BoursoramaScraper;
  twelveDataClient: TwelveDataClient;
  pricesCache: PricesCache;
}

// Short French reason labels — mirror brownfield shortPs / shortYahoo /
// shortBourso / shortTd so AC-3 sees identical attempts entries.
//
// SSOT cross-refs (drift guard — when the brownfield is deleted in story 3-3,
// promote this block to the canonical source):
//   - shortPs    ← apps/web/src/lib/services/prices.ts:123
//   - shortYahoo ← apps/web/src/lib/services/prices.ts:140
//   - shortBourso← apps/web/src/lib/services/prices.ts:157
//   - shortTd    ← apps/web/src/lib/services/prices.ts:172
function shortPs(code: PricesServiceError["code"]): string {
  switch (code) {
    case "not-configured":
      return "non configuré";
    case "network":
      return "réseau";
    case "format":
      return "format";
    case "auth":
      return "auth";
    case "invalid-symbol":
      return "ticker invalide";
    case "no-price":
      return "aucun prix";
  }
}
function shortYahoo(code: YahooError["code"]): string {
  switch (code) {
    case "rate-limited":
      return "rate-limited";
    case "network":
      return "réseau";
    case "format":
      return "format inattendu";
    case "no-price":
      return "aucun prix";
    case "invalid-ticker":
      return "ticker invalide";
    case "missing-ticker":
      return "ticker manquant";
  }
}
function shortBourso(code: BoursoramaError["code"]): string {
  switch (code) {
    case "missing-ticker":
      return "ticker manquant";
    case "invalid-symbol":
      return "ticker non listé";
    case "network":
      return "réseau";
    case "format":
      return "format inattendu";
    case "no-price":
      return "aucun prix";
  }
}
function shortTd(code: TwelveDataError["code"]): string {
  switch (code) {
    case "missing-key":
      return "clé manquante";
    case "rate-limited":
      return "rate-limited";
    case "invalid-symbol":
      return "free tier sans EU";
    case "network":
      return "réseau";
    case "format":
      return "format";
    case "no-price":
      return "aucun prix";
  }
}

export function createHoldingsService(deps: HoldingServiceDeps): HoldingService {
  return {
    async create(userId, input) {
      const account = await deps.repository.findAccountForUser(userId, input.accountId);
      if (!account) throw accountNotFound();
      return deps.repository.create(userId, input);
    },

    async recordLot(userId, input) {
      const out = await deps.repository.recordLot(userId, input);
      if (out.outcome === "not-found") throw holdingNotFound();
      if (out.outcome === "closed") throw holdingClosed();
      return out.lot;
    },

    async close(userId, input) {
      const out = await deps.repository.close(userId, input.id);
      if (out.outcome === "not-found") throw holdingNotFound();
      return { ok: true } as const;
    },

    async list(userId, input) {
      return deps.repository.listByUser(userId, { includeClosed: input.includeClosed });
    },

    async getDerived(userId, input) {
      const parent = await deps.repository.findByIdForUser(userId, input.id);
      if (!parent) throw holdingNotFound();
      const lots = await deps.repository.findLotsByHoldingForUser(userId, input.id);
      const derived = deriveFromLots(lots);
      if (lots.length === 0) {
        return {
          holdingId: parent.id,
          quantity: parent.quantity,
          avgCost: parent.avgCost,
          source: "manual",
        } as const;
      }
      return {
        holdingId: parent.id,
        quantity: derived.quantity,
        avgCost: derived.avgCost,
        source: "lots",
      } as const;
    },

    async resolveQuote(input) {
      const tracer = trace.getTracer(TRACER_NAME);
      return tracer.startActiveSpan("prices.resolveQuote", async (parentSpan) => {
        try {
          const cached = deps.pricesCache.get(input);
          if (cached) {
            parentSpan.setAttribute("prices.cache_hit", true);
            return cached;
          }
          parentSpan.setAttribute("prices.cache_hit", false);

          const attempts: PriceProviderAttempt[] = [];

          let yahooSymbol: string;
          try {
            yahooSymbol = resolveYahooSymbol(input.ticker, input.currency);
          } catch (err) {
            if (err instanceof YahooError) {
              attempts.push({ provider: "yahoo", reason: shortYahoo(err.code) });
              throw new PriceProviderError(attempts);
            }
            throw err;
          }

          const stamp = (
            quote: { symbol: string; price: number; currency: string; marketTime: string },
            provider: PriceProvider,
          ): PriceQuote => ({ ...quote, provider });

          // Tier 1 — prices-service (SKIPPED when not configured, per
          // brownfield isPricesServiceConfigured() behaviour).
          if (deps.pricesClient.isConfigured) {
            const tier1 = await runTier(tracer, 1, "prices-service", input, async () =>
              deps.pricesClient.fetchQuote(yahooSymbol),
            );
            if (tier1.ok) {
              const quote = stamp(tier1.quote, "prices-service");
              deps.pricesCache.set(input, quote);
              return quote;
            }
            attempts.push({
              provider: "prices-service",
              reason:
                tier1.err instanceof PricesServiceError ? shortPs(tier1.err.code) : "exception",
            });
          }

          // Tier 2 — yahoo-finance2
          const tier2 = await runTier(tracer, 2, "yahoo", input, async () =>
            deps.yahooClient.fetchQuote(yahooSymbol),
          );
          if (tier2.ok) {
            const quote = stamp(tier2.quote, "yahoo");
            deps.pricesCache.set(input, quote);
            return quote;
          }
          attempts.push({
            provider: "yahoo",
            reason: tier2.err instanceof YahooError ? shortYahoo(tier2.err.code) : "exception",
          });

          // Tier 3 — Boursorama (SKIPPED for crypto)
          if (input.kind !== "crypto") {
            const tier3 = await runTier(tracer, 3, "boursorama", input, async () =>
              deps.boursoramaScraper.fetchQuote(input.ticker),
            );
            if (tier3.ok) {
              const quote = stamp(tier3.quote, "boursorama");
              deps.pricesCache.set(input, quote);
              return quote;
            }
            attempts.push({
              provider: "boursorama",
              reason:
                tier3.err instanceof BoursoramaError ? shortBourso(tier3.err.code) : "exception",
            });
          }

          // Tier 4 — Twelve Data
          const tier4 = await runTier(tracer, 4, "twelve-data", input, async () =>
            deps.twelveDataClient.fetchQuote(yahooSymbol),
          );
          if (tier4.ok) {
            const quote = stamp(tier4.quote, "twelve-data");
            deps.pricesCache.set(input, quote);
            return quote;
          }
          attempts.push({
            provider: "twelve-data",
            reason: tier4.err instanceof TwelveDataError ? shortTd(tier4.err.code) : "exception",
          });

          throw new PriceProviderError(attempts);
        } catch (err) {
          parentSpan.recordException(err as Error);
          parentSpan.setStatus({ code: SpanStatusCode.ERROR });
          throw err;
        } finally {
          parentSpan.end();
        }
      });
    },
  };
}

// ─── tier-runner helper ──────────────────────────────────────────────────
// Wraps a single tier call in a child span with the canonical attribute set.
// Returns a tagged union so the orchestrator can stay flat (no nested try).

type TierResult =
  | { ok: true; quote: { symbol: string; price: number; currency: string; marketTime: string } }
  | { ok: false; err: unknown };

async function runTier(
  tracer: ReturnType<typeof trace.getTracer>,
  tier: 1 | 2 | 3 | 4,
  provider: PriceProvider,
  input: PriceQuoteInput,
  call: () => Promise<{ symbol: string; price: number; currency: string; marketTime: string }>,
): Promise<TierResult> {
  return tracer.startActiveSpan(`prices.tier_${tier}`, async (span): Promise<TierResult> => {
    span.setAttribute("prices.provider", provider);
    span.setAttribute("prices.ticker", input.ticker ?? "");
    span.setAttribute("prices.currency", input.currency);
    span.setAttribute("prices.kind", input.kind);
    const t0 = performance.now();
    try {
      const quote = await call();
      span.setAttribute("prices.outcome", "ok");
      span.setAttribute("prices.duration_ms", Math.round(performance.now() - t0));
      span.setStatus({ code: SpanStatusCode.OK });
      return { ok: true, quote };
    } catch (err) {
      span.setAttribute("prices.outcome", "error");
      span.setAttribute("prices.duration_ms", Math.round(performance.now() - t0));
      span.recordException(err as Error);
      return { ok: false, err };
    } finally {
      span.end();
    }
  });
}
