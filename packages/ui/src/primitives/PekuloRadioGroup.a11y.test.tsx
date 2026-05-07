import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloRadioGroup } from "./PekuloRadioGroup";

describe("PekuloRadioGroup a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloRadioGroup value="a" onValueChange={vi.fn()} aria-label="Choix">
        <PekuloRadioGroup.Item value="a" id="a" aria-label="A" />
        <PekuloRadioGroup.Item value="b" id="b" aria-label="B" />
      </PekuloRadioGroup>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
