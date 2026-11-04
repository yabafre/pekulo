import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PekuloMobileBottomNav, PekuloNavRail } from "@pekulo/ui";
import { renderWithTamagui } from "../../../../../../test/setup";

// AC-4 (verbatim from story 12-4-advisory-private-page:20):
//   Given the public app navigation (PekuloNavRail and PekuloMobileBottomNav), When a user browses the app,
//   Then the advisory page is not linked in the public navigation bars and is only reachable via direct URL /dashboard/advisory by authorized users.

describe("advisory private-surface navigation isolation (AC-4)", () => {
  it("exposes no advisory entry point and no active item", () => {
    renderWithTamagui(
      <>
        <PekuloNavRail activeKey={null} onSelect={vi.fn()} />
        <PekuloMobileBottomNav activeKey={null} onSelect={vi.fn()} />
      </>,
    );

    expect(screen.queryByRole("button", { name: /advisory|conseil/i })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-current="page"]')).toBeNull();
  });
});
