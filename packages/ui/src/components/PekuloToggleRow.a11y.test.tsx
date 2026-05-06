import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloToggleRow } from "./PekuloToggleRow";

describe("PekuloToggleRow a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloToggleRow label="LLM tiers" checked={false} onChange={vi.fn()} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("toggles on click", () => {
    const onChange = vi.fn();
    const { getByRole } = renderWithTamagui(
      <PekuloToggleRow label="LLM tiers" checked={false} onChange={onChange} />,
    );
    fireEvent.click(getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
