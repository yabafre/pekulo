import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloProjectionChart } from "./PekuloProjectionChart";

describe("PekuloProjectionChart snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloProjectionChart
        years={[2026, 2030, 2040, 2055]}
        actual={[180, 250, 400, 650]}
        required={[180, 260, 420, 800]}
        nowMarker={{ year: 2026, value: 180 }}
        capMarker={{ year: 2055, value: 800 }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View "><svg width="100%" height="220" viewBox="0 0 600 220" role="img" aria-label="Projection vs cap-required"><path d="M 12 208 L 204 182.70967741935485 L 396 132.1290322580645 L 588 12" stroke="var(--chartPlan)" stroke-width="2" stroke-dasharray="4 4" fill="none"></path><path d="M 12 208 L 204 185.8709677419355 L 396 138.4516129032258 L 588 59.41935483870968" stroke="var(--chartActual)" stroke-width="2" fill="none"></path><circle cx="12" cy="208" r="5" fill="var(--chartActual)"></circle><circle cx="588" cy="12" r="5" fill="none" stroke="var(--chartActual)" stroke-width="2"></circle></svg><div class="is_View _fd-row _justify-space-betwe3241 _mt-c-space-1"><span class="is_Text _col-colorTertia3655 _fs-f-size-11">2026</span><span class="is_Text _col-colorTertia3655 _fs-f-size-11">2055</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
