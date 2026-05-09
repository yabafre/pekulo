// Pure helper for the compass-progress curve (FR-7, story 1-3). Consumes a
// compass, the curve start date (earliest compass_history.valuedOn), an
// injected `today`, and a list of wealth snapshots; returns the deduped,
// sorted plan + actual arrays. No I/O, no clock reads — `today` is a
// parameter so callers can pin determinism (story §"Testing approach").
//
// Plan formula (story 1-3 §"Plan formula", locked for AC-1, AC-2, AC-10):
//   horizonInDays = compass.horizonYears × 365.25
//   endDate       = startDate + horizonInDays × 86_400_000 ms
//   planEur(at)   = compass.objectif × clamp((at - startDate) /
//                   (endDate - startDate), 0, 1)
// Plan sample dates (deduped, sorted ascending):
//   startDate (always — eur = 0)
//   today     (always — eur = planEur(today); 0 when today < startDate)
//   endDate   (always — eur = compass.objectif)
//   each snapshots[i].at when snapshots is non-empty (keeps plan + actual
//   aligned at the same dates so AC-1 can deeply-equal a plan point with
//   its matching actual).
// Dedup: two adjacent points with equal at.getTime() collapse to the first.

import type { Compass, CompassCurve, WealthSnapshot } from "@pekulo/types";
import { CompassError } from "../../modules/compass/compass.errors";

export interface ComputeCompassCurveInput {
  compass: Compass;
  startDate: Date;
  today: Date;
  snapshots: WealthSnapshot[];
}

const MS_PER_DAY = 86_400_000;
const DAYS_PER_YEAR = 365.25;

export function computeCompassCurve(input: ComputeCompassCurveInput): CompassCurve {
  const { compass, startDate, today, snapshots } = input;

  // Guards mirror compute-progress.ts (story 1-1): defense in depth even
  // though the route boundary already validates via updateCompassInputSchema.
  if (!Number.isFinite(compass.objectif) || compass.objectif <= 0) {
    throw new CompassError("INVALID_TARGET", "objectif must be a finite number > 0");
  }
  if (!Number.isFinite(compass.horizonYears) || compass.horizonYears <= 0) {
    throw new CompassError("INVALID_TARGET", "horizonYears must be a finite number > 0");
  }
  for (const s of snapshots) {
    if (!Number.isFinite(s.totalEur) || s.totalEur < 0) {
      throw new CompassError("INVALID_WEALTH", "snapshot totalEur must be a finite number >= 0");
    }
  }

  const startMs = startDate.getTime();
  const endMs = startMs + compass.horizonYears * DAYS_PER_YEAR * MS_PER_DAY;
  const span = endMs - startMs;

  const planEurAt = (at: Date): number => {
    // Clock-skew clamp: today < startDate degenerates to the flat zero-line
    // at today (story §"Plan formula" — do NOT throw; recoverable).
    const ratio = (at.getTime() - startMs) / span;
    const clamped = Math.max(0, Math.min(1, ratio));
    return compass.objectif * clamped;
  };

  // actual[]: snapshots sorted ascending by at.getTime(), totalEur copied to
  // eur (already coerced from Decimal at the wealth-provider boundary, L24).
  const actual = [...snapshots]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((s) => ({ at: s.at, eur: s.totalEur }));

  // plan[]: insertion order startDate < snapshots < today < endDate, sorted
  // ascending, then dedup of adjacent equal-time points.
  const planRaw: { at: Date; eur: number }[] = [
    { at: startDate, eur: 0 },
    ...actual.map((a) => ({ at: a.at, eur: planEurAt(a.at) })),
    { at: today, eur: planEurAt(today) },
    { at: new Date(endMs), eur: compass.objectif },
  ];
  planRaw.sort((a, b) => a.at.getTime() - b.at.getTime());
  const plan: { at: Date; eur: number }[] = [];
  for (const p of planRaw) {
    const last = plan[plan.length - 1];
    if (last && last.at.getTime() === p.at.getTime()) continue;
    plan.push(p);
  }

  return {
    startedAt: startDate,
    actual,
    plan,
  };
}
