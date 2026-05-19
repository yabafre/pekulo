import { describe, expect, test } from "bun:test";
import type { Account, FxRates, Holding } from "@pekulo/validators";
import { computeSnapshotFx } from "./portfolio-fx";

function makeAccount(over: Partial<Account>): Account {
  return {
    id: "acc_aaaaaaaaaaaaaaaaaaaaa",
    userId: "00000000-0000-0000-0000-000000000000",
    label: "Compte EUR",
    type: "cto",
    currency: "EUR",
    cashBalance: 0,
    notes: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    ...over,
  } as Account;
}

function makeHolding(over: Partial<Holding>): Holding {
  return {
    id: "hld_aaaaaaaaaaaaaaaaaaaaa",
    userId: "00000000-0000-0000-0000-000000000000",
    accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
    kind: "action",
    ticker: "AAPL",
    isin: null,
    label: "Apple",
    currency: "USD",
    quantity: 100,
    avgCost: 8,
    lastPrice: 10,
    lastPriceAt: null,
    notes: null,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    updatedAt: new Date("2026-05-01T00:00:00Z"),
    closedAt: null,
    ...over,
  } as Holding;
}

const RATES_EUR: FxRates = {
  base: "EUR",
  date: "2026-05-19",
  rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
};

describe("computeSnapshotFx", () => {
  // AC-1 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given a portfolio accounts=[{ id:"acc_…A", currency:"EUR", cashBalance:0 }]
  //   and holdings=[{ id:"hld_…A", currency:"USD", quantity:100, avgCost:8, lastPrice:10 }]
  //   and rates=null, When computeSnapshotFx(...) is called,
  //   Then fxBase==="EUR" AND fxAvailable===false AND fxSource==="fallback"
  //   AND fxAsOf===null AND kpi.marketValue===1000 AND byAccount[0].total===1000
  //   AND kpi.invested===800 AND kpi.pnl===200.
  test("AC-1: USD holding + rates=null → identity, fxSource=fallback, fxAsOf=null", () => {
    const accounts = [makeAccount({ currency: "EUR", cashBalance: 0 })];
    const holdings = [makeHolding({ currency: "USD", quantity: 100, avgCost: 8, lastPrice: 10 })];
    const snap = computeSnapshotFx(accounts, holdings, null, "EUR");
    expect(snap.fxBase).toBe("EUR");
    expect(snap.fxAvailable).toBe(false);
    expect(snap.fxSource).toBe("fallback");
    expect(snap.fxAsOf).toBeNull();
    expect(snap.kpi.marketValue).toBe(1000);
    expect(snap.kpi.invested).toBe(800);
    expect(snap.kpi.pnl).toBe(200);
    expect(snap.kpi.cash).toBe(0);
    expect(snap.kpi.capitalTotal).toBe(1000);
    expect(snap.byAccount).toHaveLength(1);
    expect(snap.byAccount[0]!.accountId).toBe("acc_aaaaaaaaaaaaaaaaaaaaa");
    expect(snap.byAccount[0]!.total).toBe(1000);
  });

  // AC-2 (verbatim from docs/stories/3-3-portfolio-fx.md):
  //   Given the same portfolio as AC-1 AND rates={ base:"EUR", date:"2026-05-19",
  //   rates:{ EUR:1, USD:1.08, GBP:0.85, CHF:0.95 } }, When computeSnapshotFx is
  //   called, Then fxAvailable===true AND fxSource==="live" AND fxAsOf==="2026-05-19"
  //   AND |kpi.marketValue - 1000/1.08| < 0.01 (≈925.93) AND |kpi.invested - 800/1.08| < 0.01
  //   AND |kpi.pnl - 200/1.08| < 0.01.
  test("AC-2: USD holding + live rates → FX-adjusted KPIs, fxSource=live, fxAsOf=YYYY-MM-DD", () => {
    const accounts = [makeAccount({ currency: "EUR", cashBalance: 0 })];
    const holdings = [makeHolding({ currency: "USD", quantity: 100, avgCost: 8, lastPrice: 10 })];
    const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
    expect(snap.fxAvailable).toBe(true);
    expect(snap.fxSource).toBe("live");
    expect(snap.fxAsOf).toBe("2026-05-19");
    expect(Math.abs(snap.kpi.marketValue - 1000 / 1.08)).toBeLessThan(0.01);
    expect(Math.abs(snap.kpi.invested - 800 / 1.08)).toBeLessThan(0.01);
    expect(Math.abs(snap.kpi.pnl - 200 / 1.08)).toBeLessThan(0.01);
  });

  test("cash and holdings combine in byAccount.total at base currency", () => {
    const accounts = [
      makeAccount({ id: "acc_eur", currency: "EUR", cashBalance: 500, label: "Livret" }),
      makeAccount({ id: "acc_usd", currency: "USD", cashBalance: 1080, label: "CTO USD" }),
    ];
    const holdings = [
      makeHolding({
        id: "hld_aapl",
        accountId: "acc_usd",
        currency: "USD",
        quantity: 100,
        avgCost: 8,
        lastPrice: 10,
      }),
    ];
    const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
    // EUR account: 500 EUR cash, no holdings → byAccount total = 500
    const eurRow = snap.byAccount.find((b) => b.accountId === "acc_eur");
    expect(eurRow?.total).toBe(500);
    // USD account: 1080 USD cash + 1000 USD holding = 2080 USD → /1.08 ≈ 1925.93 EUR
    const usdRow = snap.byAccount.find((b) => b.accountId === "acc_usd");
    expect(usdRow).toBeDefined();
    expect(Math.abs((usdRow as { total: number }).total - 2080 / 1.08)).toBeLessThan(0.01);
    // Total cash KPI = 500 + 1080/1.08 ≈ 1500
    expect(Math.abs(snap.kpi.cash - (500 + 1080 / 1.08))).toBeLessThan(0.01);
  });

  test("rates=null treats every conversion as identity (no FX applied)", () => {
    const accounts = [
      makeAccount({ id: "acc_eur", currency: "EUR", cashBalance: 100 }),
      makeAccount({ id: "acc_usd", currency: "USD", cashBalance: 200 }),
    ];
    const holdings: Holding[] = [];
    const snap = computeSnapshotFx(accounts, holdings, null, "EUR");
    expect(snap.kpi.cash).toBe(300); // 100 + 200, identity
    expect(snap.fxSource).toBe("fallback");
  });

  test("unknown foreign rate (not in rates.rates) falls back to identity per row", () => {
    // Simulate Frankfurter returning only USD — GBP holding has no rate.
    const partialRates: FxRates = {
      base: "EUR",
      date: "2026-05-19",
      rates: { EUR: 1, USD: 1.08 } as FxRates["rates"],
    };
    const accounts = [makeAccount({ id: "acc_x", currency: "EUR", cashBalance: 0 })];
    const holdings = [
      makeHolding({
        id: "hld_gbp",
        accountId: "acc_x",
        currency: "GBP",
        quantity: 10,
        avgCost: 1,
        lastPrice: 2,
      }),
    ];
    const snap = computeSnapshotFx(accounts, holdings, partialRates, "EUR");
    // GBP rate missing → identity: 10 × 2 = 20 (stamped as EUR even though native is GBP)
    expect(snap.kpi.marketValue).toBe(20);
    expect(snap.fxSource).toBe("live"); // rates object was provided
  });

  test("accounts and holdings arrays in output are referentially passed through", () => {
    const accounts = [makeAccount({})];
    const holdings = [makeHolding({})];
    const snap = computeSnapshotFx(accounts, holdings, RATES_EUR, "EUR");
    expect(snap.accounts).toBe(accounts);
    expect(snap.holdings).toBe(holdings);
  });

  test("base parameter defaults to EUR when omitted", () => {
    const snap = computeSnapshotFx([], [], null);
    expect(snap.fxBase).toBe("EUR");
  });
});
