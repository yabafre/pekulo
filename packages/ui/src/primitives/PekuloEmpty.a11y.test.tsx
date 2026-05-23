import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import {
  PekuloEmpty,
  PekuloEmptyContent,
  PekuloEmptyDescription,
  PekuloEmptyHeader,
  PekuloEmptyMedia,
  PekuloEmptyTitle,
} from "./PekuloEmpty";

describe("PekuloEmpty a11y", () => {
  it("composed empty state renders title + description + no critical violations", async () => {
    const { container, getByText } = renderWithTamagui(
      <PekuloEmpty outlined>
        <PekuloEmptyHeader>
          <PekuloEmptyMedia variant="icon">
            <span>📦</span>
          </PekuloEmptyMedia>
          <PekuloEmptyTitle>Aucun bien</PekuloEmptyTitle>
          <PekuloEmptyDescription>
            Tu n'as pas encore ajouté de bien immobilier. Clique sur "Ajouter" pour commencer.
          </PekuloEmptyDescription>
        </PekuloEmptyHeader>
        <PekuloEmptyContent>
          <button type="button">Ajouter un bien</button>
        </PekuloEmptyContent>
      </PekuloEmpty>,
    );
    expect(getByText("Aucun bien")).toBeTruthy();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("EmptyMedia icon variant sets data-variant", () => {
    const { container } = renderWithTamagui(
      <PekuloEmptyMedia variant="icon">
        <span>x</span>
      </PekuloEmptyMedia>,
    );
    const media = container.querySelector('[data-slot="empty-icon"]');
    expect(media?.getAttribute("data-variant")).toBe("icon");
  });
});
