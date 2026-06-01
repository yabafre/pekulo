import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { CategoryPicker } from "./CategoryPicker";

describe("CategoryPicker a11y (AC-6)", () => {
  it("has no serious/critical violations; trigger is a combobox button", async () => {
    const { container, getByRole } = renderWithTamagui(
      <CategoryPicker
        value="courses"
        onValueChange={() => {}}
        id="cat"
        options={[
          { value: "courses", label: "Courses" },
          { value: "transport", label: "Transport" },
        ]}
      />,
    );
    // PekuloSelect.Trigger renders a real <button> carrying role="combobox"
    // (so axe never flags aria-expanded/haspopup on a <div> — lesson 2026-05-06).
    const trigger = getByRole("combobox");
    expect(trigger.tagName).toBe("BUTTON");
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
