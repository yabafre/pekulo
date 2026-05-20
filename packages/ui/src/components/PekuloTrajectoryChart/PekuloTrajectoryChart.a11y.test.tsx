import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloTrajectoryChart } from "./PekuloTrajectoryChart";

describe("PekuloTrajectoryChart a11y", () => {
  it("has no serious/critical violations (svg has aria-label)", async () => {
    const { container } = renderWithTamagui(
      <PekuloTrajectoryChart months={[1, 2, 3]} actual={[100, 110, 120]} plan={[100, 105, 110]} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
