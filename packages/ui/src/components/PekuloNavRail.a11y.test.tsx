import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloNavRail } from "./PekuloNavRail";

describe("PekuloNavRail a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloNavRail activeKey="cap" onSelect={vi.fn()} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("calls onSelect when a nav item is clicked", () => {
    const onSelect = vi.fn();
    const { getByLabelText } = renderWithTamagui(
      <PekuloNavRail activeKey="cap" onSelect={onSelect} />,
    );
    fireEvent.click(getByLabelText("Transactions"));
    expect(onSelect).toHaveBeenCalledWith("transactions");
  });
});
