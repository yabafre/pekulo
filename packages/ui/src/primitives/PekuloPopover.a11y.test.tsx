import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloPopover } from "./PekuloPopover";

describe("PekuloPopover a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloPopover open>
        <PekuloPopover.Trigger>
          <Text color="$color">Open</Text>
        </PekuloPopover.Trigger>
        <PekuloPopover.Content>
          <Text color="$color">Body</Text>
        </PekuloPopover.Content>
      </PekuloPopover>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
