import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSkeleton } from "./PekuloSkeleton";

describe("PekuloSkeleton a11y", () => {
  it("has no serious/critical violations (decorative)", async () => {
    const { container } = renderWithTamagui(<PekuloSkeleton lines={3} />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
