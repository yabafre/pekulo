import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloUserDot } from "./PekuloUserDot";

describe("PekuloUserDot snapshot", () => {
  it("renders initial", () => {
    const { container } = renderWithTamagui(<PekuloUserDot initial="a" />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><button role="button" aria-label="Compte utilisateur" class="is_PekuloUserDotBubble is_View _bg-0hover-backgroundE69673903 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _width-_lg_c-size-10 _height-_lg_c-size-10 _width-44px _height-44px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _items-center _justify-center _cur-pointer"><span class="is_Text _col-color _fs-f-size-body _fw-600">A</span></button><div style="display: contents;"></div></span>"`);
  });
});
