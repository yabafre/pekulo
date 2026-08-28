import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import {
  PekuloField,
  PekuloFieldContent,
  PekuloFieldLabel,
  PekuloFieldDescription,
} from "./PekuloField";
import { PekuloInput } from "./PekuloInput";

describe("PekuloField snapshot", () => {
  it("renders vertical with a label and a description", () => {
    const { container } = renderWithTamagui(
      <PekuloField>
        <PekuloFieldContent>
          <PekuloFieldLabel htmlFor="objectif">Capital cible</PekuloFieldLabel>
          <PekuloInput id="objectif" placeholder="800 000" />
          <PekuloFieldDescription>Montant visé à l'horizon du cap.</PekuloFieldDescription>
        </PekuloFieldContent>
      </PekuloField>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="group" data-slot="field" data-orientation="vertical" class="is_View _fd-column _gap-c-space-2 _width-10037 _o-1"><div data-slot="field-content" class="is_View _fd-column _gap-c-space-1 _width-10037"><label for="objectif" data-slot="field-label" class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _fw-500 _ls-0--3px">Capital cible</label><input data-slot="input" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: none none; font-family: inherit;" id="objectif" placeholder="800 000" type="text"><p data-slot="field-description" class="is_Text _col-colorTertia3655 _fs-f-size-capt104456">Montant visé à l'horizon du cap.</p></div></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders invalid", () => {
    const { container } = renderWithTamagui(
      <PekuloField invalid>
        <PekuloFieldContent>
          <PekuloFieldLabel htmlFor="objectif2">Capital cible</PekuloFieldLabel>
          <PekuloInput id="objectif2" invalid />
        </PekuloFieldContent>
      </PekuloField>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="group" data-slot="field" data-orientation="vertical" data-invalid="true" class="is_View _fd-column _gap-c-space-2 _width-10037 _o-1"><div data-slot="field-content" class="is_View _fd-column _gap-c-space-1 _width-10037"><label for="objectif2" data-slot="field-label" class="is_Text _col-colorSecond96872 _fs-f-size-capt104456 _fw-500 _ls-0--3px">Capital cible</label><input data-slot="input" class="pekulo-field" style="width: 100%; height: 40px; background-color: var(--backgroundMuted); color: var(--color); border-radius: 12px; padding: 0px 12px; font-size: 14px; border: 1px solid; font-family: inherit; border-width: var(--danger); border-style: var(--danger); border-color: var(--danger);" id="objectif2" type="text"></div></div><div style="display: contents;"></div></span>"`,
    );
  });
});
