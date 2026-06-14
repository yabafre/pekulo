import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";

describe("PekuloHypothesisVerdict snapshot", () => {
  it("renders reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-1"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Tu atteins ton cap en 2055.</span><span class="is_Text _col-success _fs-f-size-capt104456 _fw-500">+20 000&nbsp;€ vs cap requis</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders not-reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={650000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-1"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Tu n'atteins pas ton cap en 2055.</span><span class="is_Text _col-danger _fs-f-size-capt104456 _fw-500">−150 000&nbsp;€ vs cap requis</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders the €/month gap line when not reaching", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict
        projectedEur={650000}
        requiredEur={800000}
        targetYear={2055}
        gapEurPerMonth={120}
      />,
    );
    // The shortfall line is present and grayscale ($colorTertiary), the delta
    // stays $danger. Assert structurally so the snapshot stays the SSOT.
    expect(container.innerHTML).toContain("Il manque");
    expect(container.innerHTML).toContain("/ mois pour atteindre le cap.");
    expect(container.innerHTML).toContain("_col-danger");
  });
});
