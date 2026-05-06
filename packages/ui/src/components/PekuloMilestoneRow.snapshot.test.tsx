import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloMilestoneRow } from "./PekuloMilestoneRow";

describe("PekuloMilestoneRow snapshot", () => {
  it("renders ahead status", () => {
    const { container } = renderWithTamagui(
      <PekuloMilestoneRow
        milestone={{
          label: "1er palier",
          targetEur: 50000,
          targetYear: 2030,
          progressPct: 0.55,
          deltaEur: 1500,
          status: "ahead",
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders behind status", () => {
    const { container } = renderWithTamagui(
      <PekuloMilestoneRow
        milestone={{
          label: "2e palier",
          targetEur: 100000,
          targetYear: 2035,
          progressPct: 0.2,
          deltaEur: -2300,
          status: "behind",
        }}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
