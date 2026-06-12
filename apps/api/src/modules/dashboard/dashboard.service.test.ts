// apps/api/src/modules/dashboard/dashboard.service.test.ts
// AC-1..AC-4 — composition logic with stub ports + hand-computed reference.
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardService, type DashboardPorts } from "./dashboard.service";
import type { Account, DashboardActivity, Holding } from "@pekulo/validators";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-06-04T00:00:00Z");

function acct(over: Partial<Account>): Account {
  return {
    id: "acc_0000000000000000000001",
    userId: USER,
    label: "Compte",
    type: "livret",
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

function hold(over: Partial<Holding>): Holding {
  return {
    id: "hld_0000000000000000000001",
    userId: USER,
    accountId: "acc_0000000000000000000001",
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Holding",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 90,
    lastPriceAt: NOW,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    closedAt: null,
    ...over,
  };
}

// 5 accounts summing to 20 000 € cash; 6 EUR holdings (qty 10) priced live to
// 100 € each → marketValue 6 000 €; property net equity 250 000 €.
// capitalTotal = 20 000 + 6 000 = 26 000 ; totalWealth = 26 000 + 250 000 = 276 000.
function basePorts(over: Partial<DashboardPorts> = {}): DashboardPorts {
  return {
    listAccounts: async () => [
      acct({ id: "acc_1", cashBalance: 10_000 }),
      acct({ id: "acc_2", cashBalance: 5_000 }),
      acct({ id: "acc_3", cashBalance: 2_000 }),
      acct({ id: "acc_4", cashBalance: 3_000 }),
      acct({ id: "acc_5", cashBalance: 0 }),
    ],
    listHoldings: async () =>
      Array.from({ length: 6 }, (_, i) => hold({ id: `hld_${i + 1}`, ticker: `T${i + 1}` })),
    resolveQuote: async ({ ticker }) => ({
      symbol: ticker ?? "T",
      price: 100,
      currency: "EUR",
      marketTime: "2026-06-04",
      provider: "yahoo",
    }),
    getRates: async () => ({
      base: "EUR",
      date: "2026-06-04",
      rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
    }),
    getTotalEquity: async () => ({ totalEquityEur: 250_000 }),
    getCompass: async () => ({ objectif: 800_000 }),
    listRecentActivity: async () => [],
    computeProgress,
    ...over,
  };
}

describe("dashboard.service.getOverview", () => {
  test("AC-1 — total wealth equals the hand-computed reference", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.totalWealthEur).toBe(276_000);
  });

  test("AC-2 — composition sums to total wealth", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.composition).toEqual({
      liquideEur: 20_000,
      placementsEur: 6_000,
      immobilierEur: 250_000,
    });
    const { liquideEur, placementsEur, immobilierEur } = out.composition;
    expect(liquideEur + placementsEur + immobilierEur).toBe(out.totalWealthEur);
  });

  test("AC-3 — compass percent/gap derive from LIVE INVESTABLE wealth (real estate excluded)", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    // investable = capitalTotal = cash 20 000 + marketValue 6 000 = 26 000
    // (immobilier 250 000 EXCLUDED) → 26 000 / 800 000 = 3.25 % → rounded 3.3 %.
    expect(out.compass).toEqual({
      percent: 3.3,
      objectif: 800_000,
      gap: 774_000,
      currentWealth: 26_000,
    });
  });

  test("AC-3 — no compass row → compass:null, no throw", async () => {
    const svc = createDashboardService(basePorts({ getCompass: async () => null }));
    const out = await svc.getOverview(USER);
    expect(out.compass).toBeNull();
    expect(out.totalWealthEur).toBe(276_000);
  });

  test("AC-4 — a rejected resolveQuote falls back to stored lastPrice", async () => {
    // All 6 holdings keep their stored lastPrice (90) → marketValue 6×900 = 5 400.
    const svc = createDashboardService(
      basePorts({
        resolveQuote: async () => {
          throw new Error("all tiers down");
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(out.composition.placementsEur).toBe(5_400);
    expect(out.totalWealthEur).toBe(20_000 + 5_400 + 250_000);
  });

  test("AC-4 — a null-ticker holding is never resolved, keeps stored lastPrice", async () => {
    let calls = 0;
    const svc = createDashboardService(
      basePorts({
        listHoldings: async () => [hold({ id: "hld_x", ticker: null, lastPrice: 42, quantity: 1 })],
        resolveQuote: async ({ ticker }) => {
          calls += 1;
          return {
            symbol: ticker ?? "T",
            price: 100,
            currency: "EUR",
            marketTime: "2026-06-04",
            provider: "yahoo",
          };
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(calls).toBe(0);
    expect(out.composition.placementsEur).toBe(42);
  });

  // --- aped-review regression tests ---

  test("M1 — negative INVESTABLE wealth (overdraft) + compass: never throws, clamps to 0%", async () => {
    // The cap measures investable wealth (capitalTotal), so the clamp must guard
    // a negative INVESTABLE base — an overdrawn account, not underwater real
    // estate (which is excluded entirely). computeProgress rejects a negative
    // currentWealth (INVALID_WEALTH → 400), so getOverview clamps to 0 (NFR-18).
    const svc = createDashboardService(
      basePorts({
        listAccounts: async () => [acct({ id: "acc_od", cashBalance: -50_000 })],
        listHoldings: async () => [],
        getTotalEquity: async () => ({ totalEquityEur: 0 }),
        getCompass: async () => ({ objectif: 800_000 }),
      }),
    );
    const out = await svc.getOverview(USER);
    expect(out.totalWealthEur).toBe(-50_000); // raw value preserved in the payload
    expect(out.compass).toEqual({ percent: 0, objectif: 800_000, gap: 800_000, currentWealth: 0 });
  });

  test("M2 — identical {ticker,kind,currency} holdings resolve ONE quote (dedup)", async () => {
    let calls = 0;
    const svc = createDashboardService(
      basePorts({
        listHoldings: async () => [
          hold({ id: "h1", ticker: "CW8" }),
          hold({ id: "h2", ticker: "CW8" }),
          hold({ id: "h3", ticker: "CW8" }),
        ],
        resolveQuote: async ({ ticker }) => {
          calls += 1;
          return {
            symbol: ticker ?? "T",
            price: 100,
            currency: "EUR",
            marketTime: "2026-06-04",
            provider: "yahoo",
          };
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(calls).toBe(1); // 3 lots of CW8 → a single resolveQuote (no thundering-herd)
    expect(out.composition.placementsEur).toBe(3_000); // 3 × qty 10 × 100
  });

  test("M4 — a getCompass read failure degrades to null (no throw)", async () => {
    const svc = createDashboardService(
      basePorts({
        getCompass: async () => {
          throw new Error("compass read down");
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(out.compass).toBeNull();
    expect(out.totalWealthEur).toBe(276_000);
  });

  // Story 7-2 (D3) — recentActivity composed into the overview (AC-2, AC-7).
  test("recentActivity surfaces the rows from the port, in order", async () => {
    const rows: DashboardActivity[] = [
      {
        label: "Loyer",
        account: "Compte courant",
        category: "loyer",
        direction: "out",
        amountEur: 900,
      },
      {
        label: "Salaire",
        account: "Livret A",
        category: "salaire",
        direction: "in",
        amountEur: 2_500,
      },
      {
        label: "Courses",
        account: "Compte courant",
        category: "courses",
        direction: "out",
        amountEur: 42,
      },
    ];
    const svc = createDashboardService(basePorts({ listRecentActivity: async () => rows }));
    const out = await svc.getOverview(USER);
    expect(out.recentActivity).toEqual(rows);
  });

  test("AC-7 — a failing recentActivity read degrades to [] without breaking wealth", async () => {
    const svc = createDashboardService(
      basePorts({
        listRecentActivity: async () => {
          throw new Error("activity read down");
        },
      }),
    );
    const out = await svc.getOverview(USER);
    expect(out.recentActivity).toEqual([]);
    expect(out.totalWealthEur).toBe(276_000);
  });

  // --- FX provenance: no more silent 1:1 fallback (audit fix) ---
  //
  // A single USD account isolates the FX effect: 1 080 USD converts to 1 000 €
  // at the live rate (USD 1.08), so the source + the converted amount together
  // prove which rate path ran. No EUR holdings → marketValue 0, immobilier 0.
  function usdPorts(over: Partial<DashboardPorts> = {}): DashboardPorts {
    return basePorts({
      listAccounts: async () => [acct({ id: "acc_usd", currency: "USD", cashBalance: 1_080 })],
      listHoldings: async () => [],
      getTotalEquity: async () => ({ totalEquityEur: 0 }),
      getCompass: async () => null,
      ...over,
    });
  }

  test("FX live — a reachable provider stamps source 'live' and applies the rate", async () => {
    const svc = createDashboardService(usdPorts());
    const out = await svc.getOverview(USER);
    expect(out.fx.source).toBe("live");
    expect(out.fx.asOf).toBe("2026-06-04");
    // 1 080 USD / 1.08 = 1 000 € (rate applied, not 1:1).
    expect(out.composition.liquideEur).toBeCloseTo(1_000, 6);
  });

  test("FX stale — provider down AFTER a success serves last-known-good rates, source 'stale'", async () => {
    let succeed = true;
    const svc = createDashboardService(
      usdPorts({
        getRates: async () => {
          if (!succeed) throw new Error("frankfurter down");
          return {
            base: "EUR",
            date: "2026-06-04",
            rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
          };
        },
      }),
    );

    // First read warms the in-memory last-known-good cache (live).
    const live = await svc.getOverview(USER);
    expect(live.fx.source).toBe("live");

    // Provider now down — must serve the cached rates (NOT 1:1).
    succeed = false;
    const stale = await svc.getOverview(USER);
    expect(stale.fx.source).toBe("stale");
    expect(stale.fx.asOf).toBe("2026-06-04"); // cached rate date carried through
    expect(stale.composition.liquideEur).toBeCloseTo(1_000, 6); // 1 080 / 1.08, still applied
  });

  test("FX unavailable — cold start + provider down → source 'unavailable', 1:1 conversion is EXPLICIT and logged", async () => {
    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      const svc = createDashboardService(
        usdPorts({
          getRates: async () => {
            throw new Error("frankfurter down");
          },
        }),
      );
      const out = await svc.getOverview(USER);
      expect(out.fx.source).toBe("unavailable");
      expect(out.fx.asOf).toBeNull();
      // No cached rate → 1:1 identity (1 080 USD read as 1 080 €), but EXPLICIT.
      expect(out.composition.liquideEur).toBe(1_080);
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings).toHaveLength(1);
    const message = String(warnings[0]?.[0]);
    expect(message).toContain("[fx]");
    expect(message).toContain("unavailable");
  });
});
