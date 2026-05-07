import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloAccountsSection } from "./PekuloAccountsSection";

describe("PekuloAccountsSection snapshot", () => {
  it("renders 3 accounts + total liquide footer", () => {
    const { container } = renderWithTamagui(
      <PekuloAccountsSection
        accounts={[
          { label: "Livret A", type: "livret", institution: "Bourso", balanceEur: 15000 },
          { label: "PEA Bourso", type: "pea", institution: "Boursorama", balanceEur: 45200 },
          { label: "CTO", type: "cto", balanceEur: 12000 },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><section aria-label="Comptes" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Comptes</span></div><div class="is_View _fd-column"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Livret A</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Livret · Bourso</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">15 000&nbsp;€</span></div><div class="is_View _fd-row _items-center _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">PEA Bourso</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">PEA · Boursorama</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">45 200&nbsp;€</span></div><div class="is_View _fd-row _items-center _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">CTO</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CTO</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">12 000&nbsp;€</span></div></div><div class="is_View _fd-row _items-center _justify-space-betwe3241 _pt-c-space-3 _mt-c-space-2 _btw-1px _btc-borderDefau3464 _brc-borderDefau3464 _borderBottomColor-borderDefau3464 _borderLeftColor-borderDefau3464 _bts-solid"><span class="is_Text _col-colorTertia3655 _fs-f-size-capt104456">Total liquide</span><span class="is_Text _col-color _fs-f-size-body2682 _fw-600">72 200&nbsp;€</span></div></section><div style="display: contents;"></div></span>"`);
  });
});
