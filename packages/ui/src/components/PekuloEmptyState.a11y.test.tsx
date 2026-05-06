import { describe, it, expect, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { Check } from "lucide-react";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import { PekuloEmptyState } from "./PekuloEmptyState";

describe("PekuloEmptyState a11y", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyState
        icon={Check}
        title="Tout est catégorisé"
        message="Aucune transaction en attente."
      />,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
  it("CTA fires onCta", () => {
    const onCta = vi.fn();
    const { getByRole } = renderWithTamagui(
      <PekuloEmptyState icon={Check} title="t" message="m" ctaLabel="Go" onCta={onCta} />,
    );
    fireEvent.click(getByRole("button"));
    expect(onCta).toHaveBeenCalledTimes(1);
  });
});
