// apps/api/src/common/derive/hypothesis-gap.ts
// Pure helpers for the FR-59 projection-vs-compass comparison (story 7-4). No
// I/O, no clock reads — like projection-curve.ts (7-3), the required curve is
// OFFSET-indexed (point.year = years from now); the web card maps offsets to
// calendar years at render.
//
//   shortfall      = objectif − projectedFinalEur                (€ at horizon)
//   gapEurPerMonth = the ordinary monthly annuity whose future value over the
//                    horizon equals the shortfall, at i = annualRate/12:
//                      gap = shortfall · i / ((1+i)^m − 1)        (m = 12·horizon)
//                      (1+i)^m === 1 (i ≈ 0 / underflow) → gap = shortfall / m
//                    shortfall ≤ 0 → gap 0, reachesCap true.
//   requiredPoints = the LINEAR compass-required ramp from currentWealthEur to
//                    objectif: point[k].eur = currentWealthEur
//                      + (objectif − currentWealthEur)·(k / horizonYears).
//
// Guards throw HypothesisError("HYPOTHESIS_INVALID_INPUT") → 400 (mirrors
// projection-curve.ts defense-in-depth behind the Zod contract boundary).

import type { HypothesisProjectionPoint } from "@pekulo/types";
import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

const MONTHS_PER_YEAR = 12;

function assertObjectif(objectif: number): void {
  if (!Number.isFinite(objectif) || objectif < 0) {
    throw new HypothesisError("HYPOTHESIS_INVALID_INPUT", "objectif must be a finite number >= 0");
  }
}

function assertHorizon(horizonYears: number): void {
  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 50) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "horizonYears must be an integer in [1, 50]",
    );
  }
}

export interface ComputeRequiredCurveInput {
  currentWealthEur: number;
  objectif: number;
  horizonYears: number;
}

export function computeRequiredCurve(
  input: ComputeRequiredCurveInput,
): HypothesisProjectionPoint[] {
  const { currentWealthEur, objectif, horizonYears } = input;
  if (!Number.isFinite(currentWealthEur)) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "currentWealthEur must be a finite number",
    );
  }
  assertObjectif(objectif);
  assertHorizon(horizonYears);
  return Array.from({ length: horizonYears + 1 }, (_unused, k) => ({
    year: k,
    eur: currentWealthEur + (objectif - currentWealthEur) * (k / horizonYears),
  }));
}

export interface ComputeMonthlyGapInput {
  projectedFinalEur: number;
  objectif: number;
  horizonYears: number;
  annualRate: number;
}

export interface MonthlyGap {
  gapEurPerMonth: number;
  shortfallEur: number;
  reachesCap: boolean;
}

export function computeMonthlyGap(input: ComputeMonthlyGapInput): MonthlyGap {
  const { projectedFinalEur, objectif, horizonYears, annualRate } = input;
  if (!Number.isFinite(projectedFinalEur)) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "projectedFinalEur must be a finite number",
    );
  }
  assertObjectif(objectif);
  assertHorizon(horizonYears);
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "annualRate must be a finite number in [0, 1]",
    );
  }

  const shortfall = objectif - projectedFinalEur;
  if (shortfall <= 0) {
    return { gapEurPerMonth: 0, shortfallEur: 0, reachesCap: true };
  }

  const i = annualRate / MONTHS_PER_YEAR;
  const m = MONTHS_PER_YEAR * horizonYears;
  const factor = (1 + i) ** m;
  // Branch on the COMPOUNDING FACTOR, not i === 0 — a sub-epsilon rate underflows
  // (1+i)^m → 1, driving the annuity divisor → 0 (7-3 review lesson 2026-06-12).
  const gapEurPerMonth = factor === 1 ? shortfall / m : (shortfall * i) / (factor - 1);
  if (!Number.isFinite(gapEurPerMonth)) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "gap computation overflowed to a non-finite value",
    );
  }
  return { gapEurPerMonth, shortfallEur: shortfall, reachesCap: false };
}
