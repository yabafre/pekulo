import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloContextualAddButton } from "./PekuloContextualAddButton";

describe("PekuloContextualAddButton snapshot", () => {
  it("renders for transactions", () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton
        activeNav="transactions"
        label="Ajouter une transaction"
        onPress={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button role="button" aria-label="Ajouter une transaction" class="is_PekuloContextualAddFab is_View _tr-0active-scale0--951281 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _dsp-_lg_none _width-44px _height-44px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-color _items-center _justify-center _cur-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--background)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg></button><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders nothing for cap", () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton activeNav="cap" label="..." onPress={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div style="display: contents;"></div></span>"`,
    );
  });
});
