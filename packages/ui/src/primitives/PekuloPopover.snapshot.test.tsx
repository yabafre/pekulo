import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloPopover } from "./PekuloPopover";

describe("PekuloPopover snapshot", () => {
  it("renders open content", () => {
    const { container } = renderWithTamagui(
      <PekuloPopover open>
        <PekuloPopover.Trigger>
          <Text color="$color">Open</Text>
        </PekuloPopover.Trigger>
        <PekuloPopover.Content>
          <Text color="$color">Popover body</Text>
        </PekuloPopover.Content>
      </PekuloPopover>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
