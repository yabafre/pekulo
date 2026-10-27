// AC-1 (verbatim from story 12-2-advisory-analysis-engine:17):
//   Given a user with accounts, holdings, real estate, a compass and a current month,
//   When the advisory snapshot is requested by an allowlisted caller, Then the response
//   exposes total wealth, investable wealth, the three-way allocation with percentages,
//   the compass gap, the current-month cashflow envelope, a portfolio block with
//   instrument-level positions and `byKind`, factual fiscalité signals, and FX
//   provenance — every numeric field produced by the deterministic engine.
// AC-2 (verbatim from story 12-2-advisory-analysis-engine:18):
//   Given a user with no holdings, When the snapshot is requested, Then `portfolio` is
//   `null` and every other block is still present.
import { describe, expect, test } from "bun:test";
import { ADVISORY_SNAPSHOT_SCHEMA_VERSION, advisorySnapshotSchema } from "@pekulo/validators";

const snapshot = {
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
  compass: { targetEur: 800_000, currentWealthEur: 26_000, percent: 3.3, gapEur: 774_000 },
  monthlyCashflow: {
    year: 2026,
    monthNum: 10,
    incomeEur: 5_000,
    spendingEur: 3_000,
    transfersEur: 500,
    netChangeEur: 2_000,
    source: "derived",
  },
  portfolio: null,
  fiscalite: { computation: "none", envelopes: [], properties: [], cryptoEur: 0 },
  fx: { base: "EUR", source: "live", asOf: "2026-10-27" },
};

describe("advisory snapshot schema (T1)", () => {
  test("AC-1/AC-2 — schema version is 1 and a portfolio-less snapshot parses", () => {
    expect(ADVISORY_SNAPSHOT_SCHEMA_VERSION).toBe(1);
    expect(advisorySnapshotSchema.safeParse(snapshot).success).toBe(true);
  });

  test("AC-1 — rejects any computation claim other than none", () => {
    const parsed = advisorySnapshotSchema.safeParse({
      ...snapshot,
      fiscalite: { ...snapshot.fiscalite, computation: "tax" },
    });
    expect(parsed.success).toBe(false);
  });
});
