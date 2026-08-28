import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { CategoryIcon } from "./CategoryIcon";

describe("CategoryIcon a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("is hidden from assistive tech (decorative icon, label lives on the row)", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
