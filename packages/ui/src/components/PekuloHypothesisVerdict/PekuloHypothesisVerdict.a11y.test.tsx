import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";

describe("PekuloHypothesisVerdict a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
