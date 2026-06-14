import type { HypothesisGapDto, HypothesisProjectionDto } from "@pekulo/validators";

export interface ProjectionChartModel {
  years: number[];
  actual: number[];
  required: number[];
  nowMarker: { year: number; value: number };
  capMarker: { year: number; value: number };
}

// Story 7-4 (AC-9) — map the offset-indexed 7-3 projection + the FR-59 required
// ramp onto a calendar-year axis. baseYear is the current calendar year (the
// ONLY clock read, in the web layer; the api derives stay clock-free). actual
// = projected curve; required = compass ramp. Both are length horizonYears + 1.
export function buildChartModel(
  projection: HypothesisProjectionDto,
  gap: HypothesisGapDto,
  baseYear: number,
  currentWealthEur: number,
): ProjectionChartModel {
  const years = gap.requiredPoints.map((p) => baseYear + p.year);
  // Defensive: `actual` comes from a SEPARATE projection read; clamp it to the
  // required-ramp length so a transient horizon-edit race between the two reads
  // can't misalign the two series on the shared x-axis (aped-review F2, 7-4).
  return {
    years,
    actual: projection.points.slice(0, years.length).map((p) => p.eur),
    required: gap.requiredPoints.map((p) => p.eur),
    nowMarker: { year: baseYear, value: currentWealthEur },
    capMarker: { year: baseYear + gap.horizonYears, value: gap.requiredFinalEur },
  };
}
