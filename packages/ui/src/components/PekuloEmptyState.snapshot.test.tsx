import { describe, it, expect, vi } from "vitest";
import { Check } from "lucide-react";
import { renderWithTamagui } from "../../test/setup.tsx";
import { PekuloEmptyState } from "./PekuloEmptyState";

describe("PekuloEmptyState snapshot", () => {
  it("renders without CTA", () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyState
        icon={Check}
        title="Tout est catégorisé"
        message="Aucune transaction en attente."
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
  it("renders with CTA", () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyState
        icon={Check}
        title="Pas de cap"
        message="Définis un cap pour commencer."
        ctaLabel="Définir un cap"
        onCta={vi.fn()}
      />,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });
});
