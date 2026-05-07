import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSelect } from "./PekuloSelect";

describe("PekuloSelect a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSelect value="eur" onValueChange={vi.fn()}>
        <PekuloSelect.Trigger aria-label="Devise">
          <PekuloSelect.Value placeholder="Choisir" />
        </PekuloSelect.Trigger>
      </PekuloSelect>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
