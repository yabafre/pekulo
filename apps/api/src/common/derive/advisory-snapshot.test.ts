// AC-1 (verbatim from story 12-2-advisory-analysis-engine:17):
//   Given a user with accounts, holdings, real estate, a compass and a current month,
//   When the advisory snapshot is requested by an allowlisted caller, Then the response
//   exposes total wealth, investable wealth, the three-way allocation with percentages,
//   the compass gap, the current-month cashflow envelope, a portfolio block with
//   instrument-level positions and `byKind`, factual fiscalité signals, and FX
//   provenance — every numeric field produced by the deterministic engine.
// AC-2 (verbatim from story 12-2-advisory-analysis-engine:18):
//   Given a user with no holdings, When the snapshot is requested, Then `portfolio` is
//   `null` and every other block is still present; no price resolution is attempted and
//   no error is returned.
// AC-3 (verbatim from story 12-2-advisory-analysis-engine:19):
//   Given the same accounts, holdings, rates, equity, properties, compass and monthly
//   envelope, When the engine runs twice, Then the two snapshots are deep-equal,
//   including array ordering and rounded percentages; the engine reads no clock and
//   performs no IO.

import { describe, expect, test } from "bun:test";
import type {
  Account,
  FxRates,
  GetMonthlyOutput,
  Holding,
  RealEstate,
  TotalEquityOutput,
} from "@pekulo/validators";
import { computeAdvisorySnapshot, type AdvisorySnapshotInput } from "./advisory-snapshot";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = new Date("2026-10-27T00:00:00Z");
const ACC_LIVRET = "acc_000000000000000000000";
const ACC_PEA = "acc_000000000000000000001";
const RES_ID = "res_000000000000000000000";

