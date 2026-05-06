import { describe, it, expect, vi } from "vitest";
import { Sun, Moon, Monitor } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSegmentedControl } from "./PekuloSegmentedControl";

describe("PekuloSegmentedControl snapshot", () => {
  it("renders 3 options, dark active", () => {
    const { container } = renderWithTamagui(
      <PekuloSegmentedControl<"system" | "dark" | "light">
        value="dark"
        onChange={vi.fn()}
        ariaLabel="Thème"
        options={[
          { value: "system", label: "Système", icon: Monitor },
          { value: "dark", label: "Sombre", icon: Moon },
          { value: "light", label: "Clair", icon: Sun },
        ]}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
