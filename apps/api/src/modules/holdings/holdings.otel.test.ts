// AC-7 enforcement — captures real OTel spans emitted by resolveQuote via
// InMemorySpanExporter and asserts the parent `prices.resolveQuote` span +
// per-tier `prices.tier_<n>` child spans carry the 5 canonical attributes
// (`prices.provider`, `prices.ticker`, `prices.currency`, `prices.kind`,
// `prices.outcome`, `prices.duration_ms`). Crypto short-circuit MUST NOT
// emit `prices.tier_3`.
//
// Lives in its own file because the NodeTracerProvider + global registration
// dance is heavier than the rest of holdings.service.test.ts and must be torn
// down between tests (otherwise NodeTracerProvider.register() throws on the
// second test). Pattern lifted from src/platform/observability/otel-sdk.test.ts.

import { afterEach, describe, expect, test } from "bun:test";
import { context, propagation, trace } from "@opentelemetry/api";
import { BatchSpanProcessor, InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import {
  fakeBoursoramaScraper,
  fakePricesClient,
  fakeTwelveDataClient,
  fakeYahooClient,
} from "../../common/test/fakes/prices-clients";
import { createPricesCache } from "./holdings.cache";
import { PriceProviderError } from "./holdings.errors";
import type { HoldingRepository } from "./holdings.repository";
import { createHoldingsService } from "./holdings.service";
import { PricesServiceError } from "./services/prices-client";
import { TwelveDataError } from "./services/twelve-data-client";
import { YahooError } from "./services/yahoo-client";

function clearOtelGlobals(): void {
  trace.disable();
  context.disable();
  propagation.disable();
}

function nullRepo(): HoldingRepository {
  // resolveQuote does not touch the repository — return null/empty for every
  // shape so a type-safe stub compiles without faking the full CRUD surface.
  return {
    async create() {
      throw new Error("not used");
    },
    async findByIdForUser() {
      return null;
    },
    async listByUser() {
      return [];
    },
    async close() {
      return { outcome: "not-found" } as const;
    },
    async recordLot() {
      return { outcome: "not-found" } as const;
    },
    async findLotsByHoldingForUser() {
      return [];
    },
    async findAccountForUser() {
      return null;
    },
  };
}

function buildService() {
  const prices = fakePricesClient();
  const yahoo = fakeYahooClient();
  const boursorama = fakeBoursoramaScraper();
  const twelveData = fakeTwelveDataClient();
  const cache = createPricesCache({ ttlMs: 60_000 });
  const service = createHoldingsService({
    repository: nullRepo(),
    pricesClient: prices.client,
    yahooClient: yahoo.client,
    boursoramaScraper: boursorama.client,
    twelveDataClient: twelveData.client,
    pricesCache: cache,
  });
  return { service, prices, yahoo, boursorama, twelveData };
}

describe("AC-7 OTel spans", () => {
  afterEach(() => {
    clearOtelGlobals();
  });

  test("yahoo wins → parent prices.resolveQuote + prices.tier_2 with 5 canonical attributes", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const { service, yahoo } = buildService();
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 482.13,
        currency: "EUR",
        marketTime: "2026-05-17",
      }));

      await service.resolveQuote({ ticker: "CW8", kind: "etf", currency: "EUR" });

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const parent = spans.find((s) => s.name === "prices.resolveQuote");
      const tierSpans = spans.filter((s) => s.name.startsWith("prices.tier_"));

      expect(parent).toBeDefined();
      expect(parent?.attributes["prices.cache_hit"]).toBe(false);

      // Tier-1 skipped (isConfigured=false in default fake); tier-2 must fire,
      // tier-3 / tier-4 skipped because tier-2 wins.
      expect(tierSpans.map((s) => s.name).sort()).toEqual(["prices.tier_2"]);
      const t2 = tierSpans[0]!;
      expect(t2.attributes["prices.provider"]).toBe("yahoo");
      expect(t2.attributes["prices.ticker"]).toBe("CW8");
      expect(t2.attributes["prices.currency"]).toBe("EUR");
      expect(t2.attributes["prices.kind"]).toBe("etf");
      expect(t2.attributes["prices.outcome"]).toBe("ok");
      expect(typeof t2.attributes["prices.duration_ms"]).toBe("number");
    } finally {
      await provider.shutdown();
    }
  });

  test("crypto all-fail → 3 child spans, NO prices.tier_3 (boursorama short-circuit)", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const { service, prices, yahoo, twelveData } = buildService();
      prices.setBehavior(async () => {
        throw new PricesServiceError("network", "x");
      });
      yahoo.setBehavior(async () => {
        throw new YahooError("rate-limited", "x");
      });
      twelveData.setBehavior(async () => {
        throw new TwelveDataError("missing-key", "x");
      });

      let caught: unknown;
      try {
        await service.resolveQuote({ ticker: "BTC-USD", kind: "crypto", currency: "USD" });
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(PriceProviderError);

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const tierSpans = spans.filter((s) => s.name.startsWith("prices.tier_"));
      const tierNames = tierSpans.map((s) => s.name).sort();

      // prices.setBehavior flips isConfigured=true so tier-1 runs.
      // crypto short-circuits boursorama → no prices.tier_3 span.
      expect(tierNames).toEqual(["prices.tier_1", "prices.tier_2", "prices.tier_4"]);

      // Every tier span carries the 5 canonical attributes with kind=crypto.
      for (const span of tierSpans) {
        expect(span.attributes["prices.ticker"]).toBe("BTC-USD");
        expect(span.attributes["prices.currency"]).toBe("USD");
        expect(span.attributes["prices.kind"]).toBe("crypto");
        expect(span.attributes["prices.outcome"]).toBe("error");
        expect(typeof span.attributes["prices.duration_ms"]).toBe("number");
      }
      expect(tierSpans.find((s) => s.name === "prices.tier_1")?.attributes["prices.provider"]).toBe(
        "prices-service",
      );
      expect(tierSpans.find((s) => s.name === "prices.tier_2")?.attributes["prices.provider"]).toBe(
        "yahoo",
      );
      expect(tierSpans.find((s) => s.name === "prices.tier_4")?.attributes["prices.provider"]).toBe(
        "twelve-data",
      );
    } finally {
      await provider.shutdown();
    }
  });

  test("cache hit on second call → parent prices.cache_hit=true and NO child tier spans", async () => {
    const exporter = new InMemorySpanExporter();
    const provider = new NodeTracerProvider({
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });
    provider.register();
    try {
      const { service, yahoo } = buildService();
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 192.55,
        currency: "USD",
        marketTime: "2026-05-17",
      }));
      const input = { ticker: "AAPL", kind: "action" as const, currency: "USD" as const };

      await service.resolveQuote(input); // populate cache
      await provider.forceFlush(); // drain first-call spans into exporter
      exporter.reset(); // clear them so only the second call's spans survive
      await service.resolveQuote(input); // cache hit

      await provider.forceFlush();
      const spans = exporter.getFinishedSpans();
      const parent = spans.find((s) => s.name === "prices.resolveQuote");
      const tierSpans = spans.filter((s) => s.name.startsWith("prices.tier_"));

      expect(parent).toBeDefined();
      expect(parent?.attributes["prices.cache_hit"]).toBe(true);
      expect(tierSpans.length).toBe(0);
    } finally {
      await provider.shutdown();
    }
  });
});
