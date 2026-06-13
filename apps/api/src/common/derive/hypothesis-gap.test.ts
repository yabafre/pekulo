// Pure-helper unit tests for the FR-59 gap derives. No I/O, no clock reads.
// Re-implements the annuity + linear-ramp formulas inline so the test compares
// helper output against an in-test re-derivation using the same constants.

import { describe, expect, test } from "bun:test";
import { computeMonthlyGap, computeRequiredCurve } from "./hypothesis-gap";
import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

// gap = shortfall · i / ((1+i)^m − 1), i = rate/12, m = 12·H. factor 1 → linear.
function monthlyGapFor(shortfall: number, rate: number, horizonYears: number): number {
  const i = rate / 12;
  const m = 12 * horizonYears;
  const factor = (1 + i) ** m;
  return factor === 1 ? shortfall / m : (shortfall * i) / (factor - 1);
}

describe("computeMonthlyGap", () => {
  // AC-1 (verbatim from story 7-4): objectif 800k, projected 700k, 30y @ 5%.
  test("AC-1: returns the monthly annuity that closes the shortfall", () => {
    const out = computeMonthlyGap({
      projectedFinalEur: 700_000,
      objectif: 800_000,
      horizonYears: 30,
      annualRate: 0.05,
    });
    expect(out.reachesCap).toBe(false);
    expect(out.shortfallEur).toBe(100_000);
    expect(out.gapEurPerMonth).toBeCloseTo(monthlyGapFor(100_000, 0.05, 30), 6);
    // Out-of-band oracle: 100_000 · (0.05/12) / ((1+0.05/12)^360 − 1) = 120.15495…
    // (story's verbatim 120.1500447 was a miscalculation; recomputed independently).
    expect(out.gapEurPerMonth).toBeCloseTo(120.1549563, 4);
  });

  // AC-1: projected >= objectif → no gap.
  test("AC-1: reaching the cap yields gap 0 / reachesCap true", () => {
    const out = computeMonthlyGap({
      projectedFinalEur: 820_000,
      objectif: 800_000,
      horizonYears: 30,
      annualRate: 0.05,
    });
    expect(out.reachesCap).toBe(true);
    expect(out.gapEurPerMonth).toBe(0);
  });

  // AC-1: zero rate → exact linear share, no division by zero.
  test("AC-1: annualRate 0 splits the shortfall linearly", () => {
    const out = computeMonthlyGap({
      projectedFinalEur: 700_000,
      objectif: 800_000,
      horizonYears: 30,
      annualRate: 0,
    });
    expect(out.gapEurPerMonth).toBe(100_000 / 360);
  });

  test("guard: non-finite projectedFinalEur throws HypothesisError", () => {
    expect(() =>
      computeMonthlyGap({
        projectedFinalEur: Number.NaN,
        objectif: 800_000,
        horizonYears: 30,
        annualRate: 0.05,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: annualRate > 1 throws HypothesisError", () => {
    expect(() =>
      computeMonthlyGap({
        projectedFinalEur: 700_000,
        objectif: 800_000,
        horizonYears: 30,
        annualRate: 1.5,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: horizonYears out of [1,50] throws HypothesisError", () => {
    expect(() =>
      computeMonthlyGap({
        projectedFinalEur: 700_000,
        objectif: 800_000,
        horizonYears: 51,
        annualRate: 0.05,
      }),
    ).toThrow(HypothesisError);
  });
});

describe("computeRequiredCurve", () => {
  // AC-2: linear ramp from current wealth to objectif over the horizon.
  test("AC-2: offset-indexed linear ramp, endpoints exact", () => {
    const points = computeRequiredCurve({
      currentWealthEur: 180_400,
      objectif: 800_000,
      horizonYears: 29,
    });
    expect(points).toHaveLength(30);
    expect(points[0]!.year).toBe(0);
    expect(points[0]!.eur).toBe(180_400);
    expect(points[29]!.eur).toBe(800_000);
    for (let k = 0; k <= 29; k++) {
      expect(points[k]!.year).toBe(k);
      expect(points[k]!.eur).toBeCloseTo(180_400 + (800_000 - 180_400) * (k / 29), 6);
    }
  });

  test("AC-2: negative current wealth ramps from the negative start (no clamp)", () => {
    const points = computeRequiredCurve({
      currentWealthEur: -5_000,
      objectif: 100_000,
      horizonYears: 10,
    });
    expect(points[0]!.eur).toBe(-5_000);
    expect(points[10]!.eur).toBe(100_000);
  });

  test("guard: non-integer horizonYears throws HypothesisError", () => {
    expect(() =>
      computeRequiredCurve({ currentWealthEur: 180_400, objectif: 800_000, horizonYears: 29.5 }),
    ).toThrow(HypothesisError);
  });
});
