import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloStat } from "./PekuloStat";

describe("PekuloStat snapshot", () => {
  it("renders neutral", () => {
    const { container } = renderWithTamagui(<PekuloStat label="Net" value="+1 050 €" />);
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders gain tone", () => {
    const { container } = renderWithTamagui(
      <PekuloStat label="Net" value="+1 050 €" tone="gain" />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
