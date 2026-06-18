import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloHypothesisCard } from "./PekuloHypothesisCard";

const eur0 = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

describe("PekuloHypothesisCard snapshot", () => {
  it("renders reaches scenario", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisCard
        reaches
        headline="Tu atteins ton cap en 2055."
        deltaLabel={`+${eur0.format(20000)} vs cap requis`}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="Hypothèse" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Hypothèse</span></div><div class="is_View _fd-column _gap-c-space-1"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Tu atteins ton cap en 2055.</span><span class="is_Text _col-success _fs-f-size-capt104456 _fw-500">+20 000&nbsp;€ vs cap requis</span></div></section><div style="display: contents;"></div></span>"`,
    );
  });
});
