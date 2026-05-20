import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloActivityRow } from "./PekuloActivityRow";

describe("PekuloActivityRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloActivityRow
        tx={{
          label: "Salaire",
          account: "CC",
          category: "Revenus",
          direction: "in",
          amountEur: 3200,
        }}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
