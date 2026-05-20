import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloTopTabToggle } from "./PekuloTopTabToggle";

describe("PekuloTopTabToggle a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloTopTabToggle topTab="cap" onChange={vi.fn()} />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("calls onChange on click", () => {
    const onChange = vi.fn();
    const { getAllByRole } = renderWithTamagui(
      <PekuloTopTabToggle topTab="cap" onChange={onChange} />,
    );
    fireEvent.click(getAllByRole("tab")[1]);
    expect(onChange).toHaveBeenCalledWith("patrimoine");
  });
});
