import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHero } from "./PekuloHero";

describe("PekuloHero snapshot", () => {
  it("renders mobile variant", () => {
    const { container } = renderWithTamagui(<PekuloHero totalEur={180400} aheadEur={21383} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _width-10037"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Patrimoine total</span><span class="is_Text _col-color _fs-f-size-hero _fw-600 _ls--0--5px _mt-c-space-2">180 400&nbsp;€</span><div class="is_View _fd-row _items-baseline _gap-6px _mt-c-space-2"><span class="is_Text _col-accent _fs-f-size-body2682 _fw-500">+21 383&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-body2682">vs plan · 12 mois</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders card variant with cap stats", () => {
    const { container } = renderWithTamagui(
      <PekuloHero
        variant="card"
        totalEur={180400}
        aheadEur={21383}
        targetCapital={800000}
        targetYear={2055}
        requiredYearlyEur={21383}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _width-10037"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Patrimoine total</span><span class="is_Text _col-color _fs-f-size-hero _fw-600 _ls--0--5px _mt-c-space-2">180 400&nbsp;€</span><div class="is_View _fd-row _items-baseline _gap-6px _mt-c-space-2"><span class="is_Text _col-accent _fs-f-size-body2682 _fw-500">+21 383&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-body2682">vs plan · 12 mois</span></div><div class="is_View _fd-row _gap-c-space-8 _mt-c-space-8"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Cap</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">800 000&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en 2055</span></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Plan / an</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">21,4&nbsp;k €</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">linéaire</span></div></div></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders negative delta", () => {
    const { container } = renderWithTamagui(<PekuloHero totalEur={140000} aheadEur={-5000} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _width-10037"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Patrimoine total</span><span class="is_Text _col-color _fs-f-size-hero _fw-600 _ls--0--5px _mt-c-space-2">140 000&nbsp;€</span><div class="is_View _fd-row _items-baseline _gap-6px _mt-c-space-2"><span class="is_Text _col-accent _fs-f-size-body2682 _fw-500">−5 000&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-body2682">vs plan · 12 mois</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
