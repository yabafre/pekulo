import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { PekuloCountUpEUR } from "./PekuloCountUpEUR";

describe("PekuloCountUpEUR snapshot", () => {
  it("renders integer EUR (default precise=false)", () => {
    const { container } = renderWithTamagui(<PekuloCountUpEUR value={180400} />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span class="is_Text _col-color">180 400&nbsp;€</span><div style="display: contents;"></div></span>"`,
    );
  });
  it("renders 2-decimal EUR (precise=true)", () => {
    const { container } = renderWithTamagui(<PekuloCountUpEUR value={87.42} precise />);
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><span class="is_Text _col-color">87,42&nbsp;€</span><div style="display: contents;"></div></span>"`,
    );
  });
  it("with fromZero, rolls in from 0 € on mount (motion allowed)", () => {
    // Override the setup's reduced-motion default to exercise the roll-in path.
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
    const { container } = renderWithTamagui(<PekuloCountUpEUR value={2687216} fromZero />);
    expect(container.innerHTML).toContain(">0&nbsp;€<");
  });
});
