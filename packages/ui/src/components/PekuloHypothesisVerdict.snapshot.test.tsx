import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";

describe("PekuloHypothesisVerdict snapshot", () => {
  it("renders reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-1"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Tu atteins ton cap en 2055.</span><span class="is_Text _col-success _fs-f-size-capt104456 _fw-500">+20 000&nbsp;€ vs cap requis</span></div><div style="display: contents;"></div></span>"`);
  });
  it("renders not-reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={650000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-1"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Tu n'atteins pas ton cap en 2055.</span><span class="is_Text _col-danger _fs-f-size-capt104456 _fw-500">−150 000&nbsp;€ vs cap requis</span></div><div style="display: contents;"></div></span>"`);
  });
});
