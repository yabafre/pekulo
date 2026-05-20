import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloToggleRow } from "./PekuloToggleRow";

describe("PekuloToggleRow snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow
        label="LLM tiers"
        sub="Activer le routage cloud"
        checked={false}
        onChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><label for="_r_1_" class="is_Text _col-color _fs-f-size-body2682 _fw-500">LLM tiers</label><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Activer le routage cloud</span></div><button id="_r_1_" role="switch" aria-checked="false" aria-label="LLM tiers" class="is_PekuloToggleRowSwitch is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _width-44px _height-26px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _cur-pointer _bg-backgroundM3600254"><div class="is_PekuloToggleRowKnob is_View _width-22px _height-22px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-background _pos-absolute _t-2px _l-2px"></div></button></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow label="LLM tiers" checked onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><label for="_r_9_" class="is_Text _col-color _fs-f-size-body2682 _fw-500">LLM tiers</label></div><button id="_r_9_" role="switch" aria-checked="true" aria-label="LLM tiers" class="is_PekuloToggleRowSwitch is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _width-44px _height-26px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _cur-pointer _bg-color"><div class="is_PekuloToggleRowKnob is_View _width-22px _height-22px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-background _pos-absolute _t-2px _l-20px"></div></button></div><div style="display: contents;"></div></span>"`,
    );
  });
});
