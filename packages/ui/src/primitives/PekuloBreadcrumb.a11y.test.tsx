import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../test/setup.tsx";
import {
  PekuloBreadcrumb,
  PekuloBreadcrumbItem,
  PekuloBreadcrumbLink,
  PekuloBreadcrumbList,
  PekuloBreadcrumbPage,
  PekuloBreadcrumbSeparator,
} from "./PekuloBreadcrumb";

describe("PekuloBreadcrumb a11y", () => {
  it("renders nav[aria-label=breadcrumb] + aria-current=page on last item", () => {
    const { container } = renderWithTamagui(
      <PekuloBreadcrumb>
        <PekuloBreadcrumbList>
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbLink href="/">Accueil</PekuloBreadcrumbLink>
          </PekuloBreadcrumbItem>
          <PekuloBreadcrumbSeparator />
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbPage>Immobilier</PekuloBreadcrumbPage>
          </PekuloBreadcrumbItem>
        </PekuloBreadcrumbList>
      </PekuloBreadcrumb>,
    );
    const nav = container.querySelector('nav[aria-label="breadcrumb"]');
    expect(nav).toBeTruthy();
    const page = container.querySelector('[aria-current="page"]');
    expect(page?.textContent).toBe("Immobilier");
  });

  it("no critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloBreadcrumb>
        <PekuloBreadcrumbList>
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbLink href="/">Accueil</PekuloBreadcrumbLink>
          </PekuloBreadcrumbItem>
          <PekuloBreadcrumbSeparator />
          <PekuloBreadcrumbItem>
            <PekuloBreadcrumbPage>Détails</PekuloBreadcrumbPage>
          </PekuloBreadcrumbItem>
        </PekuloBreadcrumbList>
      </PekuloBreadcrumb>,
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });
});
