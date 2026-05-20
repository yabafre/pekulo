import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloPropertyCard } from "./PekuloPropertyCard";

describe("PekuloPropertyCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloPropertyCard
        property={{
          label: "Appartement",
          valuationEur: 320000,
          debtRemainingEur: 180000,
          monthlyPaymentEur: 1240,
          yearsRemaining: 18,
          repaidPct: 0.31,
        }}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
