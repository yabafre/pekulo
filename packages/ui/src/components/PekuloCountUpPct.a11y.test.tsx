import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloCountUpPct } from "./PekuloCountUpPct";

describe("PekuloCountUpPct a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloCountUpPct value={0.42} />);
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
