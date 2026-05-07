import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloTrajectoryCard } from "./PekuloTrajectoryCard";

describe("PekuloTrajectoryCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloTrajectoryCard months={[0, 6, 12]} actual={[100, 110, 120]} plan={[100, 105, 110]} />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
