import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSlider } from "./PekuloSlider";

describe("PekuloSlider snapshot", () => {
  it("renders default value", () => {
    const { container } = renderWithTamagui(
      <PekuloSlider
        value={[40]}
        max={100}
        step={1}
        onValueChange={vi.fn()}
        aria-label="Versement"
      >
        <PekuloSlider.Track>
          <PekuloSlider.TrackActive />
        </PekuloSlider.Track>
        <PekuloSlider.Thumb index={0} />
      </PekuloSlider>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
