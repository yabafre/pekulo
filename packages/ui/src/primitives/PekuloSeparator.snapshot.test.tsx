import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSeparator } from "./PekuloSeparator";

describe("PekuloSeparator snapshot", () => {
  it("renders horizontal", () => {
    const { container } = renderWithTamagui(<PekuloSeparator />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_Separator is_View _shrink-1 _btw-0px _brw-0px _borderBottomWidth-1px _borderLeftWidth-0px _grow-1 _fb-0px _height-0px _maxH-0px _bbs-solid _bts-solid _bls-solid _brs-solid _btc-borderDefau3464 _brc-borderDefau3464 _borderBottomColor-borderDefau3464 _borderLeftColor-borderDefau3464 _o-1 _tr-translateY-1736186894"></div><div style="display: contents;"></div></span>"`);
  });
  it("renders vertical", () => {
    const { container } = renderWithTamagui(<PekuloSeparator vertical />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_Separator is_View _shrink-1 _btw-0px _brw-1px _borderBottomWidth-0px _borderLeftWidth-0px _grow-1 _fb-0px _height-initial _maxH-initial _bbs-solid _bts-solid _bls-solid _brs-solid _btc-borderDefau3464 _brc-borderDefau3464 _borderBottomColor-borderDefau3464 _borderLeftColor-borderDefau3464 _o-1 _width-0px _maxW-0px _tr-translateY0419227808"></div><div style="display: contents;"></div></span>"`);
  });
});
