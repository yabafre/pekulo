import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloMonthlyRow } from "./PekuloMonthlyRow";

describe("PekuloMonthlyRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloMonthlyRow
        month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
