import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloMilestonesCard } from "./PekuloMilestonesCard";

describe("PekuloMilestonesCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloMilestonesCard
        milestones={[
          {
            label: "Apport résidence principale",
            targetEur: 60000,
            targetYear: 2030,
            progressPct: 0.4,
            deltaEur: 1200,
            status: "ahead",
          },
        ]}
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