function acct(over: Partial<Account> = {}): Account {
  return {
    id: ACC_LIVRET,
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

function hold(over: Partial<Holding> = {}): Holding {
  return {
    id: "hld_000000000000000000001",
    userId: USER,
    accountId: ACC_LIVRET,
    kind: "etf",
    ticker: "CW8",
    isin: null,
    label: "Holding",
    currency: "EUR",
    quantity: 10,
    avgCost: 80,
    lastPrice: 100,
    lastPriceAt: NOW,
    notes: null,
    createdAt: NOW,
    updatedAt: NOW,
    closedAt: null,
    ...over,
  };
}

function property(over: Partial<RealEstate> = {}): RealEstate {
  return {
    id: RES_ID,
    userId: USER,
    label: "Résidence",
    propertyType: "residence-principale",
    currentValuation: 300_000,
    lastValuedOn: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  };
}

const RATES: FxRates = {
  base: "EUR",
  date: "2026-10-27",
  rates: { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.95 },
};

const MONTHLY: GetMonthlyOutput = {
  source: "derived",
  record: {
    year: 2026,
    monthNum: 10,
    incomeEur: 5_000,
    spendingEur: 3_000,
    transfersEur: 500,
    netChangeEur: 2_000,
    signedOffAt: null,
  },
};

const EQUITY: TotalEquityOutput = {
  totalEquityEur: 250_000,
  perProperty: [{ propertyId: RES_ID, netEquityEur: 250_000 }],
};

function baseInput(over: Partial<AdvisorySnapshotInput> = {}): AdvisorySnapshotInput {
  const accounts = [
    acct({ id: ACC_LIVRET, type: "livret", cashBalance: 10_000 }),
    acct({ id: ACC_PEA, type: "pea", cashBalance: 10_000 }),
  ];
  const holdings = Array.from({ length: 6 }, (_, index) =>
    hold({
      id: `hld_${(index + 1).toString().padStart(21, "0")}`,
      accountId: index < 3 ? ACC_LIVRET : ACC_PEA,
      ticker: `T${index + 1}`,
    }),
  );
  return {
    accounts,
    holdings,
    rates: RATES,
    fxSource: "live",
    equity: EQUITY,
    properties: [property()],
    compass: { objectif: 800_000 },
    monthly: MONTHLY,
    ...over,
  };
}

describe("computeAdvisorySnapshot", () => {
  test("AC-1 — full reference snapshot is computed by the engine", () => {
    const snapshot = computeAdvisorySnapshot(baseInput());

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.baseCurrency).toBe("EUR");
    expect(snapshot.wealth).toEqual({
      totalEur: 276_000,
      investableEur: 26_000,
      cashEur: 20_000,
      investmentsEur: 6_000,
      realEstateEquityEur: 250_000,
      unrealizedPnlEur: 1_200,
    });
    expect(snapshot.allocation).toEqual([
      { key: "cash", amountEur: 20_000, pct: 7.2 },
      { key: "investments", amountEur: 6_000, pct: 2.2 },
      { key: "real-estate", amountEur: 250_000, pct: 90.6 },
    ]);
    expect(snapshot.compass).toEqual({
      targetEur: 800_000,
      currentWealthEur: 26_000,
      percent: 3.3,
      gapEur: 774_000,
    });
    expect(snapshot.monthlyCashflow).toEqual({
      year: 2026,
      monthNum: 10,
      incomeEur: 5_000,
      spendingEur: 3_000,
      transfersEur: 500,
      netChangeEur: 2_000,
      source: "derived",
    });
    expect(snapshot.portfolio?.holdingsCount).toBe(6);
    expect(snapshot.portfolio?.investedEur).toBe(4_800);
    expect(snapshot.portfolio?.marketValueEur).toBe(6_000);
    expect(snapshot.portfolio?.pnlEur).toBe(1_200);
    expect(snapshot.portfolio?.byKind).toEqual([
      { kind: "etf", marketValueEur: 6_000, pct: 100 },
      { kind: "action", marketValueEur: 0, pct: 0 },
      { kind: "crypto", marketValueEur: 0, pct: 0 },
      { kind: "autre", marketValueEur: 0, pct: 0 },
    ]);
    expect(snapshot.portfolio?.positions[0]).toMatchObject({
      holdingId: "hld_000000000000000000001",
      marketValueEur: 1_000,
      pnlEur: 200,
      pnlPct: 0.25,
    });
    expect(snapshot.fiscalite).toEqual({
      computation: "none",
      envelopes: [
        { accountType: "livret", amountEur: 13_000, pct: 50 },
        { accountType: "pea", amountEur: 13_000, pct: 50 },
      ],
      properties: [{ propertyType: "residence-principale", netEquityEur: 250_000, pct: 90.6 }],
      cryptoEur: 0,
    });
    expect(snapshot.fx).toEqual({ base: "EUR", source: "live", asOf: "2026-10-27" });
  });

  test("AC-2 — no holdings returns portfolio null and keeps every other block", () => {
    const snapshot = computeAdvisorySnapshot(baseInput({ holdings: [] }));

    expect(snapshot.portfolio).toBeNull();
    expect(snapshot.wealth.totalEur).toBe(270_000);
    expect(snapshot.wealth.investmentsEur).toBe(0);
    expect(snapshot.allocation).toEqual([
      { key: "cash", amountEur: 20_000, pct: 7.4 },
      { key: "investments", amountEur: 0, pct: 0 },
      { key: "real-estate", amountEur: 250_000, pct: 92.6 },
    ]);
    expect(snapshot.compass).toEqual({
      targetEur: 800_000,
      currentWealthEur: 20_000,
      percent: 2.5,
      gapEur: 780_000,
    });
    expect(snapshot.fiscalite.cryptoEur).toBe(0);
  });

  test("AC-3 — the same inputs produce a deep-equal snapshot", () => {
    const first = computeAdvisorySnapshot(baseInput());
    const second = computeAdvisorySnapshot(baseInput());

    expect(second).toEqual(first);
  });

  test("AC-1 — no compass degrades to compass null", () => {
    const snapshot = computeAdvisorySnapshot(baseInput({ compass: null }));

    expect(snapshot.compass).toBeNull();
    expect(snapshot.wealth.totalEur).toBe(276_000);
  });

  test("AC-1 — an overdraft is surfaced raw and the compass clamps to 0 %", () => {
    const snapshot = computeAdvisorySnapshot(
      baseInput({
        accounts: [acct({ id: ACC_LIVRET, cashBalance: -50_000 })],
        holdings: [],
        equity: { totalEquityEur: 0, perProperty: [] },
        properties: [],
        compass: { objectif: 800_000 },
      }),
    );

    expect(snapshot.wealth.totalEur).toBe(-50_000);
    expect(snapshot.allocation.every((line) => line.pct === 0)).toBe(true);
    expect(snapshot.compass).toEqual({
      targetEur: 800_000,
      currentWealthEur: 0,
      percent: 0,
      gapEur: 800_000,
    });
  });

  test("AC-1 — a USD holding is converted to EUR for value and PnL", () => {
    const snapshot = computeAdvisorySnapshot(
      baseInput({
        accounts: [acct({ id: ACC_LIVRET, cashBalance: 0 })],
        holdings: [
          hold({
            accountId: ACC_LIVRET,
            kind: "action",
            ticker: "USDX",
            currency: "USD",
            quantity: 1,
            avgCost: 50,
            lastPrice: 60,
          }),
        ],
        equity: { totalEquityEur: 0, perProperty: [] },
        properties: [],
        compass: null,
      }),
    );

    expect(snapshot.wealth.investmentsEur).toBeCloseTo(60 / 1.08, 6);
    expect(snapshot.portfolio?.positions[0]?.marketValueEur).toBeCloseTo(60 / 1.08, 6);
    expect(snapshot.portfolio?.positions[0]?.pnlEur).toBeCloseTo(10 / 1.08, 6);
    expect(snapshot.portfolio?.positions[0]?.pnlPct).toBe(0.2);
    expect(snapshot.allocation[1]?.pct).toBe(100);
  });

  test("AC-1 — crypto exposure is surfaced both in the portfolio and in fiscalité", () => {
    const snapshot = computeAdvisorySnapshot(
      baseInput({
        holdings: [
          hold({
            accountId: ACC_LIVRET,
            kind: "crypto",
            ticker: "BTC",
            quantity: 1,
            avgCost: 0,
            lastPrice: 500,
          }),
        ],
      }),
    );

    expect(snapshot.fiscalite.cryptoEur).toBe(500);
    expect(snapshot.portfolio?.byKind).toEqual([
      { kind: "etf", marketValueEur: 0, pct: 0 },
      { kind: "action", marketValueEur: 0, pct: 0 },
      { kind: "crypto", marketValueEur: 500, pct: 100 },
      { kind: "autre", marketValueEur: 0, pct: 0 },
    ]);
  });

  test("AC-1 — null rates keep the explicit unavailable FX provenance", () => {
    const snapshot = computeAdvisorySnapshot(baseInput({ rates: null, fxSource: "unavailable" }));

    expect(snapshot.wealth.investmentsEur).toBe(6_000);
    expect(snapshot.fx).toEqual({
      base: "EUR",
      source: "unavailable",
      asOf: null,
    });
  });
});
