import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloHeroCard } from "./PekuloHeroCard";

describe("PekuloHeroCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHeroCard
        totalEur={180400}
        aheadEur={2400}
        targetCapital={500000}
        targetYear={2055}
        requiredYearlyEur={21400}
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
