import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloButtonGroup } from "./PekuloButtonGroup";
import { PekuloButton } from "./PekuloButton";

describe("PekuloButtonGroup snapshot", () => {
  it("renders horizontal with two buttons", () => {
    const { container } = renderWithTamagui(
      <PekuloButtonGroup>
        <PekuloButton>Annuler</PekuloButton>
        <PekuloButton>Confirmer</PekuloButton>
      </PekuloButtonGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="group" data-slot="button-group" data-orientation="horizontal" class="is_View _fd-row _items-stretch" style="width: fit-content;"><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Annuler</button><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Confirmer</button></div><div style="display: contents;"></div></span>"`,
    );
  });

  it("renders vertical", () => {
    const { container } = renderWithTamagui(
      <PekuloButtonGroup orientation="vertical">
        <PekuloButton>Annuler</PekuloButton>
        <PekuloButton>Confirmer</PekuloButton>
      </PekuloButtonGroup>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div role="group" data-slot="button-group" data-orientation="vertical" class="is_View _fd-column _items-stretch" style="width: fit-content;"><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Annuler</button><button type="button" data-slot="button" data-variant="default" data-size="default" class="pekulo-btn" style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0px 12px; border-radius: 12px; font-size: 14px; font-weight: 500; font-family: inherit; cursor: pointer; opacity: 1; white-space: nowrap; user-select: none; background-color: var(--color); color: var(--colorOnAccent); border: 1px solid transparent;">Confirmer</button></div><div style="display: contents;"></div></span>"`,
    );
  });
});
