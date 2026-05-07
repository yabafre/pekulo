import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloCompositionCard } from "./PekuloCompositionCard";

describe("PekuloCompositionCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloCompositionCard
        items={[{ id: "etf", label: "ETF", amount: 92400, pct: 0.51 }]}
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
