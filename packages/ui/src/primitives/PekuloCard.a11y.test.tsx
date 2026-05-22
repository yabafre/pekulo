import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import {
  PekuloCard,
  PekuloCardAction,
  PekuloCardContent,
  PekuloCardDescription,
  PekuloCardFooter,
  PekuloCardHeader,
  PekuloCardTitle,
} from "./PekuloCard";
import { PekuloButton } from "./PekuloButton";

describe("PekuloCard a11y", () => {
  it("composed card renders title + description and no critical violations", async () => {
    const { container, getByText } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardHeader>
          <div>
            <PekuloCardTitle>Hypothèse</PekuloCardTitle>
            <PekuloCardDescription>Vue 30 ans, base hypothèse 1</PekuloCardDescription>
          </div>
          <PekuloCardAction>
            <PekuloButton variant="ghost" size="sm">
              Modifier
            </PekuloButton>
          </PekuloCardAction>
        </PekuloCardHeader>
        <PekuloCardContent>
          <p>Le détail du palier intermédiaire.</p>
        </PekuloCardContent>
        <PekuloCardFooter>
          <PekuloButton>Valider</PekuloButton>
        </PekuloCardFooter>
      </PekuloCard>,
    );
    expect(getByText("Hypothèse")).toBeTruthy();
    expect(getByText("Vue 30 ans, base hypothèse 1")).toBeTruthy();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("size sm switches data-size", () => {
    const { container } = renderWithTamagui(<PekuloCard size="sm">x</PekuloCard>);
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.getAttribute("data-size")).toBe("sm");
  });
});
