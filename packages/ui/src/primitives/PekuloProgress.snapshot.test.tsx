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
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div aria-valuemax="100" aria-valuemin="0" aria-valuenow="60" aria-valuetext="60%" role="progressbar" data-state="loading" data-value="60" data-max="100" aria-label="Progression" data-disable-theme="true" class="is_Progress is_View _fd-column _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _ox-hidden _oy-hidden _bg-backgroundM3600254 _height-6px"><div data-state="loading" data-value="60" data-max="100" data-disable-theme="true" class="is_ProgressIndicator is_View _fd-column _height-10037 _width-20037 _bg-color _tr-translateX-38626661" style="transition: transform 150ms cubic-bezier(0.25, 0.1, 0.25, 1);"></div></div><div style="display: contents;"></div></span>"`);
  });
});
