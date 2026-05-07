import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloAvatar } from "./PekuloAvatar";

describe("PekuloAvatar snapshot", () => {
  it("renders fallback only", () => {
    const { container } = renderWithTamagui(
      <PekuloAvatar size={44}>
        <PekuloAvatar.Fallback>
          <Text color="$color" fontSize={16}>
            A
          </Text>
        </PekuloAvatar.Fallback>
      </PekuloAvatar>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_Avatar is_View _fd-column _items-center _justify-center _pos-relative _ox-hidden _oy-hidden _width-44px _height-44px _minW-44px _maxW-44px _maxH-44px _minH-44px _btlr-100000px _btrr-100000px _bbrr-100000px _bblr-100000px _pt-0px _pr-0px _pb-0px _pl-0px"><div data-disable-theme="true" class="is_AvatarFallback is_View _fd-column _pos-absolute _inset-0px _z-0 _bg-backgroundM3600254 _items-center _justify-center"><span class="is_Text _col-color _fs-16px">A</span></div></div><div style="display: contents;"></div></span>"`);
  });
});
