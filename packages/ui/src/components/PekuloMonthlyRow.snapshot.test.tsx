import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloMonthlyRow } from "./PekuloMonthlyRow";

describe("PekuloMonthlyRow snapshot", () => {
  it("renders open positive net", () => {
    const { container } = renderWithTamagui(
      <PekuloMonthlyRow
        month={{ monthLabel: "mai 2026", incomeEur: 3200, spendingEur: 2150, netEur: 1050 }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders closed negative net", () => {
    const { container } = renderWithTamagui(
      <PekuloMonthlyRow
        month={{
          monthLabel: "avril 2026",
          incomeEur: 3200,
          spendingEur: 3500,
          netEur: -300,
          closed: true,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
