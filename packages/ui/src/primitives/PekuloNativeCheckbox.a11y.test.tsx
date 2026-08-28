import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloNativeCheckbox } from "./PekuloNativeCheckbox";

describe("PekuloNativeCheckbox a11y", () => {
  it("has no serious/critical violations + role=checkbox with a discernible name", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloNativeCheckbox aria-label="Compte actif" />,
    );
    expect(getByRole("checkbox", { name: "Compte actif" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("exposes the checked state to assistive tech", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloNativeCheckbox aria-label="Compte actif" defaultChecked />,
    );
    expect(getByRole("checkbox", { name: "Compte actif" })).toBeChecked();
  });
});
