// Unit tests for milestone-status.ts (FR-6). AC-9 fixture + AC-10 edge cases.

import { describe, expect, test } from "bun:test";
import { computeStatuses } from "./milestone-status";

const COMPASS = { objectif: 800_000, horizonYears: 25 };
const CURRENT_WEALTH = 60_000;
const CURRENT_YEAR = 2026;

describe("computeStatuses (AC-9 fixture)", () => {
  test("returns deterministic ahead/on-track/behind per milestone", () => {
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [
        { id: "mst_a".padEnd(25, "x"), targetCapital: 80_000, targetYear: 2030 },
        { id: "mst_b".padEnd(25, "x"), targetCapital: 200_000, targetYear: 2035 },
        { id: "mst_c".padEnd(25, "x"), targetCapital: 500_000, targetYear: 2045 },
      ],
    });
    expect(result.map((r) => r.status)).toEqual(["ahead", "ahead", "ahead"]);
    // Full numeric assertion against the story Dev Notes' fixture math (linear
    // plan from 60k @ year=2026 toward 800k @ horizon=25, slope = 29_600 €/yr):
    //   2030 (offset 4):  expectedAt = 178_400 ; delta = 80_000 - 178_400  = -98_400
    //   2035 (offset 9):  expectedAt = 326_400 ; delta = 200_000 - 326_400 = -126_400
    //   2045 (offset 19): expectedAt = 622_400 ; delta = 500_000 - 622_400 = -122_400
    expect(result.map((r) => r.expectedAt)).toEqual([178_400, 326_400, 622_400]);
    expect(result.map((r) => r.delta)).toEqual([-98_400, -126_400, -122_400]);
  });

  test("is deterministic — same inputs produce same outputs across calls", () => {
    const input = {
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [
        { id: "mst_a".padEnd(25, "x"), targetCapital: 80_000, targetYear: 2030 },
        { id: "mst_b".padEnd(25, "x"), targetCapital: 200_000, targetYear: 2035 },
        { id: "mst_c".padEnd(25, "x"), targetCapital: 500_000, targetYear: 2045 },
      ],
    };
    const a = computeStatuses(input);
    const b = computeStatuses(input);
    expect(a).toEqual(b);
  });

  test("returns 'on-track' when target sits inside ±5% band", () => {
    // Linear plan at year+10 from (60k, year=2026) toward 800k at horizon=25:
    //   expectedAt = 60_000 + 740_000 × 10/25 = 356_000
    // Pick a target inside ±5% of itself around 356k → e.g. target = 350_000
    // |350_000 - 356_000| = 6_000 ; 5% × 350_000 = 17_500 → on-track.
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [{ id: "mst_b".padEnd(25, "x"), targetCapital: 350_000, targetYear: 2036 }],
    });
    expect(result[0]!.status).toBe("on-track");
  });

  test("returns 'behind' when target sits above the line (beyond +5%)", () => {
    // expectedAt at year+5 = 60_000 + 740_000 × 5/25 = 208_000
    // Target = 300_000 → delta = +92_000 ; 5% × 300_000 = 15_000 → behind.
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [{ id: "mst_c".padEnd(25, "x"), targetCapital: 300_000, targetYear: 2031 }],
    });
    expect(result[0]!.status).toBe("behind");
  });
});

describe("computeStatuses (AC-10 edge cases)", () => {
  test("returns [] for empty milestones array", () => {
    const result = computeStatuses({
      currentWealth: CURRENT_WEALTH,
      currentYear: CURRENT_YEAR,
      compass: COMPASS,
      milestones: [],
    });
    expect(result).toEqual([]);
  });

  test("throws INVALID_WEALTH on negative currentWealth", () => {
    expect(() =>
      computeStatuses({
        currentWealth: -1,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [],
      }),
    ).toThrow(/currentWealth must be a finite number >= 0/);
  });

  test("throws INVALID_WEALTH on NaN currentWealth", () => {
    expect(() =>
      computeStatuses({
        currentWealth: NaN,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [],
      }),
    ).toThrow(/currentWealth must be a finite number >= 0/);
  });

  test("throws INVALID_TARGET on compass.objectif <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: { objectif: 0, horizonYears: 25 },
        milestones: [],
      }),
    ).toThrow(/compass.objectif must be a finite number > 0/);
  });

  test("throws INVALID_TARGET on horizonYears <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: { objectif: 800_000, horizonYears: 0 },
        milestones: [],
      }),
    ).toThrow(/compass.horizonYears must be a positive integer/);
  });

  test("throws MILESTONE_YEAR_OUT_OF_RANGE on targetYear <= currentYear", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [
          { id: "mst_z".padEnd(25, "x"), targetCapital: 100_000, targetYear: CURRENT_YEAR },
        ],
      }),
    ).toThrow(/targetYear must be a future integer year/);
  });

  test("throws MILESTONE_INVALID_CAPITAL on targetCapital <= 0", () => {
    expect(() =>
      computeStatuses({
        currentWealth: CURRENT_WEALTH,
        currentYear: CURRENT_YEAR,
        compass: COMPASS,
        milestones: [{ id: "mst_z".padEnd(25, "x"), targetCapital: 0, targetYear: 2030 }],
      }),
    ).toThrow(/targetCapital must be > 0/);
  });
});
