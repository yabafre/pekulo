import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
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
    fireEvent.click(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
