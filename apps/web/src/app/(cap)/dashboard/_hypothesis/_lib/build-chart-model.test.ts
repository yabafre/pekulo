import { describe, expect, it } from "vitest";
import { buildChartModel } from "./build-chart-model";

describe("buildChartModel", () => {
  it("maps offsets to calendar years and splits the two series (AC-9)", () => {
    const projection = {
      currentWealthEur: 60_000,
      monthlyContribution: 1_000,
      annualRate: 0.05,
      horizonYears: 2,
      points: [
        { year: 0, eur: 60_000 },
        { year: 1, eur: 80_000 },
        { year: 2, eur: 100_000 },
      ],
      finalEur: 100_000,
    };
    const gap = {
      gapEurPerMonth: 120,
      reachesCap: false,
      projectedFinalEur: 100_000,
      requiredFinalEur: 200_000,
      deltaAtCapEur: -100_000,
      horizonYears: 2,
      requiredPoints: [
        { year: 0, eur: 60_000 },
        { year: 1, eur: 130_000 },
        { year: 2, eur: 200_000 },
      ],
    };
    const model = buildChartModel(projection, gap, 2026, 60_000);
    expect(model.years).toEqual([2026, 2027, 2028]);
    expect(model.actual).toEqual([60_000, 80_000, 100_000]);
    expect(model.required).toEqual([60_000, 130_000, 200_000]);
    expect(model.nowMarker).toEqual({ year: 2026, value: 60_000 });
    expect(model.capMarker).toEqual({ year: 2028, value: 200_000 });
  });
});
