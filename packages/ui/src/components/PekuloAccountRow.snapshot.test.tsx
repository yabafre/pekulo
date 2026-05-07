import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloAccountRow } from "./PekuloAccountRow";

describe("PekuloAccountRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloAccountRow
        label="PEA Bourso"
        type="pea"
        institution="Boursorama"
        balanceEur={45200}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _justify-space-betwe3241 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">PEA Bourso</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">PEA · Boursorama</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">45 200&nbsp;€</span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
