import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloSubmitButton } from "./PekuloSubmitButton";

describe("PekuloSubmitButton a11y", () => {
  it("renders as button[type=submit]", () => {
    const { getByRole } = renderWithTamagui(<PekuloSubmitButton>Envoyer</PekuloSubmitButton>);
    const btn = getByRole("button");
    expect(btn.getAttribute("type")).toBe("submit");
  });

  it("loading state sets aria-busy and disables", () => {
    const { getByRole } = renderWithTamagui(
      <PekuloSubmitButton loading loadingLabel="Envoi…">
        Envoyer
      </PekuloSubmitButton>,
    );
    const btn = getByRole("button") as HTMLButtonElement;
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.disabled).toBe(true);
  });

  it("no serious/critical violations", async () => {
    const { container } = renderWithTamagui(<PekuloSubmitButton>Envoyer</PekuloSubmitButton>);
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
