import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDialog } from "./PekuloDialog";
import { PekuloDialogCloseX } from "./PekuloDialogCloseX";

// Must sit inside a PekuloDialog — it calls PekuloDialog.Close internally and
// throws on a missing context otherwise.
describe("PekuloDialogCloseX snapshot", () => {
  it("renders the close affordance inside a dialog", () => {
    const { container } = renderWithTamagui(
      <PekuloDialog open>
        <PekuloDialogCloseX />
      </PekuloDialog>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _pos-absolute _t-c-space-3 _r-c-space-3 _z-1"><button aria-label="Fermer" data-disable-theme="true" class="is_View _bg-0hover-backgroundM3600254 _outlineWidth-0focus-visible-2px _outlineColor-0focus-visible-color _outlineStyle-0focus-visible-solid _outlineOffset-0focus-visible-2px _width-32px _height-32px _items-center _justify-center _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-transparent _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid is_View "><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><div style="display: contents;"></div></span>"`,
    );
  });
});
