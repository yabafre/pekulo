/**
 * Year-by-year projected-wealth curve (story 7-3, FR-58). Offset-indexed and
 * clock-free: `year` is the number of whole years from now (0 = today,
 * horizonYears = the final year). The web/UI layer maps the offset to a
 * calendar year (e.g. 2026 + year) at render time — the derive never reads a
 * clock. `eur` is the projected total wealth at the end of that year.
 */
export interface HypothesisProjectionPoint {
  year: number;
  eur: number;
}

/**
 * Output of `computeProjectionCurve` (apps/api/src/common/derive/projection-curve.ts).
 * `points` has length `horizonYears + 1`; `points[0].eur === currentWealthEur`;
 * `finalEur === points[horizonYears].eur`. Iso with `hypothesisProjectionSchema`
 * in @pekulo/validators (kept in lock-step by hand, like CompassCurve).
 */
export interface HypothesisProjection {
  currentWealthEur: number;
  monthlyContribution: number;
  annualRate: number;
  horizonYears: number;
  points: HypothesisProjectionPoint[];
  finalEur: number;
}

/**
 * FR-59 comparison output (story 7-4). The projected-vs-compass gap, surfaced
 * as the extra €/month needed to reach the cap. `requiredPoints` is the LINEAR
 * compass-required ramp, offset-indexed like HypothesisProjection.points
 * (point[0].eur === currentWealthEur, point[horizonYears].eur === requiredFinalEur).
 * The projected curve itself stays the 7-3 HypothesisProjection (the web card
 * reads it from useHypothesisProjection). Iso with `hypothesisGapSchema` in
 * @pekulo/validators (kept in lock-step by hand, like HypothesisProjection).
 */
export interface HypothesisGap {
  /** Extra monthly contribution to close the shortfall; 0 when reachesCap. */
  gapEurPerMonth: number;
  /** projectedFinalEur >= requiredFinalEur. */
  reachesCap: boolean;
  /** Projected wealth at the horizon (= HypothesisProjection.finalEur). */
  projectedFinalEur: number;
  /** The compass target capital (objectif). */
  requiredFinalEur: number;
  /** Signed: projectedFinalEur − requiredFinalEur. */
  deltaAtCapEur: number;
  horizonYears: number;
  /** Linear compass-required ramp, offset-indexed (length horizonYears + 1). */
  requiredPoints: HypothesisProjectionPoint[];
}
