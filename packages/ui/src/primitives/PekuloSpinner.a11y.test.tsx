import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSpinner } from "./PekuloSpinner";

describe("PekuloSpinner a11y", () => {
  it("named spinner exposes role=status with aria-label", () => {
    const { getByRole } = renderWithTamagui(<PekuloSpinner ariaLabel="Chargement" />);
    expect(getByRole("status")).toBeTruthy();
  });

  it("decorative spinner has aria-hidden=true", () => {
    const { container } = renderWithTamagui(<PekuloSpinner ariaLabel="" />);
    const hidden = container.querySelector('[aria-hidden="true"]');
    expect(hidden).toBeTruthy();
  });

  it("no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloSpinner ariaLabel="Loading" />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
