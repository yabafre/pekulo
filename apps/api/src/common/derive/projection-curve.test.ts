// Pure-helper unit tests for computeProjectionCurve. No I/O, no clock reads.
// Re-implements the monthly-annuity formula inline for AC-1/AC-3 assertions
// (per story 7-3 §"Compounding") so the test compares helper output against an
// in-test re-derivation using the same constants as the helper.

import { describe, expect, test } from "bun:test";
import { computeProjectionCurve } from "./projection-curve";
import { HypothesisError } from "../../modules/hypothesis/hypothesis.errors";

// FV(12k) = P·(1+i)^(12k) + C·((1+i)^(12k) − 1)/i, i = rate/12. i = 0 → linear.
function fvAtYear(P: number, C: number, rate: number, k: number): number {
  const i = rate / 12;
  const m = 12 * k;
  if (i === 0) return P + C * m;
  return P * (1 + i) ** m + C * (((1 + i) ** m - 1) / i);
}

describe("computeProjectionCurve", () => {
  // AC-1 (verbatim from story 7-3): 60_000 / 1_000 / 5% / 30y, monthly annuity.
  test("AC-1: year-by-year series matches the monthly closed-form annuity", () => {
    const out = computeProjectionCurve({
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 30,
    });
    expect(out.points).toHaveLength(31);
    expect(out.points[0]!.eur).toBe(60_000);
    for (let k = 0; k <= 30; k++) {
      expect(out.points[k]!.year).toBe(k);
      const expected = fvAtYear(60_000, 1_000, 0.05, k);
      // Relative tolerance 1e-6 — float compounding over 360 months.
      expect(out.points[k]!.eur).toBeCloseTo(expected, 4);
    }
    expect(out.finalEur).toBe(out.points[30]!.eur);
  });

  // AC-2: zero-rate → exact linear accumulation, no division by zero.
  test("AC-2: annualRate = 0 produces an exact linear series", () => {
    const out = computeProjectionCurve({
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0,
      horizonYears: 30,
    });
    for (let k = 0; k <= 30; k++) {
      expect(out.points[k]!.eur).toBe(60_000 + 1_000 * 12 * k);
    }
  });

  // AC-3: negative current wealth (underwater) does NOT throw; starts negative.
  test("AC-3: negative currentWealthEur passes through (no clamp)", () => {
    const out = computeProjectionCurve({
      currentWealthEur: -5_000,
      monthlyContribution: 500,
      annualRate: 0.04,
      horizonYears: 10,
    });
    expect(out.points[0]!.eur).toBe(-5_000);
    for (let k = 0; k <= 10; k++) {
      expect(out.points[k]!.eur).toBeCloseTo(fvAtYear(-5_000, 500, 0.04, k), 4);
    }
  });

  // AC-1 determinism — same inputs, deeply-equal outputs, no clock/random.
  test("deterministic: same inputs produce deeply-equal outputs", () => {
    const args = {
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 30,
    };
    expect(computeProjectionCurve(args)).toEqual(computeProjectionCurve(args));
  });

  // AC-4 guards.
  test("guard: non-finite currentWealthEur throws HypothesisError", () => {
    expect(() =>
      computeProjectionCurve({
        currentWealthEur: Number.NaN,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 30,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: negative monthlyContribution throws HypothesisError", () => {
    expect(() =>
      computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: -1,
        annualRate: 0.05,
        horizonYears: 30,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: annualRate > 1 throws HypothesisError", () => {
    expect(() =>
      computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 1.5,
        horizonYears: 30,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: non-integer horizonYears throws HypothesisError", () => {
    expect(() =>
      computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 30.5,
      }),
    ).toThrow(HypothesisError);
  });

  test("guard: horizonYears out of [1,50] throws HypothesisError", () => {
    expect(() =>
      computeProjectionCurve({
        currentWealthEur: 60_000,
        monthlyContribution: 1_000,
        annualRate: 0.05,
        horizonYears: 51,
      }),
    ).toThrow(HypothesisError);
  });
});
