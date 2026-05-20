import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloProjectionChart } from "./PekuloProjectionChart";

describe("PekuloProjectionChart a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloProjectionChart years={[2026, 2055]} actual={[180, 650]} required={[180, 800]} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
