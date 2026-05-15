import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloMilestonesCard } from "./PekuloMilestonesCard";

describe("PekuloMilestonesCard snapshot", () => {
  it("renders 2 milestones", () => {
    const { container } = renderWithTamagui(
      <PekuloMilestonesCard
        milestones={[
          {
            label: "Apport résidence principale",
            targetEur: 60000,
            targetYear: 2030,
            progressPct: 0.4,
            deltaEur: 1200,
            status: "ahead",
          },
          {
            label: "Liberté financière",
            targetEur: 500000,
            targetYear: 2055,
            progressPct: 0.18,
            deltaEur: -3400,
            status: "behind",
          },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><section aria-label="Paliers" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Paliers</span></div><div class="is_View _fd-column"><div class="is_View _fd-row _items-center _gap-c-space-4 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-36px _height-36px _items-center _justify-center _pos-relative"><svg width="36" height="36" viewBox="0 0 36 36" focusable="false" aria-hidden="true"><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="103.67255756846318" stroke-dashoffset="62.2035345410779" stroke-linecap="round" transform="rotate(-90 18 18)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Apport résidence principale</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">60 000&nbsp;€ · 2030</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-success _fs-f-size-body2682 _fw-500">+1 200&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en avance</span></div></div><div class="is_View _fd-row _items-center _gap-c-space-4 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-36px _height-36px _items-center _justify-center _pos-relative"><svg width="36" height="36" viewBox="0 0 36 36" focusable="false" aria-hidden="true"><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="103.67255756846318" stroke-dashoffset="85.01149720613981" stroke-linecap="round" transform="rotate(-90 18 18)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Liberté financière</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">500 000&nbsp;€ · 2055</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-danger _fs-f-size-body2682 _fw-500">−3 400&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en retard</span></div></div></div></section><div style="display: contents;"></div></span>"`,
    );
  });
});
