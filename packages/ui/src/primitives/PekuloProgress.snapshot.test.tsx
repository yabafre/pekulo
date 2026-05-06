import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloProgress } from "./PekuloProgress";

describe("PekuloProgress snapshot", () => {
  it("renders 60%", () => {
    const { container } = renderWithTamagui(
      <PekuloProgress value={60} aria-label="Progression">
        <PekuloProgress.Indicator />
      </PekuloProgress>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
