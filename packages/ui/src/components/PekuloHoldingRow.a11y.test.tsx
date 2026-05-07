import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloHoldingRow } from "./PekuloHoldingRow";

describe("PekuloHoldingRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloHoldingRow
        holding={{
          ticker: "CW8.PA",
          label: "MSCI World",
          account: "PEA",
          kind: "etf",
          quantity: 100,
          pricePerUnit: 500,
          marketValueEur: 50000,
          pnlEur: 5000,
          pnlPct: 11,
        }}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
