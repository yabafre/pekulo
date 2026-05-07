import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHeroCard } from "./PekuloHeroCard";

describe("PekuloHeroCard snapshot", () => {
  it("renders with hero variant=card content", () => {
    const { container } = renderWithTamagui(
      <PekuloHeroCard
        totalEur={180400}
        aheadEur={2400}
        targetCapital={500000}
        targetYear={2055}
        requiredYearlyEur={21400}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="Patrimoine" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _width-10037"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Patrimoine total</span><span class="is_Text _col-color _fs-f-size-hero _fw-600 _ls--0--5px _mt-c-space-2">180 400&nbsp;€</span><div class="is_View _fd-row _items-baseline _gap-6px _mt-c-space-2"><span class="is_Text _col-accent _fs-f-size-body2682 _fw-500">+2 400&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-body2682">vs plan · 12 mois</span></div><div class="is_View _fd-row _gap-c-space-8 _mt-c-space-8"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Cap</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">500 000&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en 2055</span></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Plan / an</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">21,4&nbsp;k €</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">linéaire</span></div></div></div></section><div style="display: contents;"></div></span>"`,
    );
  });
});
