import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloStat } from "./PekuloStat";

describe("PekuloStat snapshot", () => {
  it("renders neutral", () => {
    const { container } = renderWithTamagui(<PekuloStat label="Net" value="+1 050 €" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View "><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Net</span><span class="is_Text _col-color _fs-f-size-h2 _fw-600 _mt-c-space-1">+1 050 €</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders gain tone", () => {
    const { container } = renderWithTamagui(
      <PekuloStat label="Net" value="+1 050 €" tone="gain" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View "><span class="is_Text _col-colorTertia3655 _fs-f-size-xs _ls-0--5px">Net</span><span class="is_Text _col-success _fs-f-size-h2 _fw-600 _mt-c-space-1">+1 050 €</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
