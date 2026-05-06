import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloAvatar } from "./PekuloAvatar";

describe("PekuloAvatar snapshot", () => {
  it("renders fallback only", () => {
    const { container } = renderWithTamagui(
      <PekuloAvatar size={44}>
        <PekuloAvatar.Fallback>
          <Text color="$color" fontSize={16}>
            A
          </Text>
        </PekuloAvatar.Fallback>
      </PekuloAvatar>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
