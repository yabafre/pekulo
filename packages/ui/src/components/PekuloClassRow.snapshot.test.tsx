import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloClassRow } from "./PekuloClassRow";

describe("PekuloClassRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloClassRow label="ETF" amountEur={62000} pct={0.55} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _width-28px _height-28px _items-center _justify-center _pos-relative"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--donutTrack)" stroke-width="3"></circle><circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--donutFill)" stroke-width="3" stroke-dasharray="78.53981633974483" stroke-dashoffset="35.34291735288517" stroke-linecap="round" transform="rotate(-90 14 14)"></circle></svg></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500 _grow-1 _shrink-1 _fb-0px">ETF</span><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">62 000&nbsp;€</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">55%</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
