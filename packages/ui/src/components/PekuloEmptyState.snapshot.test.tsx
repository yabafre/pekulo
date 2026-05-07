import { describe, it, expect, vi } from "vitest";
import { Check } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloEmptyState } from "./PekuloEmptyState";

describe("PekuloEmptyState snapshot", () => {
  it("renders without CTA", () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyState
        icon={Check}
        title="Tout est catégorisé"
        message="Aucune transaction en attente."
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _items-center _gap-c-space-3 _pt-c-space-8 _pb-c-space-8 _pr-c-space-6 _pl-c-space-6"><div class="is_View _width-56px _height-56px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _items-center _justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></div><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Tout est catégorisé</span><span class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _text-center">Aucune transaction en attente.</span></div><div style="display: contents;"></div></span>"`);
  });
  it("renders with CTA", () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyState
        icon={Check}
        title="Pas de cap"
        message="Définis un cap pour commencer."
        ctaLabel="Définir un cap"
        onCta={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div class="is_View _items-center _gap-c-space-3 _pt-c-space-8 _pb-c-space-8 _pr-c-space-6 _pl-c-space-6"><div class="is_View _width-56px _height-56px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254 _items-center _justify-center"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg></div><span class="is_Text _col-color _fs-f-size-h3 _fw-600">Pas de cap</span><span class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _text-center">Définis un cap pour commencer.</span><button role="button" aria-label="Définir un cap" class="is_PekuloEmptyStateCta is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-4 _pl-c-space-4 _pt-c-space-2 _pb-c-space-2 _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-color _cur-pointer"><span class="is_Text _col-colorOnAcce3526 _fs-f-size-capt104456 _fw-600">Définir un cap</span></button></div><div style="display: contents;"></div></span>"`);
  });
});
