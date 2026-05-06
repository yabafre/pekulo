import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHero } from "./PekuloHero";

describe("PekuloHero snapshot", () => {
  it("renders mobile variant", () => {
    const { container } = renderWithTamagui(
      <PekuloHero totalEur={180400} aheadEur={21383} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders card variant with cap stats", () => {
    const { container } = renderWithTamagui(
      <PekuloHero
        variant="card"
        totalEur={180400}
        aheadEur={21383}
        targetCapital={800000}
        targetYear={2055}
        requiredYearlyEur={21383}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders negative delta", () => {
    const { container } = renderWithTamagui(
      <PekuloHero totalEur={140000} aheadEur={-5000} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
