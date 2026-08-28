import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloCalendar } from "./PekuloCalendar";

// Same discipline as the snapshot spec: the month is pinned so the grid under
// test never depends on the system clock.
const JANUARY_2026 = new Date(2026, 0, 1);

describe("PekuloCalendar a11y", () => {
  it("has no serious/critical violations + exposes the month as a grid", async () => {
    const { container, getByRole, getAllByRole } = renderWithTamagui(
      <PekuloCalendar mode="single" month={JANUARY_2026} />,
    );
    expect(getByRole("grid")).toBeInTheDocument();
    expect(getAllByRole("gridcell").length).toBeGreaterThan(0);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("gives both month-navigation controls a discernible name", () => {
    const { getAllByRole } = renderWithTamagui(
      <PekuloCalendar mode="single" month={JANUARY_2026} />,
    );
    const named = getAllByRole("button").filter((b) => (b.getAttribute("aria-label") ?? "") !== "");
    expect(named.length).toBeGreaterThanOrEqual(2);
  });
});
