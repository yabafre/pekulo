import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloLoadingItem } from "./PekuloLoadingItem";

describe("PekuloLoadingItem a11y", () => {
  it("renders title + role=status (aria-live=polite)", () => {
    const { getByText, container } = renderWithTamagui(<PekuloLoadingItem title="Mise à jour…" />);
    expect(getByText("Mise à jour…")).toBeTruthy();
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it("trailing string content renders as tabular-nums caption", () => {
    const { getByText } = renderWithTamagui(
      <PekuloLoadingItem title="Traitement" trailing="100,00 €" />,
    );
    expect(getByText("100,00 €")).toBeTruthy();
  });

  it("no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloLoadingItem title="Mise à jour…" trailing="100,00 €" />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
