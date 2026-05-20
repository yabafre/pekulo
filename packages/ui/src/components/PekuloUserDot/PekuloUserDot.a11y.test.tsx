import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloUserDot } from "./PekuloUserDot";

describe("PekuloUserDot a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloUserDot initial="A" />);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("activates onPress via click", () => {
    const onPress = vi.fn();
    const { getByRole } = renderWithTamagui(<PekuloUserDot initial="A" onPress={onPress} />);
    fireEvent.click(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
