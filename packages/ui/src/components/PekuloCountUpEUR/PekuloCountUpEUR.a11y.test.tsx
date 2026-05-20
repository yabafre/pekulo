import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloCountUpEUR } from "./PekuloCountUpEUR";

describe("PekuloCountUpEUR a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloCountUpEUR value={180400} />);
    const results = await axe(container);
    expect(
      (results.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
