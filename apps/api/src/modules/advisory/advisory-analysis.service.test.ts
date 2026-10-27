import { describe, expect, test } from "bun:test";
import type {
  Account,
  FxRates,
  GetMonthlyOutput,
  Holding,
  RealEstate,
  TotalEquityOutput,
} from "@pekulo/validators";
import {
  createAdvisoryAnalysisService,
  type AdvisoryAnalysisPorts,
} from "./advisory-analysis.service";

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
    lastPrice: 90,
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

function basePorts(over: Partial<AdvisoryAnalysisPorts> = {}): AdvisoryAnalysisPorts {
  return {
    listAccounts: async () => [
      acct({ id: ACC_LIVRET, type: "livret", cashBalance: 10_000 }),
      acct({ id: ACC_PEA, type: "pea", cashBalance: 10_000 }),
    ],
    listHoldings: async () =>
      Array.from({ length: 6 }, (_, index) =>
        hold({
          id: `hld_${(index + 1).toString().padStart(21, "0")}`,
          accountId: index < 3 ? ACC_LIVRET : ACC_PEA,
          ticker: `T${index + 1}`,
        }),
      ),
    resolveQuote: async ({ ticker }) => ({
      symbol: ticker ?? "T",
      price: 100,
      currency: "EUR",
      marketTime: "2026-10-27",
      provider: "yahoo",
    }),
    getRates: async () => RATES,
    getTotalEquity: async () => EQUITY,
    listProperties: async () => [property()],
    getCompass: async () => ({ objectif: 800_000 }),
    getMonthly: async () => MONTHLY,
    clock: () => NOW,
    warn: () => {},
    ...over,
  };
}

describe("createAdvisoryAnalysisService", () => {
  test("AC-1 — composes the reference snapshot and selects the current UTC month", async () => {
    let period: { year: number; monthNum: number } | undefined;
    const service = createAdvisoryAnalysisService(
      basePorts({
        getMonthly: async (_userId, input) => {
          period = input;
          return MONTHLY;
        },
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(period).toEqual({ year: 2026, monthNum: 10 });
    expect(snapshot.wealth.totalEur).toBe(276_000);
    expect(snapshot.portfolio?.holdingsCount).toBe(6);
    expect(snapshot.monthlyCashflow).toEqual({
      year: 2026,
      monthNum: 10,
      incomeEur: 5_000,
      spendingEur: 3_000,
      transfersEur: 500,
      netChangeEur: 2_000,
      source: "derived",
    });
    expect(snapshot.fx).toEqual({ base: "EUR", source: "live", asOf: "2026-10-27" });
  });

  test("AC-2 — no holdings never calls the price chain and returns portfolio null", async () => {
    let quoteCalls = 0;
    const service = createAdvisoryAnalysisService(
      basePorts({
        listHoldings: async () => [],
        resolveQuote: async () => {
          quoteCalls += 1;
          throw new Error("unused");
        },
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(snapshot.portfolio).toBeNull();
    expect(quoteCalls).toBe(0);
    expect(snapshot.wealth.totalEur).toBe(270_000);
  });

  test("AC-3 — two service calls over the same ports are deep-equal", async () => {
    const service = createAdvisoryAnalysisService(basePorts());

    const first = await service.getSnapshot(USER);
    const second = await service.getSnapshot(USER);

    expect(second).toEqual(first);
  });

  test("AC-1 — a compass read failure degrades to compass null", async () => {
    const service = createAdvisoryAnalysisService(
      basePorts({
        getCompass: async () => {
          throw new Error("compass read down");
        },
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(snapshot.compass).toBeNull();
    expect(snapshot.wealth.totalEur).toBe(276_000);
  });

  test("AC-1 — a cold FX outage is explicit and converts 1:1", async () => {
    const warnings: string[] = [];
    const service = createAdvisoryAnalysisService(
      basePorts({
        getRates: async () => {
          throw new Error("frankfurter down");
        },
        warn: (message) => warnings.push(message),
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(snapshot.fx).toEqual({
      base: "EUR",
      source: "unavailable",
      asOf: null,
    });
    expect(snapshot.wealth.investmentsEur).toBe(6_000);
    expect(warnings).toHaveLength(1);
  });

  test("AC-1 — a pricing outage falls back to the stored lastPrice", async () => {
    const service = createAdvisoryAnalysisService(
      basePorts({
        resolveQuote: async () => {
          throw new Error("all tiers down");
        },
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(snapshot.wealth.investmentsEur).toBe(5_400);
    expect(snapshot.wealth.totalEur).toBe(275_400);
  });

  test("AC-1 — a persisted monthly envelope keeps its source", async () => {
    const service = createAdvisoryAnalysisService(
      basePorts({
        getMonthly: async () => ({
          source: "persisted",
          record: {
            id: "mr_000000000000000000000",
            year: 2026,
            monthNum: 10,
            incomeEur: 1_000,
            spendingEur: 500,
            transfersEur: 100,
            netChangeEur: 500,
            signedOffAt: "2026-11-03T00:00:00.000Z",
            createdAt: "2026-11-03T00:00:00.000Z",
          },
        }),
      }),
    );

    const snapshot = await service.getSnapshot(USER);

    expect(snapshot.monthlyCashflow.source).toBe("persisted");
    expect(snapshot.monthlyCashflow.netChangeEur).toBe(500);
  });
});
