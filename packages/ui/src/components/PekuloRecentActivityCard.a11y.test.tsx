import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloRecentActivityCard } from "./PekuloRecentActivityCard";

describe("PekuloRecentActivityCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloRecentActivityCard
        activities={[
          {
            label: "Salaire",
            account: "CB Bourso",
            category: "Revenus",
            direction: "in",
            amountEur: 3200,
          },
        ]}
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
