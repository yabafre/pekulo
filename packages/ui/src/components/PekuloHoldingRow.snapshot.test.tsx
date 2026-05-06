import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHoldingRow } from "./PekuloHoldingRow";

describe("PekuloHoldingRow snapshot", () => {
  it("renders gain", () => {
    const { container } = renderWithTamagui(
      <PekuloHoldingRow
        holding={{
          ticker: "CW8.PA",
          label: "MSCI World",
          account: "PEA",
          kind: "etf",
          quantity: 142,
          pricePerUnit: 532.5,
          marketValueEur: 75615,
          pnlEur: 8420,
          pnlPct: 12.5,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders loss", () => {
    const { container } = renderWithTamagui(
      <PekuloHoldingRow
        holding={{
          ticker: "BTC",
          label: "Bitcoin",
          account: "Crypto.com",
          kind: "crypto",
          quantity: 0.45,
          pricePerUnit: 56000,
          marketValueEur: 25200,
          pnlEur: -3800,
          pnlPct: -13.1,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
