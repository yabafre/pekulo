import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { Section } from "./Section";

describe("Section a11y", () => {
  it("has no serious or critical violations (default)", async () => {
    const { container } = renderWithTamagui(
      <Section ariaLabel="audit-default">
        <p>content</p>
      </Section>,
    );
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("has no violations with title + action", async () => {
    const { container } = renderWithTamagui(
      <Section
        ariaLabel="audit-titled"
        title="Mes comptes"
        action={<button type="button">Ajouter</button>}
      >
        <p>content</p>
      </Section>,
    );
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });
});
