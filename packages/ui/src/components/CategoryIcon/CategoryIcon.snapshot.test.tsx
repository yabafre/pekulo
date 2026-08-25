import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { CategoryIcon } from "./CategoryIcon";

describe("CategoryIcon snapshot", () => {
  it("renders a known category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-cart" aria-hidden="true"><circle cx="8" cy="21" r="1"></circle><circle cx="19" cy="21" r="1"></circle><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path></svg><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders the fallback for an unknown category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="not-a-category" />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tag" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"></path><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"></circle></svg><div style="display: contents;"></div></span>"`,
    );
  });
});
