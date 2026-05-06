import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTrajectoryChart } from "./PekuloTrajectoryChart";

describe("PekuloTrajectoryChart snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloTrajectoryChart
        months={[1, 2, 3, 4, 5, 6]}
        actual={[100, 110, 115, 123, 130, 140]}
        plan={[100, 108, 116, 124, 132, 140]}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
