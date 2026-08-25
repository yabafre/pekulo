import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloDialog } from "./PekuloDialog";
import { PekuloDialogCloseX } from "./PekuloDialogCloseX";

describe("PekuloDialogCloseX a11y", () => {
  it("has no serious/critical violations + a named close button", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloDialog open>
        <PekuloDialogCloseX />
      </PekuloDialog>,
    );
    expect(getByRole("button", { name: "Fermer" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  // The glyph is decorative — the button's aria-label carries the name, so the
  // X must not be announced a second time.
  it("hides the X glyph from assistive tech", () => {
    const { container } = renderWithTamagui(
      <PekuloDialog open>
        <PekuloDialogCloseX />
      </PekuloDialog>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
