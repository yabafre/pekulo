import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { Sun, Moon, Monitor } from "lucide-react";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloSegmentedControl } from "./PekuloSegmentedControl";

describe("PekuloSegmentedControl a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSegmentedControl
        value="system"
        onChange={vi.fn()}
        ariaLabel="Thème"
        options={[
          { value: "system", label: "Système", icon: Monitor },
          { value: "dark", label: "Sombre", icon: Moon },
          { value: "light", label: "Clair", icon: Sun },
        ]}
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("emits onChange on segment click", () => {
    const onChange = vi.fn();
    const { getAllByRole } = renderWithTamagui(
      <PekuloSegmentedControl<"a" | "b">
        value="a"
        onChange={onChange}
        ariaLabel="x"
        options={[
          { value: "a", label: "A", icon: Sun },
          { value: "b", label: "B", icon: Moon },
        ]}
      />,
    );
    fireEvent.click(getAllByRole("radio")[1]);
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
