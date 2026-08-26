import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSpinner } from "./PekuloSpinner";

// CSS-keyframe driven, not rAF — so the captured `@keyframes pekulo-spin-360`
// block and `animation: … infinite` are expected, not a reduced-motion leak.
describe("PekuloSpinner snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(<PekuloSpinner />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-label="Chargement" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders at size 24 with a custom label", () => {
    const { container } = renderWithTamagui(
      <PekuloSpinner size={24} ariaLabel="Synchronisation" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="status" aria-label="Synchronisation" class="is_View _dsp-inline-flex _items-center _justify-center" style="animation: pekulo-spin-360 1s linear infinite;"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg></div><div style="display: contents;"></div></span>"`,
    );
  });
});
