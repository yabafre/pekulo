import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloCheckbox } from "./PekuloCheckbox";

describe("PekuloCheckbox snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloCheckbox checked={false} onCheckedChange={vi.fn()} aria-label="Accept terms">
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><button type="button" role="checkbox" aria-checked="false" aria-label="Accept terms" data-disable-theme="true" value="on" data-state="unchecked" class="is_Checkbox is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _bg-backgroundM3600254 _items-center _justify-center _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bbs-solid _bts-solid _bls-solid _brs-solid _width-5px _height-5px _btlr-1--5px _btrr-1--5px _bbrr-1--5px _bblr-1--5px"></button><div style="display: contents;"></div></span>"`);
  });
  it("renders checked", () => {
    const { container } = renderWithTamagui(
      <PekuloCheckbox checked onCheckedChange={vi.fn()} aria-label="Accept terms">
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><button type="button" role="checkbox" aria-checked="true" aria-label="Accept terms" data-disable-theme="true" value="on" data-state="checked" class="is_Checkbox is_View _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-borderFocus _outlineOffset-0focus-visible-2px _fd-column _bg-background _items-center _justify-center _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bbs-solid _bts-solid _bls-solid _brs-solid _width-5px _height-5px _btlr-1--5px _btrr-1--5px _bbrr-1--5px _bblr-1--5px"><div data-disable-theme="true" class="is_CheckboxIndicator is_View _fd-column _pe-none"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--colorOnAccent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></div></button><div style="display: contents;"></div></span>"`);
  });
});
