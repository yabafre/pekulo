import { describe, expect, test } from "bun:test";
import { computeProgress } from "./compass-progress";
import { CompassError } from "../../modules/compass/compass.errors";

describe("computeProgress", () => {
  // AC-3 (verbatim from story 1-1-compass-domain L18):
  //   Given currentWealth = 60_000 EUR and capitalTarget = 800_000 EUR,
  //   When computeProgress({ currentWealth, capitalTarget }) runs,
  //   Then it returns { percent: 7.5, gap: 740_000 } exactly.
  test("AC-3 fixture: 60_000 / 800_000 → 7.5 %, gap 740_000", () => {
    const result = computeProgress({ currentWealth: 60_000, capitalTarget: 800_000 });
    expect(result.percent).toBe(7.5);
    expect(result.gap).toBe(740_000);
  });

  test("rounds to 1 decimal (33.3 %)", () => {
    const result = computeProgress({ currentWealth: 100_000, capitalTarget: 300_000 });
    expect(result.percent).toBe(33.3);
  });

  test("zero wealth returns 0 % progress, full gap", () => {
    const result = computeProgress({ currentWealth: 0, capitalTarget: 500_000 });
    expect(result.percent).toBe(0);
    expect(result.gap).toBe(500_000);
  });

  test("over-target returns >100 % and negative gap", () => {
    const result = computeProgress({ currentWealth: 1_000_000, capitalTarget: 800_000 });
    expect(result.percent).toBe(125);
    expect(result.gap).toBe(-200_000);
  });

  // AC-3 edge cases (verbatim): capitalTarget <= 0 → throws
  // CompassError("INVALID_TARGET", ...); currentWealth < 0 → throws
  // CompassError("INVALID_WEALTH", ...).
  test("capitalTarget = 0 throws INVALID_TARGET", () => {
    expect(() => computeProgress({ currentWealth: 100, capitalTarget: 0 })).toThrow(CompassError);
    try {
      computeProgress({ currentWealth: 100, capitalTarget: 0 });
    } catch (err) {
      expect(err).toBeInstanceOf(CompassError);
      expect((err as CompassError).code).toBe("INVALID_TARGET");
    }
  });

  test("negative capitalTarget throws INVALID_TARGET", () => {
    expect(() => computeProgress({ currentWealth: 100, capitalTarget: -1 })).toThrow(CompassError);
  });

  test("negative currentWealth throws INVALID_WEALTH", () => {
    expect(() => computeProgress({ currentWealth: -1, capitalTarget: 800_000 })).toThrow(
      CompassError,
    );
  });

  test("NaN capitalTarget throws INVALID_TARGET", () => {
    expect(() => computeProgress({ currentWealth: 100, capitalTarget: Number.NaN })).toThrow(
      CompassError,
    );
    try {
      computeProgress({ currentWealth: 100, capitalTarget: Number.NaN });
    } catch (err) {
      expect((err as CompassError).code).toBe("INVALID_TARGET");
    }
  });

  test("Infinity capitalTarget throws INVALID_TARGET", () => {
    expect(() =>
      computeProgress({ currentWealth: 100, capitalTarget: Number.POSITIVE_INFINITY }),
    ).toThrow(CompassError);
  });

  test("NaN currentWealth throws INVALID_WEALTH", () => {
    expect(() => computeProgress({ currentWealth: Number.NaN, capitalTarget: 800_000 })).toThrow(
      CompassError,
    );
    try {
      computeProgress({ currentWealth: Number.NaN, capitalTarget: 800_000 });
    } catch (err) {
      expect((err as CompassError).code).toBe("INVALID_WEALTH");
    }
  });

  test("Infinity currentWealth throws INVALID_WEALTH", () => {
    expect(() =>
      computeProgress({ currentWealth: Number.POSITIVE_INFINITY, capitalTarget: 800_000 }),
    ).toThrow(CompassError);
  });

  // Rounding boundaries — pin Math.round half-toward-+Infinity so a refactor
  // to toFixed / banker's rounding would surface as a regression.
  test("rounding 7.45 surfaces as 7.5 (74.5 → round-up)", () => {
    const result = computeProgress({ currentWealth: 7.45, capitalTarget: 100 });
    expect(result.percent).toBe(7.5);
  });

  test("rounding 2.55 surfaces as 2.6 (25.5 → round-up)", () => {
    const result = computeProgress({ currentWealth: 2.55, capitalTarget: 100 });
    expect(result.percent).toBe(2.6);
  });

  test("rounding 2.45 surfaces as 2.5 (24.5 → round-up)", () => {
    const result = computeProgress({ currentWealth: 2.45, capitalTarget: 100 });
    expect(result.percent).toBe(2.5);
  });
});
