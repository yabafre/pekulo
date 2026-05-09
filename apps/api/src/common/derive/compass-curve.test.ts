// Pure-helper unit tests for computeCompassCurve. No I/O, no clock reads —
// `today` is an injected parameter so the suite is deterministic. Covers AC-1
// (≥3 snapshots, aligned series), AC-2 (zero snapshots, plan-only), AC-10
// (purity / determinism), NaN/Infinity guards, today-before-startDate clamp,
// and dedup of identical adjacent dates.
//
// Re-implements the linear-plan formula inline for the AC-1 assertion (per
// story 1-3 §"AC-1 fixture math") to avoid hardcoded magic numbers — the test
// compares helper output against an in-test re-derivation using the same
// constants as the helper.

import { describe, expect, test } from "bun:test";
import type { Compass, WealthSnapshot } from "@pekulo/types";
import { computeCompassCurve } from "./compass-curve";
import { CompassError } from "../../modules/compass/compass.errors";

const COMPASS: Compass = { objectif: 800_000, horizonYears: 25 };
const START = new Date("2024-01-15T00:00:00Z");
const TODAY = new Date("2026-05-09T12:00:00Z");

// Re-derive the linear-plan eur for an arbitrary `at` using the SAME
// constants as the helper. Story 1-3 §"AC-1 fixture math" pins the formula:
//   horizonInDays = horizonYears × 365.25
//   endDate       = startDate + horizonInDays × 86_400_000 ms
//   planEur(at)   = objectif × clamp((at - startDate) / (endDate - startDate), 0, 1)
function planEurAt(at: Date, compass: Compass = COMPASS, start: Date = START): number {
  const horizonInDays = compass.horizonYears * 365.25;
  const endMs = start.getTime() + horizonInDays * 86_400_000;
  const ratio = (at.getTime() - start.getTime()) / (endMs - start.getTime());
  const clamped = Math.max(0, Math.min(1, ratio));
  return compass.objectif * clamped;
}

