import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloCountUpPct } from "./PekuloCountUpPct";

describe("PekuloCountUpPct snapshot", () => {
  it("renders default (precise=false → 0 decimals)", () => {
    const { container } = renderWithTamagui(<PekuloCountUpPct value={0.42} />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><span class="is_Text _col-color">42 %</span><div style="display: contents;"></div></span>"`);
  });
  it("renders precise (1 decimal)", () => {
    const { container } = renderWithTamagui(<PekuloCountUpPct value={0.728} precise />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><span class="is_Text _col-color">72.8 %</span><div style="display: contents;"></div></span>"`);
  });
});
