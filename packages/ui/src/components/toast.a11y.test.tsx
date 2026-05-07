import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloToast } from "./toast";

describe("PekuloToast a11y", () => {
  it("has role=status + no serious violations", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloToast entry={{ id: 3, title: "ok", intent: "info", durationMs: 4000 }} />,
    );
    expect(getByRole("status")).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
