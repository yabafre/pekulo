import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloSheet } from "./PekuloSheet";

describe("PekuloSheet snapshot", () => {
  it("renders open at first snap point", () => {
    const { container } = renderWithTamagui(
      <PekuloSheet open snapPoints={[50]}>
        <PekuloSheet.Overlay />
        <PekuloSheet.Frame>
          <PekuloSheet.Handle />
          <Text color="$color">Sheet content</Text>
        </PekuloSheet.Frame>
      </PekuloSheet>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
