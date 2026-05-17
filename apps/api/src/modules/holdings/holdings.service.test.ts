// Service unit tests (TDD RED → GREEN in T12 / 3-1, T15 / 3-2). Fake
// repository, in-memory.

import { describe, expect, test } from "bun:test";
import type { Holding, HoldingLot } from "@pekulo/validators";
import {
  fakeBoursoramaScraper,
  fakePricesClient,
  fakeTwelveDataClient,
  fakeYahooClient,
} from "../../common/test/fakes/prices-clients";
import { AccountError } from "../accounts/accounts.errors";
import { createPricesCache } from "./holdings.cache";
import { HoldingError, PriceProviderError } from "./holdings.errors";
import type {
  CloseHoldingOutcome,
  HoldingRepository,
  RecordLotOutcome,
} from "./holdings.repository";
import { createHoldingsService, type HoldingServiceDeps } from "./holdings.service";

// Minimal dep wiring for the 3-1 tests (resolveQuote not exercised; defaults
// fine).
function serviceDeps(repo: HoldingRepository): HoldingServiceDeps {
  return {
    repository: repo,
    pricesClient: fakePricesClient().client,
    yahooClient: fakeYahooClient().client,
    boursoramaScraper: fakeBoursoramaScraper().client,
    twelveDataClient: fakeTwelveDataClient().client,
    pricesCache: createPricesCache({ ttlMs: 60_000 }),
  };
}

const userA = "00000000-0000-0000-0000-00000000000a";
const accA = "acc_aaaaaaaaaaaaaaaaaaaaa";

function holding(over: Partial<Holding> = {}): Holding {
  return {
    id: "hld_aaaaaaaaaaaaaaaaaaaaa",
    userId: userA,
    accountId: accA,
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Amundi",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 0,
    lastPriceAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...over,
  };
}