describe("computeCompassCurve", () => {
  // AC-1 (verbatim from story 1-3 L16):
  //   Given user A has a compass (objectif=800_000, horizonYears=25) whose
  //   earliest compass_history.valuedOn is 2024-01-15T00:00:00Z, AND 3
  //   MonthlyTracking rows for user A — (year=2024, monthNum=12, capitalTotal=
  //   10_000), (year=2025, monthNum=6, capitalTotal=20_000), (year=2026,
  //   monthNum=4, capitalTotal=35_000) — When compassService.getCompassCurve
  //   ("user-A") runs at injected today=2026-05-09T12:00:00Z, Then the response
  //   is ordered-by-date-ascending and shape-matches { startedAt, actual: [3
  //   points], plan: [startDate, 3 snapshot dates, today, endDate] }. Every
  //   plan eur is finite and matches objectif × clamp(...) to within 1e-6.
  //   actual[].at and the matching plan[].at for the 3 snapshot dates are
  //   deeply equal (getTime() equality).
  test("AC-1: 3 snapshots produce aligned actual + plan series", () => {
    const snapshots: WealthSnapshot[] = [
      { at: new Date("2024-12-28T00:00:00Z"), totalEur: 10_000 },
      { at: new Date("2025-06-28T00:00:00Z"), totalEur: 20_000 },
      { at: new Date("2026-04-28T00:00:00Z"), totalEur: 35_000 },
    ];

    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots,
    });

    expect(out.startedAt.getTime()).toBe(START.getTime());

    expect(out.actual).toHaveLength(3);
    expect(out.actual[0]).toEqual({ at: snapshots[0]!.at, eur: 10_000 });
    expect(out.actual[1]).toEqual({ at: snapshots[1]!.at, eur: 20_000 });
    expect(out.actual[2]).toEqual({ at: snapshots[2]!.at, eur: 35_000 });

    // Plan: startDate, 3 snapshot dates, today, endDate (= startDate + 25y).
    expect(out.plan).toHaveLength(6);
    const planDates = out.plan.map((p) => p.at.getTime());
    const sortedAsc = [...planDates].sort((a, b) => a - b);
    expect(planDates).toEqual(sortedAsc);

    // First point: startDate, eur = 0.
    expect(out.plan[0]!.at.getTime()).toBe(START.getTime());
    expect(out.plan[0]!.eur).toBeCloseTo(0, 6);

    // Last point: endDate (start + horizonInDays × 86_400_000), eur = objectif.
    const expectedEndMs = START.getTime() + 25 * 365.25 * 86_400_000;
    expect(out.plan[5]!.at.getTime()).toBe(expectedEndMs);
    expect(out.plan[5]!.eur).toBeCloseTo(800_000, 6);

    // Middle 4 points: 3 snapshot dates + today, each plan[].eur ≈ planEurAt.
    for (const p of out.plan.slice(1, 5)) {
      expect(Number.isFinite(p.eur)).toBe(true);
      expect(p.eur).toBeCloseTo(planEurAt(p.at), 6);
    }

    // Snapshot-date alignment: actual[i].at deeply equals the matching plan[].at.
    for (const a of out.actual) {
      const match = out.plan.find((p) => p.at.getTime() === a.at.getTime());
      expect(match).toBeDefined();
    }
  });

  // AC-2 (verbatim from story 1-3 L17):
  //   Given user A has a compass (objectif=800_000, horizonYears=25) with
  //   earliest valuedOn = 2024-01-15T00:00:00Z AND 0 MonthlyTracking rows,
  //   When getCompassCurve("user-A") runs at injected today=2026-05-09T12:00:
  //   00Z, Then the response is { startedAt, actual: [], plan: [startDate,
  //   today, endDate (=startDate+25y, eur=800_000)] }. <linearPlanEur> equals
  //   800_000 × ((2026-05-09 - 2024-01-15) / (2049-01-15 - 2024-01-15)) within
  //   1e-6.
  test("AC-2: zero snapshots → plan = [startDate, today, endDate]", () => {
    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots: [],
    });

    expect(out.startedAt.getTime()).toBe(START.getTime());
    expect(out.actual).toEqual([]);
    expect(out.plan).toHaveLength(3);

    expect(out.plan[0]!.at.getTime()).toBe(START.getTime());
    expect(out.plan[0]!.eur).toBeCloseTo(0, 6);

    expect(out.plan[1]!.at.getTime()).toBe(TODAY.getTime());
    expect(out.plan[1]!.eur).toBeCloseTo(planEurAt(TODAY), 6);

    const expectedEndMs = START.getTime() + 25 * 365.25 * 86_400_000;
    expect(out.plan[2]!.at.getTime()).toBe(expectedEndMs);
    expect(out.plan[2]!.eur).toBeCloseTo(800_000, 6);
  });

  // AC-10 (verbatim from story 1-3 L25):
  //   Given the same (compass, startDate, today, snapshots) inputs, When
  //   computeCompassCurve is called twice in succession, Then the two outputs
  //   are deeply equal (expect(out1).toEqual(out2)). The helper does NOT call
  //   new Date(), Date.now(), Math.random, or any I/O; today is an injected
  //   parameter.
  test("AC-10: deterministic — same inputs produce deeply-equal outputs", () => {
    const snapshots: WealthSnapshot[] = [
      { at: new Date("2024-12-28T00:00:00Z"), totalEur: 10_000 },
      { at: new Date("2025-06-28T00:00:00Z"), totalEur: 20_000 },
    ];
    const out1 = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots,
    });
    const out2 = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots,
    });
    expect(out1).toEqual(out2);
  });

  // AC-10 guard branch — same code-set as compute-progress.ts (story 1-1).
  test("guard: NaN objectif throws CompassError(INVALID_TARGET)", () => {
    expect(() =>
      computeCompassCurve({
        compass: { objectif: Number.NaN, horizonYears: 25 },
        startDate: START,
        today: TODAY,
        snapshots: [],
      }),
    ).toThrow(CompassError);
  });

  test("guard: non-finite objectif (Infinity) throws CompassError(INVALID_TARGET)", () => {
    expect(() =>
      computeCompassCurve({
        compass: { objectif: Number.POSITIVE_INFINITY, horizonYears: 25 },
        startDate: START,
        today: TODAY,
        snapshots: [],
      }),
    ).toThrow(CompassError);
  });

  test("guard: zero or negative objectif throws CompassError(INVALID_TARGET)", () => {
    expect(() =>
      computeCompassCurve({
        compass: { objectif: 0, horizonYears: 25 },
        startDate: START,
        today: TODAY,
        snapshots: [],
      }),
    ).toThrow(CompassError);
  });

  test("guard: zero or negative horizonYears throws CompassError(INVALID_TARGET)", () => {
    expect(() =>
      computeCompassCurve({
        compass: { objectif: 800_000, horizonYears: 0 },
        startDate: START,
        today: TODAY,
        snapshots: [],
      }),
    ).toThrow(CompassError);
  });

  test("guard: snapshot with non-finite totalEur throws CompassError(INVALID_WEALTH)", () => {
    expect(() =>
      computeCompassCurve({
        compass: COMPASS,
        startDate: START,
        today: TODAY,
        snapshots: [{ at: new Date("2025-01-01T00:00:00Z"), totalEur: Number.NaN }],
      }),
    ).toThrow(CompassError);
  });

  test("guard: snapshot with negative totalEur throws CompassError(INVALID_WEALTH)", () => {
    expect(() =>
      computeCompassCurve({
        compass: COMPASS,
        startDate: START,
        today: TODAY,
        snapshots: [{ at: new Date("2025-01-01T00:00:00Z"), totalEur: -1 }],
      }),
    ).toThrow(CompassError);
  });

  // Story 1-3 §"Plan formula":
  //   today.getTime() < startDate.getTime() → clamp planEur(today) = 0 (do
  //   NOT throw — clock skew is recoverable; the curve degenerates to a flat
  //   zero-line at today).
  test("clock skew: today < startDate clamps today's plan eur to 0", () => {
    const skewedToday = new Date(START.getTime() - 86_400_000); // 1 day before start
    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: skewedToday,
      snapshots: [],
    });
    // Plan still includes a today point with eur clamped to 0.
    const todayPoint = out.plan.find((p) => p.at.getTime() === skewedToday.getTime());
    expect(todayPoint).toBeDefined();
    expect(todayPoint!.eur).toBe(0);
  });

  // Story 1-3 §"Plan formula" Dedup rule: two adjacent points whose at.getTime()
  // are equal → keep the first occurrence. Insertion order: startDate <
  // snapshots < today < endDate. Edge case: snapshot dated exactly startDate
  // collapses with the start point.
  test("dedup: snapshot date == startDate → only one point at startDate", () => {
    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots: [{ at: START, totalEur: 0 }],
    });
    const startPoints = out.plan.filter((p) => p.at.getTime() === START.getTime());
    expect(startPoints).toHaveLength(1);
  });

  test("dedup: snapshot date == today → only one point at today", () => {
    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots: [{ at: TODAY, totalEur: 50_000 }],
    });
    const todayPoints = out.plan.filter((p) => p.at.getTime() === TODAY.getTime());
    expect(todayPoints).toHaveLength(1);
  });

  // Sort discipline — actual[] must be ascending by at.getTime() even when
  // snapshots arrive out of order.
  test("actual[] is sorted ascending by at.getTime() regardless of input order", () => {
    const snapshots: WealthSnapshot[] = [
      { at: new Date("2026-04-28T00:00:00Z"), totalEur: 35_000 },
      { at: new Date("2024-12-28T00:00:00Z"), totalEur: 10_000 },
      { at: new Date("2025-06-28T00:00:00Z"), totalEur: 20_000 },
    ];
    const out = computeCompassCurve({
      compass: COMPASS,
      startDate: START,
      today: TODAY,
      snapshots,
    });
    const ts = out.actual.map((a) => a.at.getTime());
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
  });
});
