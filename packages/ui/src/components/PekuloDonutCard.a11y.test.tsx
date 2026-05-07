import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloDonutCard } from "./PekuloDonutCard";

describe("PekuloDonutCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloDonutCard title="Compass" pct={0.42} centered />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
