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
    expect(container.innerHTML).toMatchInlineSnapshot(
      `"<span class="_dsp_contents  font_body"><svg width="100%" height="180" viewBox="0 0 600 180" role="img" aria-label="Trajectoire patrimoine"><path d="M 8 172 L 124.8 139.20000000000002 L 241.6 106.39999999999999 L 358.4 73.60000000000001 L 475.2 40.79999999999999 L 592 8" stroke="var(--chartPlan)" stroke-width="2" stroke-dasharray="4 4" fill="none"></path><path d="M 8 172 L 124.8 131 L 241.6 110.5 L 358.4 77.7 L 475.2 49 L 592 8" stroke="var(--chartActual)" stroke-width="2" fill="none"></path></svg><div style="display: contents;"></div></span>"`,
    );
  });
});
