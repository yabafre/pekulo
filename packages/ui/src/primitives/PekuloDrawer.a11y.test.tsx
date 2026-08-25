import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloDrawer } from "./PekuloDrawer";

// vaul portals the content out of `container`, so scanning `container` would
// report a vacuous pass over an empty shell. RTL's `baseElement` is
// document.body — the root the portalled dialog actually lands in — so that is
// what gets scanned here.
describe("PekuloDrawer a11y", () => {
  it("has no serious/critical violations + exposes the open drawer as a dialog", async () => {
    const { baseElement, getAllByRole } = renderWithTamagui(
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
    expect(getAllByRole("dialog").length).toBeGreaterThan(0);
    const r = await axe(baseElement);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("names the drawer from its title and description", () => {
    const { getByText } = renderWithTamagui(
      <PekuloDrawer open onOpenChange={vi.fn()}>
        <PekuloDrawer.Content>
          <PekuloDrawer.Header>
            <PekuloDrawer.Title>Filtrer les transactions</PekuloDrawer.Title>
            <PekuloDrawer.Description>Par mois et par catégorie.</PekuloDrawer.Description>
          </PekuloDrawer.Header>
        </PekuloDrawer.Content>
      </PekuloDrawer>,
    );
    expect(getByText("Filtrer les transactions")).toBeInTheDocument();
    expect(getByText("Par mois et par catégorie.")).toBeInTheDocument();
  });
});
