import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloLoadingItem } from "./PekuloLoadingItem";

describe("PekuloLoadingItem snapshot", () => {
  it("renders with a title", () => {
    const { container } = renderWithTamagui(<PekuloLoadingItem title="Chargement des comptes" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-live="polite" class="is_View _fd-row _items-center _gap-c-space-3 _pr-c-space-4 _pl-c-space-4 _pt-c-space-3 _pb-c-space-3 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _bg-backgroundE69673903"><div class="is_View _shrink-0"><style>@keyframes pekulo-spin-360{to{transform:rotate(360deg)}}</style><div aria-hidden="true" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div></div><div class="is_View _grow-1 _shrink-1 _fb-0px _minW-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Chargement des comptes</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders with trailing content", () => {
    const { container } = renderWithTamagui(
      <PekuloLoadingItem title="Synchronisation Bridge" trailing="3/12" spinnerSize={20} />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-live="polite" class="is_View _fd-row _items-center _gap-c-space-3 _pr-c-space-4 _pl-c-space-4 _pt-c-space-3 _pb-c-space-3 _btlr-c-radius-lg _btrr-c-radius-lg _bbrr-c-radius-lg _bblr-c-radius-lg _bg-backgroundE69673903"><div class="is_View _shrink-0"><style>@keyframes pekulo-spin-360{to{transform:rotate(360deg)}}</style><div aria-hidden="true" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div></div><div class="is_View _grow-1 _shrink-1 _fb-0px _minW-0px"><span class="is_Text _col-color _fs-f-size-body2682 _fw-500">Synchronisation Bridge</span></div><div class="is_View _shrink-0"><span class="is_Text _col-colorTertia3655 _fs-f-size-capt104456 _fontVariant-tabular-num115">3/12</span></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
