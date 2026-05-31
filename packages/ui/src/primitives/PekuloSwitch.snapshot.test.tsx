import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

describe("PekuloSwitch snapshot", () => {
  // OFF: track $backgroundMuted (_bg-backgroundM…), thumb $color (_bg-color) —
  // a light knob on a dark track, visible. aria-checked=false, thumb flex-start.
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloSwitch checked={false} onCheckedChange={vi.fn()} aria-label="Notifications" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span class=" is_Theme" style="display: contents;"><button type="button" aria-label="Notifications" role="switch" aria-checked="false" tabindex="0" data-state="unchecked" class="is_Switch is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _bg-backgroundM3600254 _width-52px _height-30px _pt-3px _pr-3px _pb-3px _pl-3px _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><div class="is_View _self-stretch _grow-1 _shrink-1 _fb-0px"><div data-disable-theme="true" class="is_SwitchThumb is_View _fd-column _bg-color _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _self-flex-start _width-24px _height-24px _tr-translateX01303033"></div></div></button></span><div style="display: contents;"></div></span>"`,
    );
  });

  // ON: track $color (_bg-color), thumb $background (_bg-background) — a dark
  // knob on a white track, visible (this was the "invisible when on" bug).
  // aria-checked=true, thumb flex-end.
  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloSwitch checked onCheckedChange={vi.fn()} aria-label="Notifications" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span class=" is_Theme" style="display: contents;"><button type="button" aria-label="Notifications" role="switch" aria-checked="true" tabindex="0" data-state="checked" class="is_Switch is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _bg-color _width-52px _height-30px _pt-3px _pr-3px _pb-3px _pl-3px _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><div class="is_View _self-stretch _grow-1 _shrink-1 _fb-0px"><div data-disable-theme="true" class="is_SwitchThumb is_View _fd-column _bg-background _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _self-flex-end _width-24px _height-24px _tr-translateX01303033"></div></div></button></span><div style="display: contents;"></div></span>"`,
    );
  });
});
