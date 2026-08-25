import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloDrawer } from "./PekuloDrawer";

// `PekuloDrawer.Content` already wraps itself in Portal + Overlay, so the tree
// below deliberately omits both — nesting them again would render two overlays.
// vaul portals the content out of `container`, so this captures the shell, the
// same accepted shape as PekuloDialog.snapshot.test.tsx.
describe("PekuloDrawer snapshot", () => {
  it("renders open with header and footer", () => {
    const { container } = renderWithTamagui(
      <PekuloDrawer open onOpenChange={vi.fn()}>
        <PekuloDrawer.Content>
          <PekuloDrawer.Header>
            <PekuloDrawer.Title>Filtrer les transactions</PekuloDrawer.Title>
            <PekuloDrawer.Description>Par mois et par catégorie.</PekuloDrawer.Description>
          </PekuloDrawer.Header>
          <PekuloDrawer.Footer>Appliquer</PekuloDrawer.Footer>
        </PekuloDrawer.Content>
      </PekuloDrawer>,
    );
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><div style="display: contents;"></div></span>"`,
    );
  });
});
