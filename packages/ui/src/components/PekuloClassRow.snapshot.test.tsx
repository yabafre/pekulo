import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloClassRow } from "./PekuloClassRow";

describe("PekuloClassRow snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloClassRow label="ETF" amountEur={62000} pct={0.55} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
