import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloAccountsSection } from "./PekuloAccountsSection";

describe("PekuloAccountsSection a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloAccountsSection
        accounts={[{ label: "Livret A", type: "livret", institution: "Bourso", balanceEur: 15000 }]}
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
