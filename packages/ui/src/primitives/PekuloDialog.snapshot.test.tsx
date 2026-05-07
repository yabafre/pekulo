import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDialog } from "./PekuloDialog";

describe("PekuloDialog snapshot", () => {
  it("renders open with title + description", () => {
    const { container } = renderWithTamagui(
      <PekuloDialog open>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <PekuloDialog.Title>Confirmer la suppression</PekuloDialog.Title>
            <PekuloDialog.Description>Cette action est irréversible.</PekuloDialog.Description>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(`"<span class="_dsp_contents  font_body"><div style="display: contents;"></div></span>"`);
  });
});
