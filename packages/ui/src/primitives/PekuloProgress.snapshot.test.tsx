import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloProgress } from "./PekuloProgress";

describe("PekuloProgress snapshot", () => {
  it("renders 60%", () => {
    const { container } = renderWithTamagui(
      <PekuloProgress value={60} aria-label="Progression">
        <PekuloProgress.Indicator />
      </PekuloProgress>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" aria-label="Progression" data-slot="progress" style="position: relative; width: 100%; height: 6px; background-color: var(--backgroundMuted); border-radius: 9999px; overflow: hidden;"><div data-slot="progress-indicator" style="width: 60%; height: 100%; background-color: var(--color); border-radius: 9999px; transition: width 300ms ease-out;"></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
