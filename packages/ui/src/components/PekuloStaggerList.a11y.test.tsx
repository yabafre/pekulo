import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloStaggerList } from "./PekuloStaggerList";

describe("PekuloStaggerList a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloStaggerList ariaLabel="liste paliers">
        <span>Apport</span>
        <span>Liberté</span>
      </PekuloStaggerList>,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
