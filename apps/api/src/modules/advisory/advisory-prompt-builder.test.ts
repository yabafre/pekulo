// apps/api/src/modules/advisory/advisory-prompt-builder.test.ts
// Tests for dedicated advisory prompt builder (story 12-3, AC-1).

import { describe, expect, it } from "bun:test";
import { buildAdvisoryPrompt } from "./advisory-prompt-builder";
import type { AdvisorySnapshot } from "@pekulo/validators";

const mockSnapshot: AdvisorySnapshot = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  wealth: {
    totalEur: 200000,
    investableEur: 150000,
    cashEur: 60000,
    investmentsEur: 90000,
    realEstateEquityEur: 50000,
    unrealizedPnlEur: 15000,
  },
  allocation: [
    { key: "cash", amountEur: 60000, pct: 30 },
    { key: "investments", amountEur: 90000, pct: 45 },
    { key: "real-estate", amountEur: 50000, pct: 25 },
  ],
  compass: {
    targetEur: 500000,
    currentWealthEur: 200000,
    percent: 40,
    gapEur: 300000,
  },
  monthlyCashflow: {
    year: 2026,
    monthNum: 5,
    incomeEur: 6000,
    spendingEur: 3500,
    transfersEur: 1000,
    netChangeEur: 1500,
    source: "persisted",
  },
  portfolio: {
    holdingsCount: 1,
    investedEur: 75000,
    marketValueEur: 90000,
    pnlEur: 15000,
    byKind: [
      { kind: "etf", marketValueEur: 90000, pct: 100 },
      { kind: "action", marketValueEur: 0, pct: 0 },
      { kind: "crypto", marketValueEur: 0, pct: 0 },
      { kind: "autre", marketValueEur: 0, pct: 0 },
    ],
    positions: [
      {
        holdingId: "hld_9999999999abcdef" as any,
        accountId: "acc_pea",
        ticker: "CW8",
        label: "Amundi MSCI World",
        kind: "etf",
        currency: "EUR",
        quantity: 180,
        avgCost: 416.67,
        lastPrice: 500,
        marketValueEur: 90000,
        pnlEur: 15000,
        pnlPct: 20,
      },
    ],
  },
  fiscalite: {
    computation: "none",
    envelopes: [{ accountType: "pea", amountEur: 90000, pct: 45 }],
    properties: [{ propertyType: "residence-principale", netEquityEur: 50000, pct: 25 }],
    cryptoEur: 0,
  },
  fx: {
    base: "EUR",
    source: "live",
    asOf: "2026-05-01",
  },
};

// AC-1 (verbatim from story 12-3:17):
//   Given a deterministic financial snapshot produced by the analysis engine,
//   When the advisory LLM task runs, Then the LLM returns structured analysis
//   and actionable recommendations (including instrument-level buy/sell/hold
//   guidance per ADR-0016 §2), and surfaces no monetary amount, percentage,
//   or price that is not present in the snapshot.
describe("buildAdvisoryPrompt (story 12-3)", () => {
  it("builds prompt with grounding rules and snapshot JSON", () => {
    const prompt = buildAdvisoryPrompt(mockSnapshot);

    expect(prompt).toContain("STRICT GROUNDING INVARIANTS (BINDING):");
    expect(prompt).toContain("ADR-0016 §2 SCOPED CARVE-OUT");
    expect(prompt).toContain('"totalEur": 200000');
    expect(prompt).toContain('"ticker": "CW8"');
    expect(prompt).toContain("recommendations");
    expect(prompt).toContain("instrumentRecommendation");
  });
});
