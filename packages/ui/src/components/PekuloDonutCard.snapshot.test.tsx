import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDonutCard } from "./PekuloDonutCard";

describe("PekuloDonutCard snapshot", () => {
  it("renders with title + centered donut", () => {
    const { container } = renderWithTamagui(
      <PekuloDonutCard title="Compass" pct={0.42} centered />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><section aria-label="Compass" class="is_View _pt-_lg_c-space-6 _pr-_lg_c-space-6 _pb-_lg_c-space-6 _pl-_lg_c-space-6 _bg-backgroundC96851 _btlr-c-radius-xl _btrr-c-radius-xl _bbrr-c-radius-xl _bblr-c-radius-xl _pt-c-space-5 _pr-c-space-5 _pb-c-space-5 _pl-c-space-5"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _mb-c-space-4"><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Compass</span></div><div class="is_View _width-96px _height-96px _items-center _justify-center _pos-relative"><svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutTrack)" stroke-width="8"></circle><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutFill)" stroke-width="8" stroke-dasharray="276.46015351590177" stroke-dashoffset="160.34688903922304" stroke-linecap="round" transform="rotate(-90 48 48)"></circle></svg><div class="is_View _pos-absolute _items-center _justify-center"><span class="is_Text _col-color _fs-32--64px _fw-600">42%</span></div></div></section><div style="display: contents;"></div></span>"`);
  });
});
