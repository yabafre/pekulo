import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloNativeSelect } from "./PekuloNativeSelect";

describe("PekuloNativeSelect snapshot", () => {
  it("renders default with options", () => {
    const { container } = renderWithTamagui(
      <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea">
        <option value="livret">Livret</option>
        <option value="pea">PEA</option>
        <option value="cto">CTO</option>
      </PekuloNativeSelect>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><div data-slot="native-select-wrapper" style="position: relative; display: block; width: 100%;"><style>
      .pekulo-field { outline: none; }
      .pekulo-field:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      </style><select data-slot="select" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 28px 0px 12px; font-size: 14px; border: none none; font-family: inherit; appearance: none; cursor: pointer; opacity: 1;" aria-label="Type de compte"><option value="livret">Livret</option><option value="pea">PEA</option><option value="cto">CTO</option></select><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down" aria-hidden="true" style="position: absolute; top: 50%; right: 12px; transform: translateY(-50%); pointer-events: none; opacity: 1;"><path d="m6 9 6 6 6-6"></path></svg></div><div style="display: contents;"></div></span>"
    `,
    );
  });

  it("renders invalid", () => {
    const { container } = renderWithTamagui(
      <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea" invalid>
        <option value="livret">Livret</option>
        <option value="pea">PEA</option>
      </PekuloNativeSelect>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `
      "<span class="_dsp_contents  font_body"><div data-slot="native-select-wrapper" style="position: relative; display: block; width: 100%;"><style>
      .pekulo-field { outline: none; }
      .pekulo-field:focus-visible {
        outline: 2px solid var(--color);
        outline-offset: 2px;
      }
      </style><select data-slot="select" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 28px 0px 12px; font-size: 14px; border: 1px solid; font-family: inherit; appearance: none; cursor: pointer; opacity: 1; border-width: var(--danger); border-style: var(--danger); border-color: var(--danger);" aria-label="Type de compte"><option value="livret">Livret</option><option value="pea">PEA</option></select><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--colorTertiary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down" aria-hidden="true" style="position: absolute; top: 50%; right: 12px; transform: translateY(-50%); pointer-events: none; opacity: 1;"><path d="m6 9 6 6 6-6"></path></svg></div><div style="display: contents;"></div></span>"
    `,
    );
  });
});
