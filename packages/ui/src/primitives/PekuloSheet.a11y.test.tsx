import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSheet } from "./PekuloSheet";

describe("PekuloSheet a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloSheet open snapPoints={[50]}>
        <PekuloSheet.Overlay />
        <PekuloSheet.Frame>
          <PekuloSheet.Handle />
          <Text color="$color">Sheet</Text>
        </PekuloSheet.Frame>
      </PekuloSheet>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