function makeFakeRepo(): HoldingRepository & {
  state: { holdings: Map<string, Holding>; lots: Map<string, HoldingLot[]> };
} {
  const holdings = new Map<string, Holding>();
  const lots = new Map<string, HoldingLot[]>();
  return {
    state: { holdings, lots },
    async create(_userId, input) {
      const id = "hld_" + Math.random().toString(36).slice(2).padStart(21, "x");
      const row: Holding = holding({
        id,
        accountId: input.accountId,
        kind: input.kind,
        ticker: input.ticker ?? null,
        isin: input.isin ?? null,
        label: input.label,
        currency: input.currency,
        quantity: input.quantity,
        avgCost: input.avgCost,
        notes: input.notes ?? null,
      });
      holdings.set(id, row);
      return row;
    },
    async findByIdForUser(_userId, id) {
      const row = holdings.get(id);
      return row && row.userId === _userId ? row : null;
    },
    async listByUser(userId, opts) {
      const all = Array.from(holdings.values()).filter((r) => r.userId === userId);
      return opts.includeClosed ? all : all.filter((r) => r.closedAt === null);
    },
    async close(userId, id): Promise<CloseHoldingOutcome> {
      const row = holdings.get(id);
      if (!row || row.userId !== userId) return { outcome: "not-found" } as const;
      if (row.closedAt !== null) return { outcome: "already-closed" } as const;
      const closedAt = new Date();
      holdings.set(id, { ...row, closedAt });
      return { outcome: "closed", closedAt } as const;
    },
    async recordLot(userId, input): Promise<RecordLotOutcome> {
      const parent = holdings.get(input.holdingId);
      if (!parent || parent.userId !== userId) return { outcome: "not-found" } as const;
      if (parent.closedAt !== null) return { outcome: "closed" } as const;
      const id = "lot_" + Math.random().toString(36).slice(2).padStart(21, "x");
      const row: HoldingLot = {
        id,
        userId,
        holdingId: input.holdingId,
        type: input.type,
        occurredOn: input.occurredOn,
        quantity: input.quantity,
        priceUnit: input.priceUnit,
        fees: input.fees ?? 0,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const arr = lots.get(input.holdingId) ?? [];
      arr.push(row);
      lots.set(input.holdingId, arr);
      return { outcome: "ok", lot: row } as const;
    },
    async findLotsByHoldingForUser(userId, holdingId) {
      const arr = lots.get(holdingId) ?? [];
      return arr.filter((l) => l.userId === userId);
    },
    async findAccountForUser(_userId, accountId) {
      return accountId === accA ? { id: accA } : null;
    },
  };
}

describe("holdings.service", () => {
  test("create: rejects with ACCOUNT_NOT_FOUND when account does not belong to user", async () => {
    const repo = makeFakeRepo();
    const svc = createHoldingsService(serviceDeps(repo));
    await expect(
      svc.create(userA, {
        accountId: "acc_unknown",
        kind: "etf",
        currency: "EUR",
        label: "Test",
        quantity: 1,
        avgCost: 1,
      }),
    ).rejects.toBeInstanceOf(AccountError);
  });

  test("close: idempotent on already-closed (returns { ok: true })", async () => {
    const repo = makeFakeRepo();
    const closedAt = new Date("2026-05-01");
    repo.state.holdings.set("hld_already", holding({ id: "hld_already", closedAt }));
    const svc = createHoldingsService(serviceDeps(repo));
    const out = await svc.close(userA, { id: "hld_already" });
    expect(out).toEqual({ ok: true });
    expect(repo.state.holdings.get("hld_already")!.closedAt).toEqual(closedAt);
  });

  test("close: cross-user → HoldingError(HOLDING_NOT_FOUND)", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set(
      "hld_userB",
      holding({ id: "hld_userB", userId: "00000000-0000-0000-0000-00000000000b" }),
    );
    const svc = createHoldingsService(serviceDeps(repo));
    await expect(svc.close(userA, { id: "hld_userB" })).rejects.toMatchObject({
      name: "HoldingError",
      code: "HOLDING_NOT_FOUND",
    });
  });

  test("recordLot on closed holding → HoldingError(HOLDING_CLOSED)", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_closed", holding({ id: "hld_closed", closedAt: new Date() }));
    const svc = createHoldingsService(serviceDeps(repo));
    await expect(
      svc.recordLot(userA, {
        holdingId: "hld_closed",
        type: "buy",
        occurredOn: new Date("2026-04-01"),
        quantity: 1,
        priceUnit: 100,
        fees: 0,
      }),
    ).rejects.toBeInstanceOf(HoldingError);
  });

  test("getDerived: zero-lot back-compat returns row's quantity + avgCost", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_manual", holding({ id: "hld_manual", quantity: 7, avgCost: 42 }));
    const svc = createHoldingsService(serviceDeps(repo));
    const out = await svc.getDerived(userA, { id: "hld_manual" });
    expect(out).toMatchObject({
      holdingId: "hld_manual",
      quantity: 7,
      avgCost: 42,
      source: "manual",
    });
  });

  test("getDerived: with lots → deriveFromLots result, source 'lots'", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_lots", holding({ id: "hld_lots" }));
    repo.state.lots.set("hld_lots", [
      {
        id: "lot_1",
        userId: userA,
        holdingId: "hld_lots",
        type: "buy",
        occurredOn: new Date("2026-01-01"),
        quantity: 10,
        priceUnit: 100,
        fees: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const svc = createHoldingsService(serviceDeps(repo));
    const out = await svc.getDerived(userA, { id: "hld_lots" });
    expect(out).toMatchObject({
      holdingId: "hld_lots",
      quantity: 10,
      avgCost: 100,
      source: "lots",
    });
  });

  test("list({ includeClosed: false }) excludes closed; includeClosed: true includes them", async () => {
    const repo = makeFakeRepo();
    repo.state.holdings.set("hld_active", holding({ id: "hld_active" }));
    repo.state.holdings.set("hld_closed", holding({ id: "hld_closed", closedAt: new Date() }));
    const svc = createHoldingsService(serviceDeps(repo));
    const activeOnly = await svc.list(userA, { includeClosed: false });
    expect(activeOnly.map((r) => r.id).sort()).toEqual(["hld_active"]);
    const all = await svc.list(userA, { includeClosed: true });
    expect(all.map((r) => r.id).sort()).toEqual(["hld_active", "hld_closed"]);
  });
});

