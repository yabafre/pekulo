import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSwitch } from "./PekuloSwitch";

describe("PekuloSwitch snapshot", () => {
  it("renders unchecked", () => {
    const { container } = renderWithTamagui(
      <PekuloSwitch
        checked={false}
        onCheckedChange={vi.fn()}
        aria-label="Notifications"
      >
        <PekuloSwitch.Thumb />
      </PekuloSwitch>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
