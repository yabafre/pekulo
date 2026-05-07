import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSettingRow } from "./PekuloSettingRow";

describe("PekuloSettingRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloSettingRow label="Email" value="alex@example.fr" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Email</span></div><span class="is_Text _col-colorSecond96872 _fs-f-size-body2682">alex@example.fr</span></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders destructive", () => {
    const { container } = renderWithTamagui(
      <PekuloSettingRow label="Supprimer le compte" sub="Action irréversible" destructive />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-danger _fs-f-size-body2682 _fw-500">Supprimer le compte</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Action irréversible</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
