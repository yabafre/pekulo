import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloToggleRow } from "./PekuloToggleRow";

describe("PekuloToggleRow snapshot", () => {
  it("renders unchecked (label + sub + PekuloSwitch OFF)", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow
        label="LLM tiers"
        sub="Activer le routage cloud"
        checked={false}
        onChange={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><label for="_r_1_" class="is_Text _col-color _fs-f-size-body2682 _fw-500">LLM tiers</label><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">Activer le routage cloud</span></div><span class=" is_Theme" style="display: contents;"><button type="button" id="_r_1_" aria-label="LLM tiers" role="switch" aria-checked="false" tabindex="0" data-state="unchecked" class="is_Switch is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _bg-backgroundM3600254 _width-52px _height-30px _pt-3px _pr-3px _pb-3px _pl-3px _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _o-1 _bbs-solid _bts-solid _bls-solid _brs-solid"><div class="is_View _self-stretch _grow-1 _shrink-1 _fb-0px"><div data-disable-theme="true" class="is_SwitchThumb is_View _fd-column _bg-color _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _self-flex-start _width-24px _height-24px _tr-translateX01303033"></div></div></button></span></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders checked (PekuloSwitch ON)", () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow label="LLM tiers" checked onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-row _items-center _gap-c-space-3 _pt-c-space-3 _pb-c-space-3"><div class="is_View _grow-1 _shrink-1 _fb-0px"><label for="_r_a_" class="is_Text _col-color _fs-f-size-body2682 _fw-500">LLM tiers</label></div><span class=" is_Theme" style="display: contents;"><button type="button" id="_r_a_" aria-label="LLM tiers" role="switch" aria-checked="true" tabindex="0" data-state="checked" class="is_Switch is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _bg-color _width-52px _height-30px _pt-3px _pr-3px _pb-3px _pl-3px _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _o-1 _bbs-solid _bts-solid _bls-solid _brs-solid"><div class="is_View _self-stretch _grow-1 _shrink-1 _fb-0px"><div data-disable-theme="true" class="is_SwitchThumb is_View _fd-column _bg-background _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _self-flex-end _width-24px _height-24px _tr-translateX01303033"></div></div></button></span></div><div style="display: contents;"></div></span>"`,
    );
  });
});
