import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloCheckbox } from "./PekuloCheckbox";

describe("PekuloCheckbox a11y", () => {
  it("has no serious/critical violations + role=checkbox", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloCheckbox checked={false} onCheckedChange={vi.fn()} aria-label="Accept">
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    expect(getByRole("checkbox")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("toggles on click", () => {
    const onCheckedChange = vi.fn();
    const { getByRole } = renderWithTamagui(
      <PekuloCheckbox
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="x"
      >
        <PekuloCheckbox.Indicator />
      </PekuloCheckbox>,
    );
    fireEvent.click(getByRole("checkbox"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
