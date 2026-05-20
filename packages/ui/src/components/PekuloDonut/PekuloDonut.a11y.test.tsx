import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloDonut } from "./PekuloDonut";

describe("PekuloDonut a11y", () => {
  it("has no serious/critical violations (decorative SVG)", async () => {
    const { container } = renderWithTamagui(<PekuloDonut pct={0.4} centered />);
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
