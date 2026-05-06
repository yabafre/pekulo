import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSeparator } from "./PekuloSeparator";

describe("PekuloSeparator a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloSeparator />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
