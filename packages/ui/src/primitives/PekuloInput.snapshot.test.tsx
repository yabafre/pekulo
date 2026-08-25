import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloInput } from "./PekuloInput";

describe("PekuloInput snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><input data-slot="input" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: none none; font-family: inherit; outline-color: none; outline-style: none; outline-width: initial;" aria-label="Libellé" placeholder="Courses Carrefour" type="text"><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders invalid", () => {
    const { container } = renderWithTamagui(
      <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" invalid />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><input data-slot="input" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: 1px solid; font-family: inherit; border-width: var(--danger); border-style: var(--danger); border-color: var(--danger); outline-color: none; outline-style: none; outline-width: initial;" aria-label="Libellé" placeholder="Courses Carrefour" type="text"><div style="display: contents;"></div></span>"`,
    );
  });
});
