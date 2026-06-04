// apps/api/src/modules/dashboard/dashboard.service.test.ts
// AC-1..AC-4 — composition logic with stub ports + hand-computed reference.
import { describe, expect, test } from "bun:test";
import { computeProgress } from "../../common/derive/compass-progress";
import { createDashboardService, type DashboardPorts } from "./dashboard.service";
import type { Account, Holding } from "@pekulo/validators";

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

  test("AC-3 — compass percent/gap derive from the LIVE total wealth", async () => {
    const svc = createDashboardService(basePorts());
    const out = await svc.getOverview(USER);
    expect(out.compass).toEqual({ percent: 34.5, objectif: 800_000, gap: 524_000 });
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
});
