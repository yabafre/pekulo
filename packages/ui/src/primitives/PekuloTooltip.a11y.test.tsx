import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloTooltip } from "./PekuloTooltip";

describe("PekuloTooltip a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloTooltip open>
        <PekuloTooltip.Trigger>
          <Text color="$color">t</Text>
        </PekuloTooltip.Trigger>
        <PekuloTooltip.Content>
          <Text color="$color">c</Text>
        </PekuloTooltip.Content>
      </PekuloTooltip>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
