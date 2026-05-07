import { describe, it, expect } from "vitest";
import { Text } from "tamagui";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloAvatar } from "./PekuloAvatar";

describe("PekuloAvatar a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloAvatar size={44}>
        <PekuloAvatar.Fallback>
          <Text color="$color">A</Text>
        </PekuloAvatar.Fallback>
      </PekuloAvatar>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
