import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSelect } from "./PekuloSelect";

describe("PekuloSelect snapshot", () => {
  it("renders trigger with value", () => {
    const { container } = renderWithTamagui(
      <PekuloSelect value="eur" onValueChange={vi.fn()}>
        <PekuloSelect.Trigger aria-label="Devise">
          <PekuloSelect.Value placeholder="Choisir" />
        </PekuloSelect.Trigger>
      </PekuloSelect>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-autocomplete="none" data-slot="select-trigger" data-size="md" aria-label="Devise" data-disable-theme="true" class="is_ListItem is_View _outlineColor-0focus-visible-color _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _bg-0hover-backgroundE69673903 _items-center _justify-space-betwe3241 _fwr-nowrap _width-10037 _maxW-10037 _ox-hidden _oy-hidden _fd-row _bg-backgroundM3600254 _cur-pointer _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pr-c-space-3 _pl-c-space-3 _height-40px _gap-c-space-2 _bbs-solid _bts-solid _bls-solid _brs-solid SelectTrigger"><span data-disable-theme="true" class="is_SelectValue is_Text font_body _ff-f-family _fs-f-size-body2682 _col-color _select-none _maxW-10037 _ox-hidden _oy-hidden _textOverflow-ellipsis _ws-nowrap _pe-none">eur</span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down is_View" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button><div style="display: contents;"></div></span>"`,
    );
  });
});
