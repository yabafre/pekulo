// apps/api/src/modules/advisory/advisory-grounding-validator.test.ts
// Tests for advisory grounding validator (story 12-3, AC-1).

import { describe, expect, it } from "bun:test";
import {
  collectKnownSnapshotNumbers,
  validateAdvisoryGrounding,
} from "./advisory-grounding-validator";
import type { AdvisoryAnalysisResult, AdvisorySnapshot } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";

const fixtureSnapshot: AdvisorySnapshot = {
  schemaVersion: 1,
  baseCurrency: "EUR",
  wealth: {
    totalEur: 150000,
    investableEur: 120000,
    cashEur: 50000,
    investmentsEur: 70000,
    realEstateEquityEur: 30000,
    unrealizedPnlEur: 10000,
  },
  allocation: [
    { key: "cash", amountEur: 50000, pct: 33.33 },
    { key: "investments", amountEur: 70000, pct: 46.67 },
    { key: "real-estate", amountEur: 30000, pct: 20 },
  ],
  compass: {
    targetEur: 300000,
    currentWealthEur: 150000,
    percent: 50,
    gapEur: 150000,
  },
  monthlyCashflow: {
    year: 2026,
    monthNum: 5,
    incomeEur: 5000,
    spendingEur: 3000,
    transfersEur: 1000,
    netChangeEur: 1000,
    source: "persisted",
  },
  portfolio: {
    holdingsCount: 1,
    investedEur: 60000,
    marketValueEur: 70000,
    pnlEur: 10000,
    byKind: [
      { kind: "etf", marketValueEur: 70000, pct: 100 },
      { kind: "action", marketValueEur: 0, pct: 0 },
      { kind: "crypto", marketValueEur: 0, pct: 0 },
      { kind: "autre", marketValueEur: 0, pct: 0 },
    ],
    positions: [
      {
        holdingId: "hld_1234567890abcdef" as any,
        accountId: "acc_1",
        ticker: "CW8",
        label: "Amundi MSCI World",
        kind: "etf",
        currency: "EUR",
        quantity: 140,
        avgCost: 428.57,
        lastPrice: 500,
        marketValueEur: 70000,
        pnlEur: 10000,
        pnlPct: 16.67,
      },
    ],
  },
  fiscalite: {
    computation: "none",
    envelopes: [{ accountType: "pea", amountEur: 70000, pct: 46.67 }],
    properties: [{ propertyType: "residence-principale", netEquityEur: 30000, pct: 20 }],
    cryptoEur: 0,
  },
  fx: {
    base: "EUR",
    source: "fallback",
    asOf: "2026-05-01",
  },
};

// AC-1 (verbatim from story 12-3:17):
//   Given a deterministic financial snapshot produced by the analysis engine,
//   When the advisory LLM task runs, Then the LLM returns structured analysis
//   and actionable recommendations (including instrument-level buy/sell/hold
//   guidance per ADR-0016 §2), and surfaces no monetary amount, percentage,
//   or price that is not present in the snapshot.
describe("advisory-grounding-validator (story 12-3)", () => {
  it("collects numbers from snapshot correctly", () => {
    const nums = collectKnownSnapshotNumbers(fixtureSnapshot);
    expect(nums.has(150000)).toBe(true);
    expect(nums.has(50000)).toBe(true);
    expect(nums.has(33.33)).toBe(true);
    expect(nums.has(500)).toBe(true);
  });

  it("passes validation when analysis only cites numbers present in snapshot", () => {
    const validAnalysis: AdvisoryAnalysisResult = {
      overview: "Patrimoine total de 150000 € avec 50000 € en cash.",
      strengths: ["Objectif compass à 50% atteint (cible 300000 €)."],
      risks: ["L'allocation en cash représente 33.33%."],
      allocationAdvice: "Réduire les 50000 € de cash vers l'investissement.",
      recommendations: [
        {
          id: "rec-1",
          title: "Renforcer CW8",
          action: "buy",
          target: "PEA",
          rationale: "Position CW8 actuelle à 500 € par part avec 70000 € de valeur.",
          priority: "high",
          instrumentRecommendation: {
            symbol: "CW8",
            action: "buy",
            rationale: "Prix de 500 € attractif.",
          },
        },
      ],
    };

    expect(() => validateAdvisoryGrounding(validAnalysis, fixtureSnapshot)).not.toThrow();
  });

  it("throws PekuloError BAD_REQUEST when an ungrounded figure is cited", () => {
    const hallucinatedAnalysis: AdvisoryAnalysisResult = {
      overview: "Patrimoine total de 999999 €.", // 999999 is not in the snapshot
      strengths: [],
      risks: [],
      allocationAdvice: "Conseil",
      recommendations: [],
    };

    expect(() => validateAdvisoryGrounding(hallucinatedAnalysis, fixtureSnapshot)).toThrow(
      PekuloError,
    );
  });

  it("handles recommendation IDs > 10, ticker numbers, and negative numbers/losses without false positives", () => {
    const snapshotWithLossAndNamedHoldings: AdvisorySnapshot = {
      ...fixtureSnapshot,
      wealth: {
        ...fixtureSnapshot.wealth,
        unrealizedPnlEur: -15000,
      },
      portfolio: {
        ...fixtureSnapshot.portfolio!,
        positions: [
          {
            ...fixtureSnapshot.portfolio!.positions[0]!,
            ticker: "CAC40",
            label: "Amundi CAC 40 ETF",
          },
        ],
      },
    };

    const analysisWithEdgeCases: AdvisoryAnalysisResult = {
      overview: "Analyse avec perte latente de 15000 €.",
      strengths: [],
      risks: [],
      allocationAdvice: "Conseil",
      recommendations: [
        {
          id: "rec-11", // ID > 10
          title: "Conserver Amundi CAC 40 ETF",
          action: "hold",
          target: "PEA",
          rationale: "Position CAC 40 stable avec perte de 15000 € déjà intégrée.",
          priority: "medium",
          instrumentRecommendation: {
            symbol: "CAC40",
            action: "hold",
            rationale: "Garder le CAC 40 en fond de portefeuille.",
          },
        },
      ],
    };

    expect(() =>
      validateAdvisoryGrounding(analysisWithEdgeCases, snapshotWithLossAndNamedHoldings),
    ).not.toThrow();
  });
});
