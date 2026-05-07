import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloMonthlyRow } from "./PekuloMonthlyRow";

describe("PekuloMonthlyRow snapshot", () => {
  it("renders open positive net", () => {
    const { container } = renderWithTamagui(
      <PekuloMonthlyRow
        month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500 _tt-capitalize">mai 2026</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">+3 200&nbsp;€ · −2 150&nbsp;€</span></div><span class="is_Text _col-success _fs-f-size-body2682 _fw-500">+1 050&nbsp;€</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders closed negative net", () => {
    const { container } = renderWithTamagui(
      <PekuloMonthlyRow
        month={{
          monthLabel: "avril 2026",
          incomeEur: 3200,
          spendingEur: 3500,
          netEur: -300,
          closed: true,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500 _tt-capitalize">avril 2026</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">+3 200&nbsp;€ · −3 500&nbsp;€</span></div><span class="is_Text _col-danger _fs-f-size-body2682 _fw-500">−300&nbsp;€</span><div class="is_View _fd-row _items-center _gap-c-space-1 _pr-c-space-2 _pl-c-space-2 _pt-3px _pb-3px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-11">Clôturé</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
