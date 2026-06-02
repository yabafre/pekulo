import { describe, it, expect } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { TransactionLogo } from "./TransactionLogo";

// AC-3 (verbatim from story 6-10-merchant-logos:40):
//   Given no resolvable logo source (or a manually-created transaction), When
//   the row renders, Then the category icon is shown (tier 3).
// The avatar is decorative — the row announces the label, so the avatar is
// aria-hidden + the <img> carries an empty alt (NFR-22/24); axe must see no
// violations in either the logo branch or the category-icon fallback.
describe("TransactionLogo a11y (story 6-10)", () => {
  it("logo branch is decorative — aria-hidden, empty alt, no axe violations", async () => {
    const { container } = renderWithTamagui(
      <TransactionLogo src="/v1/logos?ref=abc" category="courses" />,
    );
    expect(container.querySelector("[aria-hidden]")).not.toBeNull();
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("category-icon fallback (no src) is also clean", async () => {
    const { container } = renderWithTamagui(<TransactionLogo category="courses" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
