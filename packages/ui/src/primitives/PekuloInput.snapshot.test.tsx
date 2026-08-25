import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloInput } from "./PekuloInput";

describe("PekuloInput snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-field { outline: none; }
      .pekulo-field:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      </style><input data-slot="input" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: none none; font-family: inherit;" aria-label="Libellé" placeholder="Courses Carrefour" type="text"><div style="display: contents;"></div></span>"
    `,
    );
  });

  it("renders invalid", () => {
    const { container } = renderWithTamagui(
      <PekuloInput aria-label="Libellé" placeholder="Courses Carrefour" invalid />,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><style>
      .pekulo-field { outline: none; }
      .pekulo-field:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      </style><input data-slot="input" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: 1px solid; font-family: inherit; border-width: var(--danger); border-style: var(--danger); border-color: var(--danger);" aria-label="Libellé" placeholder="Courses Carrefour" type="text"><div style="display: contents;"></div></span>"
    `,
    );
  });
});
