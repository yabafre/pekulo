import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

describe("PekuloSwitch snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloSwitch checked={false} onCheckedChange={vi.fn()} aria-label="Notifications">
        <PekuloSwitch.Thumb />
      </PekuloSwitch>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span class=" is_Theme" style="display: contents;"><button type="button" aria-label="Notifications" role="switch" aria-checked="false" tabindex="0" data-state="unchecked" class="is_Switch is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _bg-backgroundM3600254 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><div class="is_View _self-stretch _grow-1 _shrink-1 _fb-0px"><div data-disable-theme="true" class="is_SwitchThumb is_View _fd-column _bg-colorOnAcce3526 _btlr-1000px _btrr-1000px _bbrr-1000px _bblr-1000px _self-flex-start _tr-translateX01303033"></div></div></button></span><div style="display: contents;"></div></span>"`,
    );
  });
});
