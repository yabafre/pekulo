import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloKpiTile } from "./PekuloKpiTile";

describe("PekuloKpiTile snapshot", () => {
  it("renders without donut", () => {
    const { container } = renderWithTamagui(
      <PekuloKpiTile label="Cap" valueTop="22%" valueBottom="objectif 2055" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _bg-backgroundC96851 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pt-c-space-4 _pr-c-space-4 _pb-c-space-4 _pl-c-space-4 _grow-1 _shrink-1 _fb-0px _minW-140px"><div class="is_View _fd-row _justify-space-betwe3241 _items-flex-start"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Cap</span></div><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-3">22%</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _mt-2px">objectif 2055</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders with donut", () => {
    const { container } = renderWithTamagui(
      <PekuloKpiTile label="Cap" valueTop="22%" progress={0.22} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _bg-backgroundC96851 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pt-c-space-4 _pr-c-space-4 _pb-c-space-4 _pl-c-space-4 _grow-1 _shrink-1 _fb-0px _minW-140px"><div class="is_View _fd-row _justify-space-betwe3241 _items-flex-start"><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Cap</span><div class="is_View _width-32px _height-32px _items-center _justify-center _pos-relative"><svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="16" cy="16" r="14.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="91.106186954104" stroke-dashoffset="71.06282582420113" stroke-linecap="round" transform="rotate(-90 16 16)"></circle></svg></div></div><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-3">22%</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
