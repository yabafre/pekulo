import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";

describe("PekuloHypothesisVerdict a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict
        reaches
        headline="Tu atteins ton cap en 2055."
        deltaLabel="+20 000 € vs cap requis"
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("gap-line variant has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict
        reaches={false}
        headline="Tu n'atteins pas ton cap en 2055."
        deltaLabel="−150 000 € vs cap requis"
        gapLabel="Il manque 120 € / mois pour atteindre le cap."
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
