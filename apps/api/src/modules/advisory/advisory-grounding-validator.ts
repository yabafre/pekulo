// apps/api/src/modules/advisory/advisory-grounding-validator.ts
// Strict grounding validator ensuring LLM outputs cite only figures present in the deterministic snapshot (story 12-3, AC-1, ADR-0016 §3).

import type { AdvisoryAnalysisResult, AdvisorySnapshot } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";

export function collectKnownSnapshotNumbers(snapshot: AdvisorySnapshot): Set<number> {
  const numbers = new Set<number>();

  function addNum(n: number | null | undefined) {
    if (n != null && Number.isFinite(n)) {
      const abs = Math.abs(n);
      numbers.add(Math.round(n * 100) / 100);
      numbers.add(Math.round(n));
      numbers.add(Math.round(abs * 100) / 100);
      numbers.add(Math.round(abs));
      if (abs >= 1000) {
        numbers.add(Math.round(n / 1000));
        numbers.add(Math.round(abs / 1000));
      }
    }
  }

  function extractNumbersFromString(str: string | null | undefined) {
    if (!str) return;
    const matches = str.match(/\d+(?:[.,]\d+)?/g);
    if (matches) {
      for (const m of matches) {
        const val = parseFloat(m.replace(",", "."));
        if (Number.isFinite(val)) {
          numbers.add(val);
          numbers.add(Math.round(val));
        }
      }
    }
  }

  addNum(snapshot.wealth.totalEur);
  addNum(snapshot.wealth.investableEur);
  addNum(snapshot.wealth.cashEur);
  addNum(snapshot.wealth.investmentsEur);
  addNum(snapshot.wealth.realEstateEquityEur);
  addNum(snapshot.wealth.unrealizedPnlEur);

  for (const alloc of snapshot.allocation) {
    addNum(alloc.amountEur);
    addNum(alloc.pct);
  }

  if (snapshot.compass) {
    addNum(snapshot.compass.targetEur);
    addNum(snapshot.compass.currentWealthEur);
    addNum(snapshot.compass.percent);
    addNum(snapshot.compass.gapEur);
  }

  if (snapshot.monthlyCashflow) {
    addNum(snapshot.monthlyCashflow.incomeEur);
    addNum(snapshot.monthlyCashflow.spendingEur);
    addNum(snapshot.monthlyCashflow.transfersEur);
    addNum(snapshot.monthlyCashflow.netChangeEur);
    addNum(snapshot.monthlyCashflow.year);
    addNum(snapshot.monthlyCashflow.monthNum);
  }

  if (snapshot.portfolio) {
    addNum(snapshot.portfolio.investedEur);
    addNum(snapshot.portfolio.marketValueEur);
    addNum(snapshot.portfolio.pnlEur);
    addNum(snapshot.portfolio.holdingsCount);
    for (const pos of snapshot.portfolio.positions) {
      addNum(pos.quantity);
      addNum(pos.avgCost);
      addNum(pos.lastPrice);
      addNum(pos.marketValueEur);
      addNum(pos.pnlEur);
      addNum(pos.pnlPct);
      extractNumbersFromString(pos.ticker);
      extractNumbersFromString(pos.label);
    }
    for (const kind of snapshot.portfolio.byKind) {
      addNum(kind.marketValueEur);
      addNum(kind.pct);
    }
  }

  if (snapshot.fiscalite) {
    addNum(snapshot.fiscalite.cryptoEur);
    for (const env of snapshot.fiscalite.envelopes) {
      addNum(env.amountEur);
      addNum(env.pct);
    }
    for (const prop of snapshot.fiscalite.properties) {
      addNum(prop.netEquityEur);
      addNum(prop.pct);
    }
  }

  return numbers;
}

// AC-1 (verbatim from story 12-3:17):
//   Given a deterministic financial snapshot produced by the analysis engine,
//   When the advisory LLM task runs, Then the LLM returns structured analysis
//   and actionable recommendations (including instrument-level buy/sell/hold
//   guidance per ADR-0016 §2), and surfaces no monetary amount, percentage,
//   or price that is not present in the snapshot.
export function validateAdvisoryGrounding(
  analysis: AdvisoryAnalysisResult,
  snapshot: AdvisorySnapshot,
): void {
  const knownNumbers = collectKnownSnapshotNumbers(snapshot);

  // Scan user-facing narrative text only (avoiding structural recommendation IDs like "rec-11")
  const textSegments: string[] = [
    analysis.overview,
    ...(analysis.strengths ?? []),
    ...(analysis.risks ?? []),
    analysis.allocationAdvice,
    ...analysis.recommendations.flatMap((rec) => [
      rec.title,
      rec.rationale,
      rec.target,
      rec.instrumentRecommendation?.rationale ?? "",
    ]),
  ];
  const textBlob = textSegments.join(" ");
  const numericRegex = /(?:€|\b)(\d+(?:[.,]\d+)?)\s*(?:€|k|%|EUR)?/gi;

  let match: RegExpExecArray | null;
  while ((match = numericRegex.exec(textBlob)) !== null) {
    const raw = match[1]!.replace(",", ".");
    const val = parseFloat(raw);
    if (!Number.isFinite(val)) continue;
    // Allow small standard constants (0 to 10 for rankings, list IDs, step numbers)
    if (val >= 0 && val <= 10 && Number.isInteger(val)) continue;

    const rounded2 = Math.round(val * 100) / 100;
    const rounded0 = Math.round(val);
    if (!knownNumbers.has(rounded2) && !knownNumbers.has(rounded0)) {
      throw new PekuloError(
        "BAD_REQUEST",
        `Advisory grounding violation: figure ${val} cited in LLM response does not exist in deterministic snapshot (AC-1)`,
      );
    }
  }
}
