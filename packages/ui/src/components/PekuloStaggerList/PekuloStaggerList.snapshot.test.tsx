import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloStaggerList } from "./PekuloStaggerList";

describe("PekuloStaggerList snapshot", () => {
  // This snapshot asserts the staggered animation-delays, so it opts into the
  // motion-allowed path — the setup default reports prefers-reduced-motion:
  // reduce (which would collapse every delay to 0).
  beforeEach(() => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
  });

  it("renders 3 children with staggered delays", () => {
    const { container } = renderWithTamagui(
      <PekuloStaggerList ariaLabel="paliers">
        <span>Apport</span>
        <span>Indep</span>
        <span>Liberté</span>
      </PekuloStaggerList>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><ul aria-label="paliers" class="is_View _fd-column" style="list-style: none; padding: 0px; margin: 0px;"><li class="is_View " style="animation-delay: 0ms;"><span>Apport</span></li><li class="is_View " style="animation-delay: 40ms;"><span>Indep</span></li><li class="is_View " style="animation-delay: 80ms;"><span>Liberté</span></li></ul><div style="display: contents;"></div></span>"`,
    );
  });
});
