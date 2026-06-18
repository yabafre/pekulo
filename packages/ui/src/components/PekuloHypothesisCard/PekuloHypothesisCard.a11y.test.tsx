import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloHypothesisCard } from "./PekuloHypothesisCard";

describe("PekuloHypothesisCard a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisCard
        reaches={false}
        headline="Tu n'atteins pas ton cap en 2055."
        deltaLabel="−20 000 € vs cap requis"
      />,
    );
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
