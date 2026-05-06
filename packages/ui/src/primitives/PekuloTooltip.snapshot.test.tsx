import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloTooltip } from "./PekuloTooltip";

describe("PekuloTooltip snapshot", () => {
  it("renders open content", () => {
    const { container } = renderWithTamagui(
      <PekuloTooltip open>
        <PekuloTooltip.Trigger>
          <Text color="$color">trigger</Text>
        </PekuloTooltip.Trigger>
        <PekuloTooltip.Content>
          <Text color="$color">tip</Text>
        </PekuloTooltip.Content>
      </PekuloTooltip>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
