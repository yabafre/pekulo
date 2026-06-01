import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

// One render per `it` — RTL's getByRole queries the shared document body, so
// rendering twice in a single test would find both switches.
describe("PekuloSwitch a11y + behaviour", () => {
  it("has no serious/critical violations + role=switch", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="Notifications" checked onCheckedChange={vi.fn()} />,
    );
    expect(getByRole("switch")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  // Guards the prop-consumption regression: a `checked` style-variant on the
  // TRACK would freeze aria-checked at "false".
  it("aria-checked is false when unchecked", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="A" checked={false} onCheckedChange={vi.fn()} />,
    );
    expect(getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("aria-checked is true when checked", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="B" checked onCheckedChange={vi.fn()} />,
    );
    expect(getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("fires onCheckedChange(true) when toggled from off", () => {
    const onCheckedChange = vi.fn();
    const { getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="C" checked={false} onCheckedChange={onCheckedChange} />,
    );
    fireEvent.click(getByRole("switch"));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
