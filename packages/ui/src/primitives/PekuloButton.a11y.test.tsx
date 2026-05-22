import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloButton } from "./PekuloButton";

describe("PekuloButton a11y", () => {
  it("default variant renders as button[type=button] with data-variant", () => {
    const { getByRole } = renderWithTamagui(<PekuloButton>Envoyer</PekuloButton>);
    const btn = getByRole("button");
    expect(btn.getAttribute("type")).toBe("button");
    expect(btn.getAttribute("data-variant")).toBe("default");
  });

  it("loading state sets aria-busy + disables", () => {
    const { getByRole } = renderWithTamagui(<PekuloButton loading>Envoyer</PekuloButton>);
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.disabled).toBe(true);
  });

  it("all 6 variants render without serious/critical axe violations", async () => {
    const variants = ["default", "outline", "secondary", "ghost", "destructive", "link"] as const;
    // axe is a singleton (vitest-axe wraps axe-core) — Promise.all
    // crashes with "Axe is already running". Sequential await is
    // mandatory here.
    for (const v of variants) {
      const { container, unmount } = renderWithTamagui(
        <PekuloButton variant={v}>Action {v}</PekuloButton>,
      );
      // oxlint-disable-next-line no-await-in-loop
      const r = await axe(container);
      expect(
        (r.violations ?? []).filter((x) => x.impact === "serious" || x.impact === "critical"),
      ).toEqual([]);
      unmount();
    }
  });
});
