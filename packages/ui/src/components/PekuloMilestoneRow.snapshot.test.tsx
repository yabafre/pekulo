import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

describe("PekuloMilestoneRow snapshot", () => {
  it("renders ahead status", () => {
    const { container } = renderWithTamagui(
      <PekuloMilestoneRow
        milestone={{
          label: "1er palier",
          targetEur: 50000,
          targetYear: 2030,
          progressPct: 0.55,
          deltaEur: 1500,
          status: "ahead",
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-32px _height-32px _items-center _justify-center _pos-relative"><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="91.106186954104" stroke-dashoffset="40.9977841293468" stroke-linecap="round" transform="rotate(-90 16 16)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">1er palier</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">50 000&nbsp;€ · 2030</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-success _fs-f-size-body2682 _fw-500">+1 500&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en avance</span></div></div><div style="display: contents;"></div></span>"`);
  });
  it("renders behind status", () => {
    const { container } = renderWithTamagui(
      <PekuloMilestoneRow
        milestone={{
          label: "2e palier",
          targetEur: 100000,
          targetYear: 2035,
          progressPct: 0.2,
          deltaEur: -2300,
          status: "behind",
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-32px _height-32px _items-center _justify-center _pos-relative"><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="91.106186954104" stroke-dashoffset="72.8849495632832" stroke-linecap="round" transform="rotate(-90 16 16)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">2e palier</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">100 000&nbsp;€ · 2035</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-danger _fs-f-size-body2682 _fw-500">−2 300&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en retard</span></div></div><div style="display: contents;"></div></span>"`);
  });
});
