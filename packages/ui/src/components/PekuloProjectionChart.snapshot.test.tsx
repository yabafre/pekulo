import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloProjectionChart } from "./PekuloProjectionChart";

describe("PekuloProjectionChart snapshot", () => {
  it("renders default", () => {
    const { container } = renderWithTamagui(
      <PekuloProjectionChart
        years={[2026, 2030, 2040, 2055]}
        actual={[180, 250, 400, 650]}
        required={[180, 260, 420, 800]}
        nowMarker={{ year: 2026, value: 180 }}
        capMarker={{ year: 2055, value: 800 }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
