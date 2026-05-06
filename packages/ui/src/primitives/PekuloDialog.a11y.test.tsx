import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloDialog } from "./PekuloDialog";

describe("PekuloDialog a11y", () => {
  it("open dialog has no serious/critical violations + role=dialog", async () => {
    const { container, getAllByRole } = renderWithTamagui(
      <PekuloDialog open>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <PekuloDialog.Title>Confirmer</PekuloDialog.Title>
            <PekuloDialog.Description>Action irréversible.</PekuloDialog.Description>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>,
    );
    expect(getAllByRole("dialog").length).toBeGreaterThan(0);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
