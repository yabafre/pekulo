import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloNativeSelect } from "./PekuloNativeSelect";

describe("PekuloNativeSelect a11y", () => {
  it("has no serious/critical violations + role=combobox with a discernible name", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea">
        <option value="livret">Livret</option>
        <option value="pea">PEA</option>
      </PekuloNativeSelect>,
    );
    expect(getByRole("combobox", { name: "Type de compte" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  // The affordance chevron is decorative — the native control already announces
  // itself as a combobox, so a second announcement would be noise.
  it("hides the decorative chevron from assistive tech", () => {
    const { container } = renderWithTamagui(
      <PekuloNativeSelect aria-label="Type de compte" defaultValue="pea">
        <option value="pea">PEA</option>
      </PekuloNativeSelect>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
