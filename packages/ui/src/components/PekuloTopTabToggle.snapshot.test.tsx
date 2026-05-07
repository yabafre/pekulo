import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTopTabToggle } from "./PekuloTopTabToggle";

describe("PekuloTopTabToggle snapshot", () => {
  it("renders cap active", () => {
    const { container } = renderWithTamagui(<PekuloTopTabToggle topTab="cap" onChange={vi.fn()} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="tablist" aria-label="Vue cap ou patrimoine" class="is_View _fd-row _gap-c-space-4"><button role="tab" aria-selected="true" class="is_PekuloTopTabButton is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _btlr-0focus-visible-4px _btrr-0focus-visible-4px _bbrr-0focus-visible-4px _bblr-0focus-visible-4px _cur-pointer _pr-c-space-1 _pl-c-space-1 _pt-c-space-1 _pb-c-space-1"><span class="is_Text _col-color _fs-f-size-h2 _fw-600">Cap</span></button><button role="tab" aria-selected="false" class="is_PekuloTopTabButton is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _btlr-0focus-visible-4px _btrr-0focus-visible-4px _bbrr-0focus-visible-4px _bblr-0focus-visible-4px _cur-pointer _pr-c-space-1 _pl-c-space-1 _pt-c-space-1 _pb-c-space-1"><span class="is_Text _col-colorTertia3655 _fs-f-size-h2 _fw-600">Patrimoine</span></button></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders patrimoine active", () => {
    const { container } = renderWithTamagui(
      <PekuloTopTabToggle topTab="patrimoine" onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="tablist" aria-label="Vue cap ou patrimoine" class="is_View _fd-row _gap-c-space-4"><button role="tab" aria-selected="false" class="is_PekuloTopTabButton is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _btlr-0focus-visible-4px _btrr-0focus-visible-4px _bbrr-0focus-visible-4px _bblr-0focus-visible-4px _cur-pointer _pr-c-space-1 _pl-c-space-1 _pt-c-space-1 _pb-c-space-1"><span class="is_Text _col-colorTertia3655 _fs-f-size-h2 _fw-600">Cap</span></button><button role="tab" aria-selected="true" class="is_PekuloTopTabButton is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _outlineOffset-0focus-visible-2px _btlr-0focus-visible-4px _btrr-0focus-visible-4px _bbrr-0focus-visible-4px _bblr-0focus-visible-4px _cur-pointer _pr-c-space-1 _pl-c-space-1 _pt-c-space-1 _pb-c-space-1"><span class="is_Text _col-color _fs-f-size-h2 _fw-600">Patrimoine</span></button></div><div style="display: contents;"></div></span>"`,
    );
  });
});
