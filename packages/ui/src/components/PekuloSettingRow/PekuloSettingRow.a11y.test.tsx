import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloSettingRow } from "./PekuloSettingRow";

describe("PekuloSettingRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSettingRow label="Email" value="alex@example.fr" />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
