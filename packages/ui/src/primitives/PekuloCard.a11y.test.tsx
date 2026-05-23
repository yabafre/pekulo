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
    // shadcn idiom: title, description, action are SIBLINGS inside the
    // header — no wrapper div. CardHeader's CSS grid places action at
    // col 2 / row span 2 so it spans both title + description rows.
    const { container, getByText } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardHeader>
          <PekuloCardTitle>Hypothèse</PekuloCardTitle>
          <PekuloCardDescription>Vue 30 ans, base hypothèse 1</PekuloCardDescription>
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

  it("size sm propagates data-size attribute on Card", () => {
    const { container } = renderWithTamagui(<PekuloCard size="sm">x</PekuloCard>);
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.getAttribute("data-size")).toBe("sm");
  });

  it("CardHeader uses CSS grid with 1fr auto columns (shadcn parity)", () => {
    const { container } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardHeader>
          <PekuloCardTitle>T</PekuloCardTitle>
        </PekuloCardHeader>
      </PekuloCard>,
    );
    const header = container.querySelector('[data-slot="card-header"]') as HTMLElement;
    expect(header.style.display).toBe("grid");
    expect(header.style.gridTemplateColumns).toBe("1fr auto");
  });

  it("CardAction places itself at column 2 / row 1 span 2", () => {
    const { container } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardHeader>
          <PekuloCardTitle>T</PekuloCardTitle>
          <PekuloCardDescription>D</PekuloCardDescription>
          <PekuloCardAction>A</PekuloCardAction>
        </PekuloCardHeader>
      </PekuloCard>,
    );
    const action = container.querySelector('[data-slot="card-action"]') as HTMLElement;
    expect(action.style.gridColumn).toBe("2");
    expect(action.style.gridRow).toBe("1 / span 2");
    expect(action.style.alignSelf).toBe("start");
    expect(action.style.justifySelf).toBe("end");
  });

  it("Card drops its own bottom padding when a CardFooter is present (shadcn pb-0 parity)", () => {
    // shadcn equivalent: has-data-[slot=card-footer]:pb-0 — the footer
    // brings its own padding so Card's own pb would double up.
    // Tamagui transforms padding props into atomic classes (e.g. `_pdb_0`
    // for paddingBottom:0). happy-dom doesn't load the generated CSS so
    // style.paddingBottom and getComputedStyle are unreliable here —
    // assert via className delta between the with-footer and no-footer
    // renders instead.
    const { container: withFooterContainer } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardContent>body</PekuloCardContent>
        <PekuloCardFooter>foot</PekuloCardFooter>
      </PekuloCard>,
    );
    const { container: noFooterContainer } = renderWithTamagui(
      <PekuloCard>
        <PekuloCardContent>body</PekuloCardContent>
      </PekuloCard>,
    );
    const withFooterCard = withFooterContainer.querySelector('[data-slot="card"]') as HTMLElement;
    const noFooterCard = noFooterContainer.querySelector('[data-slot="card"]') as HTMLElement;
    // The two Cards should differ on the paddingBottom-related class —
    // proves the conditional branch executed and Tamagui distinguished them.
    expect(withFooterCard.className).not.toBe(noFooterCard.className);
  });
});
