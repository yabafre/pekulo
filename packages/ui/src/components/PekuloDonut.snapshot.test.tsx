import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDonut } from "./PekuloDonut";

describe("PekuloDonut snapshot", () => {
  it("renders default (50% no label)", () => {
    const { container } = renderWithTamagui(<PekuloDonut pct={0.5} />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _width-96px _height-96px _items-center _justify-center _pos-relative"><svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutTrack)" stroke-width="8"></circle><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutFill)" stroke-width="8" stroke-dasharray="276.46015351590177" stroke-dashoffset="138.23007675795088" stroke-linecap="round" transform="rotate(-90 48 48)"></circle></svg></div><div style="display: contents;"></div></span>"`);
  });
  it("renders centered label variant", () => {
    const { container } = renderWithTamagui(<PekuloDonut pct={0.72} centered />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _width-96px _height-96px _items-center _justify-center _pos-relative"><svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true" focusable="false"><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutTrack)" stroke-width="8"></circle><circle cx="48" cy="48" r="44" fill="none" stroke="var(--donutFill)" stroke-width="8" stroke-dasharray="276.46015351590177" stroke-dashoffset="77.4088429844525" stroke-linecap="round" transform="rotate(-90 48 48)"></circle></svg><div class="is_View _pos-absolute _items-center _justify-center"><span class="is_Text _col-color _fs-32--64px _fw-600">72%</span></div></div><div style="display: contents;"></div></span>"`);
  });
});
