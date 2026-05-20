import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloStaggerList } from "./PekuloStaggerList";

describe("PekuloStaggerList snapshot", () => {
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
