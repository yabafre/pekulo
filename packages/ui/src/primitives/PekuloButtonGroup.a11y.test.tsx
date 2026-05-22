import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloButton } from "./PekuloButton";
import {
  PekuloButtonGroup,
  PekuloButtonGroupSeparator,
  PekuloButtonGroupText,
} from "./PekuloButtonGroup";

describe("PekuloButtonGroup a11y", () => {
  it("renders role=group + data-orientation", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloButtonGroup orientation="horizontal">
        <PekuloButton>One</PekuloButton>
        <PekuloButton>Two</PekuloButton>
      </PekuloButtonGroup>,
    );
    const group = getByRole("group");
    expect(group.getAttribute("data-orientation")).toBe("horizontal");
  });

  it("composed group + separator + text has no critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloButtonGroup>
        <PekuloButton>Prev</PekuloButton>
        <PekuloButtonGroupSeparator />
        <PekuloButtonGroupText>Page 1 / 5</PekuloButtonGroupText>
        <PekuloButtonGroupSeparator />
        <PekuloButton>Next</PekuloButton>
      </PekuloButtonGroup>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
