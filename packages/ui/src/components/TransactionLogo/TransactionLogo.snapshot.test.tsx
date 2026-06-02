import { describe, it, expect } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";
import { TransactionLogo } from "./TransactionLogo";

// AC-1/AC-2 (verbatim from story 6-10-merchant-logos:38-39):
//   A recognised merchant → the merchant logo; an unknown merchant but known
//   bank → the bank logo (both arrive as the `src` proxy URL → the <img>).
// AC-3 (verbatim from story 6-10-merchant-logos:40):
//   No resolvable logo source (or a manual transaction) → the category icon.
describe("TransactionLogo (story 6-10 / FR-65)", () => {
  it("renders the <img> when src is present (tier 1/2)", () => {
    const { container } = renderWithTamagui(
      <TransactionLogo src="/v1/logos?ref=abc" category="courses" />,
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/v1/logos?ref=abc");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("renders only the category icon when src is absent (tier 3)", () => {
    const { container } = renderWithTamagui(<TransactionLogo category="courses" />);
    expect(container.querySelector("img")).toBeNull();
    // the lucide fallback renders an <svg>
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