// ─── resolveQuote (story 3-2) ────────────────────────────────────────────
// The service-internal price orchestrator. Tested with fake clients so the
// suite stays offline and deterministic.

function buildService(
  opts: {
    prices?: ReturnType<typeof fakePricesClient>;
    yahoo?: ReturnType<typeof fakeYahooClient>;
    boursorama?: ReturnType<typeof fakeBoursoramaScraper>;
    twelveData?: ReturnType<typeof fakeTwelveDataClient>;
    now?: () => number;
  } = {},
) {
  const prices = opts.prices ?? fakePricesClient();
  const yahoo = opts.yahoo ?? fakeYahooClient();
  const boursorama = opts.boursorama ?? fakeBoursoramaScraper();
  const twelveData = opts.twelveData ?? fakeTwelveDataClient();
  const cache = createPricesCache({ ttlMs: 60_000, now: opts.now });
  const service = createHoldingsService({
    repository: makeFakeRepo(),
    pricesClient: prices.client,
    yahooClient: yahoo.client,
    boursoramaScraper: boursorama.client,
    twelveDataClient: twelveData.client,
    pricesCache: cache,
  });
  return { service, prices, yahoo, boursorama, twelveData };
}

describe("resolveQuote", () => {
  test("AC-1 (sync error): tier-1 returns immediately on PricesServiceError → tier-2 wins", async () => {
    const { service, prices, yahoo } = buildService();
    prices.setBehavior(async () => {
      throw new (await import("./services/prices-client")).PricesServiceError(
        "network",
        "fake: timeout",
      );
    });
    yahoo.setBehavior(async (symbol) => ({
      symbol,
      price: 482.13,
      currency: "EUR",
      marketTime: "2026-05-17",
    }));
    const q = await service.resolveQuote({ ticker: "CW8", kind: "etf", currency: "EUR" });
    expect(q.provider).toBe("yahoo");
    expect(q.symbol).toBe("CW8.PA");
    expect(yahoo.calls).toEqual(["CW8.PA"]);
  });

  test("AC-1 (real timeout): tier-1 hanging fetch is aborted at ~500 ms → tier-2 wins", async () => {
    // Wires the REAL createPricesClient (so AbortSignal.timeout(500) must fire)
    // against a globally-mocked fetch that hangs until abort. This is the
    // rigorous AC-1: proves timeout ENFORCEMENT, not just sync-error fallback.
    const { createPricesClient } = await import("./services/prices-client");
    const realPricesClient = createPricesClient({
      baseUrl: "https://prices.fake.internal:8000",
      token: "tok",
      timeoutMs: 500,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((_url: unknown, init?: { signal?: AbortSignal }) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }) as typeof globalThis.fetch;

    try {
      const yahoo = fakeYahooClient();
      yahoo.setBehavior(async (symbol) => ({
        symbol,
        price: 482.13,
        currency: "EUR",
        marketTime: "2026-05-17",
      }));
      const service = createHoldingsService({
        repository: makeFakeRepo(),
        pricesClient: realPricesClient,
        yahooClient: yahoo.client,
        boursoramaScraper: fakeBoursoramaScraper().client,
        twelveDataClient: fakeTwelveDataClient().client,
        pricesCache: createPricesCache({ ttlMs: 60_000 }),
      });

      const t0 = performance.now();
      const q = await service.resolveQuote({ ticker: "CW8", kind: "etf", currency: "EUR" });
      const elapsed = performance.now() - t0;

      // AbortSignal.timeout(500) MUST fire — elapsed clusters around 500 ms.
      // Allow 50 ms slack on each side for setup + scheduler jitter.
      expect(elapsed).toBeGreaterThanOrEqual(450);
      expect(elapsed).toBeLessThan(800);
      expect(q.provider).toBe("yahoo");
      expect(q.symbol).toBe("CW8.PA");
      expect(yahoo.calls).toEqual(["CW8.PA"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("AC-2: second call within 60 s returns cached quote with zero provider calls", async () => {
    let now = 1_000_000;
    const { service, prices, yahoo, boursorama, twelveData } = buildService({ now: () => now });
    yahoo.setBehavior(async (symbol) => ({
      symbol,
      price: 192.55,
      currency: "USD",
      marketTime: "2026-05-17",
    }));
    const input = { ticker: "AAPL", kind: "action" as const, currency: "USD" as const };
    const q1 = await service.resolveQuote(input);
    expect(yahoo.calls.length).toBe(1);
    now += 59_000;
    const q2 = await service.resolveQuote(input);
    expect(yahoo.calls.length).toBe(1); // no new call
    expect(prices.calls.length + boursorama.calls.length + twelveData.calls.length).toBe(0);
    expect(q2).toBe(q1); // reference equality
    now += 2_000; // crosses 60s
    await service.resolveQuote(input);
    expect(yahoo.calls.length).toBe(2);
  });

  test("AC-3: all four tiers fail → PriceProviderError with 4 attempts in order", async () => {
    const { service, prices, yahoo, boursorama, twelveData } = buildService();
    const { PricesServiceError } = await import("./services/prices-client");
    const { YahooError } = await import("./services/yahoo-client");
    const { BoursoramaError } = await import("./services/boursorama-scraper");
    const { TwelveDataError } = await import("./services/twelve-data-client");
    prices.setBehavior(async () => {
      throw new PricesServiceError("network", "x");
    });
    yahoo.setBehavior(async () => {
      throw new YahooError("rate-limited", "x");
    });
    boursorama.setBehavior(async () => {
      throw new BoursoramaError("invalid-symbol", "x");
    });
    twelveData.setBehavior(async () => {
      throw new TwelveDataError("missing-key", "x");
    });

    let caught: unknown;
    try {
      await service.resolveQuote({ ticker: "ZZZZ", kind: "etf", currency: "EUR" });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(PriceProviderError);
    const ppe = caught as PriceProviderError;
    expect(ppe.attempts).toEqual([
      { provider: "prices-service", reason: "réseau" },
      { provider: "yahoo", reason: "rate-limited" },
      { provider: "boursorama", reason: "ticker non listé" },
      { provider: "twelve-data", reason: "clé manquante" },
    ]);
  });

  test("AC-4: BTC-USD resolves via yahoo; boursorama tier is SKIPPED for crypto", async () => {
    const { service, prices, yahoo, boursorama } = buildService();
    const { PricesServiceError } = await import("./services/prices-client");
    prices.setBehavior(async () => {
      throw new PricesServiceError("not-configured", "x");
    });
    yahoo.setBehavior(async (symbol) => ({
      symbol,
      price: 95000,
      currency: "USD",
      marketTime: "2026-05-17",
    }));
    const q = await service.resolveQuote({ ticker: "BTC-USD", kind: "crypto", currency: "USD" });
    expect(q.provider).toBe("yahoo");
    expect(q.symbol).toBe("BTC-USD"); // dot passthrough — no .PA append
    expect(boursorama.calls.length).toBe(0); // SHORT-CIRCUITED for crypto
  });

  test("AC-4b: BTC-USD all-fail collects only 3 attempts (boursorama skipped)", async () => {
    const { service, prices, yahoo, twelveData } = buildService();
    const { PricesServiceError } = await import("./services/prices-client");
    const { YahooError } = await import("./services/yahoo-client");
    const { TwelveDataError } = await import("./services/twelve-data-client");
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
    const ppe = caught as PriceProviderError;
    expect(ppe.attempts.length).toBe(3);
    expect(ppe.attempts.map((a) => a.provider)).toEqual(["prices-service", "yahoo", "twelve-data"]);
  });
});
