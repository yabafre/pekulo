import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../test/setup";

// Stub the two views so the routing assertion stays focused on the switch,
// not on the rendered tree (Patrimoine/Cap pull live RQ data through
// providers that don't exist in this lightweight test). The stubs publish
// stable aria-labels we can grep for.
vi.mock("./_components/cap-view", () => ({
  CapView: () => <div aria-label="cap-view-stub">cap</div>,
}));
vi.mock("./_components/patrimoine-view", () => ({
  PatrimoineView: () => <div aria-label="patrimoine-view-stub">patrimoine</div>,
}));

// Hoisted searchParams handle — each test sets it before importing the page.
let searchParamsValue = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

import DashboardPage from "./page";

// AC-5 (verbatim from docs/stories/2-3-accounts-ui.md:21):
//   Given I'm on /dashboard (default = Cap view), When I click the "Patrimoine"
//   top-tab button in cap-shell.tsx, Then router.push("/dashboard?tab=patrimoine")
//   fires AND dashboard/page.tsx renders <PatrimoineView /> instead of <CapView />.
//   ... Clicking "Cap" navigates back to /dashboard (no `tab` param).
describe("DashboardPage — ?tab routing (AC-5)", () => {
  test("no `tab` param → CapView", () => {
    searchParamsValue = "";
    renderWithTamagui(<DashboardPage />);
    expect(screen.getByLabelText("cap-view-stub")).toBeTruthy();
    expect(screen.queryByLabelText("patrimoine-view-stub")).toBeNull();
  });

  test("`tab=patrimoine` → PatrimoineView", () => {
    searchParamsValue = "tab=patrimoine";
    renderWithTamagui(<DashboardPage />);
    expect(screen.getByLabelText("patrimoine-view-stub")).toBeTruthy();
    expect(screen.queryByLabelText("cap-view-stub")).toBeNull();
  });

  test("unknown `tab` value → falls back to CapView", () => {
    searchParamsValue = "tab=monnayage";
    renderWithTamagui(<DashboardPage />);
    expect(screen.getByLabelText("cap-view-stub")).toBeTruthy();
  });
});

// `render` is referenced for type-import only — vitest needs at least one
// runtime ref to keep the import live under the verbatimModuleSyntax bundler.
void render;
