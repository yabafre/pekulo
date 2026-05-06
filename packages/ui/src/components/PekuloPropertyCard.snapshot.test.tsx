import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloPropertyCard } from "./PekuloPropertyCard";

describe("PekuloPropertyCard snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloPropertyCard
        property={{
          label: "Appartement Lyon",
          valuationEur: 320000,
          debtRemainingEur: 180000,
          monthlyPaymentEur: 1240,
          yearsRemaining: 18,
          repaidPct: 0.31,
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
