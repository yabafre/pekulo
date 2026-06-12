// Pure helper for the hypothesis projection curve (FR-58, story 7-3). Consumes
// the projection inputs and returns a year-by-year wealth curve. No I/O, no
// clock reads — the curve is OFFSET-indexed (point.year = years from now), so
// the caller (web/dashboard, story 7-4) maps offsets to calendar years.
//
// Compounding (story 7-3 §"Scope & decisions", locked for AC-1/AC-2):
//   i           = annualRate / 12                      (monthly rate)
//   FV(m)       = P·(1+i)^m + C·((1+i)^m − 1)/i         (ordinary monthly annuity)
//   point[k]    = { year: k, eur: FV(12·k) }  for k = 0..horizonYears
//   edge i = 0  → eur = P + C·(12·k)                    (linear, no /0)
// where P = currentWealthEur, C = monthlyContribution.
//
// currentWealthEur is NOT clamped: net wealth can be negative (underwater
// real-estate, 7-1 lesson 2026-06-04) and the annuity is defined for P < 0.
// Only finiteness/range guards throw (mirrors compass-curve.ts defense-in-depth).

import type { HypothesisProjection } from "@pekulo/types";
import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

export interface ComputeProjectionCurveInput {
  currentWealthEur: number;
  monthlyContribution: number;
  annualRate: number;
  horizonYears: number;
}

const MONTHS_PER_YEAR = 12;

export function computeProjectionCurve(input: ComputeProjectionCurveInput): HypothesisProjection {
  const { currentWealthEur, monthlyContribution, annualRate, horizonYears } = input;

  if (!Number.isFinite(currentWealthEur)) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "currentWealthEur must be a finite number",
    );
  }
  if (!Number.isFinite(monthlyContribution) || monthlyContribution < 0) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "monthlyContribution must be a finite number >= 0",
    );
  }
  if (!Number.isFinite(annualRate) || annualRate < 0 || annualRate > 1) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "annualRate must be a finite number in [0, 1]",
    );
  }
  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 50) {
    throw new HypothesisError(
      "HYPOTHESIS_INVALID_INPUT",
      "horizonYears must be an integer in [1, 50]",
    );
  }

  const i = annualRate / MONTHS_PER_YEAR;
  const points = Array.from({ length: horizonYears + 1 }, (_unused, k) => {
    const m = MONTHS_PER_YEAR * k;
    // Branch on the compounding FACTOR, not `i === 0`. For an `i` smaller than
    // machine epsilon, `(1 + i)` rounds to exactly 1 → the annuity term
    // ((factor − 1) / i) collapses to 0 and would silently drop EVERY
    // contribution. The linear limit `P + C·m` is the correct value there (and
    // the no-division-by-zero path for an exact `annualRate = 0`).
    const factor = (1 + i) ** m;
    const eur =
      factor === 1
        ? currentWealthEur + monthlyContribution * m
        : currentWealthEur * factor + monthlyContribution * ((factor - 1) / i);
    // Defense-in-depth: astronomically large P/C overflow the IEEE-754 double to
    // ±∞, which the egress `hypothesisProjectionSchema` would reject as a 500.
    // Surface a clean 400 instead. Unreachable at Persona Alex's V1 scale.
    if (!Number.isFinite(eur)) {
      throw new HypothesisError(
        "HYPOTHESIS_INVALID_INPUT",
        "projected wealth overflowed to a non-finite value",
      );
    }
    return { year: k, eur };
  });

  return {
    currentWealthEur,
    monthlyContribution,
    annualRate,
    horizonYears,
    points,
    finalEur: points[horizonYears]!.eur,
  };
}
