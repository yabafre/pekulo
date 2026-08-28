import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloTextarea } from "./PekuloTextarea";

describe("PekuloTextarea a11y", () => {
  it("has no serious/critical violations + role=textbox with a discernible name", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloTextarea aria-label="Notes" placeholder="Note interne" rows={3} />,
    );
    expect(getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("keeps the name when invalid", async () => {
    const { container, getByRole } = renderWithTamagui(
      <PekuloTextarea aria-label="Notes" rows={3} invalid />,
    );
    expect(getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
