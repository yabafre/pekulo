import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloKpiTile } from "./PekuloKpiTile";

describe("PekuloKpiTile snapshot", () => {
  it("renders without donut", () => {
    const { container } = renderWithTamagui(
      <PekuloKpiTile label="Cap" valueTop="22%" valueBottom="objectif 2055" />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders with donut", () => {
    const { container } = renderWithTamagui(
      <PekuloKpiTile label="Cap" valueTop="22%" progress={0.22} />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
