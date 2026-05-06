import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

describe("PekuloMilestoneRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloMilestoneRow
        milestone={{
          label: "Palier",
          targetEur: 50000,
          targetYear: 2030,
          progressPct: 0.5,
          deltaEur: 0,
          status: "on-track",
        }}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
