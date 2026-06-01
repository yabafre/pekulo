import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloSuggestionRow } from "./PekuloSuggestionRow";
import { CategoryIcon } from "../CategoryIcon";

describe("PekuloSuggestionRow snapshot", () => {
  it("renders pending suggestion", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Carrefour",
          account: "CB Bourso",
          dateLabel: "12 mai",
          direction: "out",
          amountEur: 87,
          suggestedCategory: "Courses",
          confidence: 0.91,
          route: "ios",
        }}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-2 _pt-c-space-3 _pb-c-space-3"><div class="is_View _fd-row _items-center _gap-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Carrefour</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB Bourso · 12 mai</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">−87&nbsp;€</span></div><div class="is_View _fd-row _items-center _gap-c-space-2 _fwr-wrap"><div class="is_View _fd-row _items-center _gap-c-space-1 _pr-c-space-2 _pl-c-space-2 _pt-3px _pb-3px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Courses</span></div><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">91%</span><span class="is_Text _dsp-_sm_flex _col-colorTertia3655 _fs-f-size-xs _dsp-none">· iOS</span><div class="is_View _grow-1 _shrink-1 _fb-0px"></div><button type="button" aria-label="Confirmer la catégorie" class="is_PekuloSuggestionConfirm is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-3 _pl-c-space-3 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-color _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorOnAcce3526 _fs-f-size-xs _fw-600">✓ Confirmer</span></button><button type="button" aria-label="Modifier la catégorie" class="is_PekuloSuggestionEdit is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-2 _pl-c-space-2 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-transparent _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Modifier</span></button></div></div><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders low-confidence (<75%) warning tone", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "AMZN MKTPL",
          account: "CB",
          dateLabel: "10 mai",
          direction: "out",
          amountEur: 42,
          suggestedCategory: "Maison",
          confidence: 0.62,
          route: "cloud",
        }}
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-2 _pt-c-space-3 _pb-c-space-3"><div class="is_View _fd-row _items-center _gap-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">AMZN MKTPL</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB · 10 mai</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">−42&nbsp;€</span></div><div class="is_View _fd-row _items-center _gap-c-space-2 _fwr-wrap"><div class="is_View _fd-row _items-center _gap-c-space-1 _pr-c-space-2 _pl-c-space-2 _pt-3px _pb-3px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Maison</span></div><span class="is_Text _col-warning _fs-f-size-xs">62%</span><span class="is_Text _dsp-_sm_flex _col-colorTertia3655 _fs-f-size-xs _dsp-none">· Cloud</span><div class="is_View _grow-1 _shrink-1 _fb-0px"></div><button type="button" aria-label="Confirmer la catégorie" class="is_PekuloSuggestionConfirm is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-3 _pl-c-space-3 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-color _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorOnAcce3526 _fs-f-size-xs _fw-600">✓ Confirmer</span></button><button type="button" aria-label="Modifier la catégorie" class="is_PekuloSuggestionEdit is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-2 _pl-c-space-2 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-transparent _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Modifier</span></button></div></div><div style="display: contents;"></div></span>"`,
    );
  });
  // AC-2 (verbatim from story 6-8-category-taxonomy-expansion:20): the suggestion
  // rows render the category's lucide icon aria-hidden alongside the label.
  it("renders the category icon when provided", () => {
    const { container } = renderWithTamagui(
      <PekuloSuggestionRow
        tx={{
          label: "Netflix",
          account: "CB Bourso",
          dateLabel: "03 mai",
          direction: "out",
          amountEur: 14,
          suggestedCategory: "Abonnements",
          confidence: 0.88,
          route: "ollama",
        }}
        categoryIcon={
          <CategoryIcon category="abonnements" size={12} color="var(--colorSecondary)" />
        }
        onConfirm={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    expect(container.querySelector("svg.lucide-refresh-cw")).not.toBeNull();
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div class="is_View _fd-column _gap-c-space-2 _pt-c-space-3 _pb-c-space-3"><div class="is_View _fd-row _items-center _gap-c-space-3"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-arrow-up-right" aria-hidden="true"><path d="M7 7h10v10"></path><path d="M7 17 17 7"></path></svg><div class="is_View _grow-1 _shrink-1 _fb-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Netflix</span><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">CB Bourso · 03 mai</span></div><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">−14&nbsp;€</span></div><div class="is_View _fd-row _items-center _gap-c-space-2 _fwr-wrap"><div class="is_View _fd-row _items-center _gap-c-space-1 _pr-c-space-2 _pl-c-space-2 _pt-3px _pb-3px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _bg-backgroundM3600254"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"></path><path d="M20 2v4"></path><path d="M22 4h-4"></path><circle cx="4" cy="20" r="2"></circle></svg><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--colorSecondary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw" aria-hidden="true"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Abonnements</span></div><span class="is_Text _col-colorTertia3655 _fs-f-size-xs">88%</span><span class="is_Text _dsp-_sm_flex _col-colorTertia3655 _fs-f-size-xs _dsp-none">· Ollama</span><div class="is_View _grow-1 _shrink-1 _fb-0px"></div><button type="button" aria-label="Confirmer la catégorie" class="is_PekuloSuggestionConfirm is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-3 _pl-c-space-3 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-color _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorOnAcce3526 _fs-f-size-xs _fw-600">✓ Confirmer</span></button><button type="button" aria-label="Modifier la catégorie" class="is_PekuloSuggestionEdit is_View _outlineColor-0focus-visible-borderFocus _outlineStyle-0focus-visible-solid _outlineWidth-0focus-visible-2px _pr-c-space-2 _pl-c-space-2 _pt-6px _pb-6px _btlr-c-radius-fu3456 _btrr-c-radius-fu3456 _bbrr-c-radius-fu3456 _bblr-c-radius-fu3456 _btw-0px _brw-0px _borderBottomWidth-0px _borderLeftWidth-0px _bg-transparent _cur-pointer _bbs-solid _bts-solid _bls-solid _brs-solid"><span class="is_Text _col-colorSecond96872 _fs-f-size-xs">Modifier</span></button></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
