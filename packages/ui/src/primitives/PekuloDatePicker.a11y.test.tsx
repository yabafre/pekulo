import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloDatePicker } from "./PekuloDatePicker";

const JANUARY_15_2026 = new Date(2026, 0, 15);

describe("PekuloDatePicker a11y", () => {
  it("has no serious/critical violations when closed", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloDatePicker value={JANUARY_15_2026} onChange={vi.fn()} />,
    );
    expect(getByRole("button", { name: "Sélectionner une date" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  // Lesson 2026-05-06: a compound trigger carrying aria-expanded / aria-haspopup
  // must be a real <button> — axe flags those attributes on a <div> as critical.
  it("puts the popover attributes on a native button, not a div", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloDatePicker value={JANUARY_15_2026} onChange={vi.fn()} />,
    );
    const trigger = getByRole("button", { name: "Sélectionner une date" });
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
