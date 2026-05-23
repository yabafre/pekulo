import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloInput } from "./PekuloInput";

describe("PekuloInput a11y", () => {
  it("renders as native input with data-slot", () => {
    const { container } = renderWithTamagui(
      <PekuloInput id="x" defaultValue="hello" aria-label="Test" />,
    );
    const input = container.querySelector('input[data-slot="input"]');
    expect(input).toBeTruthy();
  });

  it("no serious/critical violations when paired with a label", async () => {
    const { container } = renderWithTamagui(
      <>
        <label htmlFor="x">Libellé</label>
        <PekuloInput id="x" />
      </>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
