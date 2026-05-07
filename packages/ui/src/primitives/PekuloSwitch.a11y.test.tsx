import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

describe("PekuloSwitch a11y", () => {
  it("has no serious/critical violations + role=switch", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloSwitch aria-label="Notifications" checked onCheckedChange={vi.fn()}>
        <PekuloSwitch.Thumb />
      </PekuloSwitch>,
    );
    expect(getByRole("switch")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
