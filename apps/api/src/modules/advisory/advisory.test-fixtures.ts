import type { AdvisorySnapshot } from "@pekulo/types";

export function advisorySnapshotFixture(): AdvisorySnapshot {
  return {
    schemaVersion: 1,
    baseCurrency: "EUR",
    wealth: {
      totalEur: 276_000,
      investableEur: 26_000,
      cashEur: 20_000,
      investmentsEur: 6_000,
      realEstateEquityEur: 250_000,
      unrealizedPnlEur: 1_200,
    },
    allocation: [
      { key: "cash", amountEur: 20_000, pct: 7.2 },
      { key: "investments", amountEur: 6_000, pct: 2.2 },
      { key: "real-estate", amountEur: 250_000, pct: 90.6 },
    ],
    compass: {
      targetEur: 800_000,
      currentWealthEur: 26_000,
      percent: 3.3,
      gapEur: 774_000,
    },
    monthlyCashflow: {
      year: 2026,
      monthNum: 10,
      incomeEur: 5_000,
      spendingEur: 3_000,
      transfersEur: 500,
      netChangeEur: 2_000,
      source: "derived",
    },
    portfolio: {
      holdingsCount: 1,
      investedEur: 800,
      marketValueEur: 900,
      pnlEur: 100,
      byKind: [
        { kind: "etf", marketValueEur: 900, pct: 100 },
        { kind: "action", marketValueEur: 0, pct: 0 },
        { kind: "crypto", marketValueEur: 0, pct: 0 },
        { kind: "autre", marketValueEur: 0, pct: 0 },
      ],
      positions: [
        {
          holdingId: "hld_000000000000000000000",
          accountId: "acc_000000000000000000000",
          ticker: "CW8",
          label: "ETF Monde",
          kind: "etf",
          currency: "EUR",
          quantity: 10,
          avgCost: 80,
          lastPrice: 90,
          marketValueEur: 900,
          pnlEur: 100,
          pnlPct: 0.125,
        },
      ],
    },
    fiscalite: {
      computation: "none",
      envelopes: [{ accountType: "pea", amountEur: 26_000, pct: 100 }],
      properties: [{ propertyType: "residence-principale", netEquityEur: 250_000, pct: 90.6 }],
      cryptoEur: 0,
    },
    fx: { base: "EUR", source: "live", asOf: "2026-10-27" },
  };
}
