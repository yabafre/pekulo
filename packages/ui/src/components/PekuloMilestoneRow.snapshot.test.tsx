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
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-4 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-36px _height-36px _items-center _justify-center _pos-relative"><svg width="36" height="36" viewBox="0 0 36 36" focusable="false" aria-hidden="true"><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="103.67255756846318" stroke-dashoffset="46.65265090580842" stroke-linecap="round" transform="rotate(-90 18 18)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">1er palier</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">50 000&nbsp;€ · 2030</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-success _fs-f-size-body2682 _fw-500">+1 500&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en avance</span></div></div><div style="display: contents;"></div></span>"`,
    );
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
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-4 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-36px _height-36px _items-center _justify-center _pos-relative"><svg width="36" height="36" viewBox="0 0 36 36" focusable="false" aria-hidden="true"><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="18" cy="18" r="16.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="103.67255756846318" stroke-dashoffset="82.93804605477055" stroke-linecap="round" transform="rotate(-90 18 18)"></circle></svg></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">2e palier</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">100 000&nbsp;€ · 2035</span></div><div class="is_View _items-flex-end"><span class="is_Text _col-danger _fs-f-size-body2682 _fw-500">−2 300&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">en retard</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
