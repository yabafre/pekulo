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
