import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloCompositionRow } from "./PekuloCompositionRow";

describe("PekuloCompositionRow snapshot", () => {
  it("renders with sub", () => {
    const { container } = renderWithTamagui(
      <PekuloCompositionRow
        label="Placements"
        amount={89000}
        pct={0.49}
        sub="ETF + Actions + Crypto"
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
