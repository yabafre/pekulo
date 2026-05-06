import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloHypothesisVerdict } from "./PekuloHypothesisVerdict";

describe("PekuloHypothesisVerdict snapshot", () => {
  it("renders reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={820000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders not-reaches", () => {
    const { container } = renderWithTamagui(
      <PekuloHypothesisVerdict projectedEur={650000} requiredEur={800000} targetYear={2055} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
