import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloContextualAddButton } from "./PekuloContextualAddButton";

describe("PekuloContextualAddButton a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloContextualAddButton label="Ajouter" onPress={vi.fn()} />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("activates on click", () => {
    const onPress = vi.fn();
    const { getByRole } = renderWithTamagui(
      <PekuloContextualAddButton label="Ajouter" onPress={onPress} />,
    );
    // happy-dom 20 excludes the FAB from the default accessibility tree
    // because of its responsive `display: none` at the lg breakpoint
    // (_dsp-_lg_none). The click behavior is independent of that computed
    // visibility, so query with `hidden: true` to reach the button.
    fireEvent.click(getByRole("button", { hidden: true }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
