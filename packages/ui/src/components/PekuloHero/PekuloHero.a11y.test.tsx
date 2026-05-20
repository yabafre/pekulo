import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloHero } from "./PekuloHero";

describe("PekuloHero a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHero
        variant="card"
        totalEur={180400}
        aheadEur={21383}
        targetCapital={800000}
        targetYear={2055}
        requiredYearlyEur={21383}
      />,
    );
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
