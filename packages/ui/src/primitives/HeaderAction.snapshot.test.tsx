import { describe, it, expect } from "vitest";
import { Plus, ChevronDown } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import { HeaderAction } from "./HeaderAction";

describe("HeaderAction snapshot", () => {
  it("renders label only", () => {
    const { container } = renderWithTamagui(<HeaderAction label="Voir tout" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button role="button" class="is_HeaderActionPill is_View _bg-0hover-backgroundE69673903 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _bg-0active-backgroundE69673903 _tr-0active-scale0--971281 _o-0disabled-0--5 _cur-0disabled-not-allowed _fd-row _items-center _justify-center _gap-6px _height-c-size-8 _pr-c-space-3 _pl-c-space-3 _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _cur-pointer"><span class="is_Text _col-color _fs-f-size-capt104456 _fw-500">Voir tout</span></button><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders with left icon", () => {
    const { container } = renderWithTamagui(<HeaderAction icon={Plus} label="Ajouter" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button role="button" class="is_HeaderActionPill is_View _bg-0hover-backgroundE69673903 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _bg-0active-backgroundE69673903 _tr-0active-scale0--971281 _o-0disabled-0--5 _cur-0disabled-not-allowed _fd-row _items-center _justify-center _gap-6px _height-c-size-8 _pr-c-space-3 _pl-c-space-3 _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _cur-pointer"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus" aria-hidden="true"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg><span class="is_Text _col-color _fs-f-size-capt104456 _fw-500">Ajouter</span></button><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders with right icon", () => {
    const { container } = renderWithTamagui(
      <HeaderAction iconRight={ChevronDown} label="12 mois" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button role="button" class="is_HeaderActionPill is_View _bg-0hover-backgroundE69673903 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _bg-0active-backgroundE69673903 _tr-0active-scale0--971281 _o-0disabled-0--5 _cur-0disabled-not-allowed _fd-row _items-center _justify-center _gap-6px _height-c-size-8 _pr-c-space-3 _pl-c-space-3 _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _cur-pointer"><span class="is_Text _col-color _fs-f-size-capt104456 _fw-500">12 mois</span><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></button><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders disabled state", () => {
    const { container } = renderWithTamagui(<HeaderAction label="Ajouter" disabled />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><button role="button" aria-disabled="true" disabled="" class="is_HeaderActionPill is_View _bg-0hover-backgroundE69673903 _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _bg-0active-backgroundE69673903 _tr-0active-scale0--971281 _o-0disabled-0--5 _cur-0disabled-not-allowed _fd-row _items-center _justify-center _gap-6px _height-c-size-8 _pr-c-space-3 _pl-c-space-3 _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _cur-pointer"><span class="is_Text _col-color _fs-f-size-capt104456 _fw-500">Ajouter</span></button><div style="display: contents;"></div></span>"`,
    );
  });
});
