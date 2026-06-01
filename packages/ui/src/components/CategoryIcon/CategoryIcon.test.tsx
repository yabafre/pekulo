import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { CategoryIcon, CATEGORY_ICONS } from "./CategoryIcon";

describe("CategoryIcon", () => {
  it("maps every known category (incl. the four new) to an icon", () => {
    const keys = [
      "salaire",
      "freelance",
      "remote",
      "bonus",
      "loyer",
      "courses",
      "transport",
      "sorties",
      "voyage",
      "sante",
      "imprevu",
      "autre",
      "transfer",
      "factures",
      "restauration",
      "abonnements",
      "retrait",
    ] as const;
    for (const k of keys) {
      expect(CATEGORY_ICONS[k]).toBeDefined();
    }
  });

  it("renders an aria-hidden svg for a known category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="courses" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("class")).toContain("lucide-shopping-cart");
  });

  it("falls back to the Tag icon for an unknown category", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="does-not-exist" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("lucide-tag");
  });

  it("maps transfer to arrow-left-right (preserves 5-3 AC-8 glyph)", () => {
    const { container } = renderWithTamagui(<CategoryIcon category="transfer" />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "lucide-arrow-left-right",
    );
  });
});
