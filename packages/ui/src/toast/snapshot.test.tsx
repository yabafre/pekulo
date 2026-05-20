import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloToast } from ".";

describe("PekuloToast snapshot", () => {
  it("renders success", () => {
    const { container } = renderWithTamagui(
      <PekuloToast
        entry={{
          id: 1,
          title: "Sauvegardé",
          description: "Cap mis à jour",
          intent: "success",
          durationMs: 4000,
        }}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-live="polite" class="is_View _bg-backgroundE69673903 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pt-c-space-3 _pr-c-space-3 _pb-c-space-3 _pl-c-space-3 _minW-280px"><div class="is_View _fd-row _items-flex-start _gap-c-space-2"><div class="is_View _width-6px _height-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _mt-6px _bg-success"></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-capt104456 _fw-600">Sauvegardé</span><span class="is_Text _col-colorSecond96872 _fs-f-size-xs _mt-2px">Cap mis à jour</span></div></div></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders danger", () => {
    const { container } = renderWithTamagui(
      <PekuloToast entry={{ id: 2, title: "Erreur", intent: "danger", durationMs: 4000 }} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-live="polite" class="is_View _bg-backgroundE69673903 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _pt-c-space-3 _pr-c-space-3 _pb-c-space-3 _pl-c-space-3 _minW-280px"><div class="is_View _fd-row _items-flex-start _gap-c-space-2"><div class="is_View _width-6px _height-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _mt-6px _bg-danger"></div><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-capt104456 _fw-600">Erreur</span></div></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
