import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSlider } from "./PekuloSlider";

describe("PekuloSlider a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSlider
        value={[40]}
        max={100}
        onValueChange={vi.fn()}
        aria-label="Versement mensuel"
      >
        <PekuloSlider.Track>
          <PekuloSlider.TrackActive />
        </PekuloSlider.Track>
        <PekuloSlider.Thumb index={0} aria-label="Versement mensuel" />
      </PekuloSlider>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
