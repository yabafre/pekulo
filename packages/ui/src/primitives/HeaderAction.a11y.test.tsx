import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { HeaderAction } from "./HeaderAction";

describe("HeaderAction a11y", () => {
  it("has no serious or critical violations", async () => {
    const { container } = renderWithTamagui(<HeaderAction label="Ajouter" />);
    const results = await axe(container);
    const blocking = (results.violations ?? []).filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(blocking).toEqual([]);
  });

  it("activates on click", () => {
    const onPress = vi.fn();
    const { getByRole } = renderWithTamagui(
      <HeaderAction label="Click me" onPress={onPress} />,
    );
    fireEvent.click(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = vi.fn();
    const { getByRole } = renderWithTamagui(
      <HeaderAction label="Disabled" onPress={onPress} disabled />,
    );
    fireEvent.click(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
