// Story 8-2 (AC-1, AC-4) — a11y on the Apparence controls. AppearanceSection
// itself is an async server component that fetches the pref over oRPC; its
// accessible surface is entirely the two client segmented controls it
// composes, so the axe + ARIA assertions live here on ThemeControl +
// LangControl (each a PekuloSegmentedControl → role="radiogroup" + role="radio"
// + aria-checked on the active segment). The FR catalog is the test locale
// (test/setup.tsx), so labels read "Thème"/"Langue".
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@tamagui/next-theme", () => ({
  useThemeSetting: () => ({
    set: vi.fn(),
    current: "dark",
    resolvedTheme: "dark",
    themes: ["light", "dark"],
    toggle: vi.fn(),
  }),
}));
vi.mock("../_actions/settings-actions", () => ({
  updateTheme: vi.fn(),
  updateLang: vi.fn(),
  getSettings: vi.fn(),
}));

import { ThemeControl } from "./theme-control";
import { LangControl } from "./lang-control";

describe("Apparence controls a11y", () => {
  it("expose two radiogroups with accessible names + an aria-checked active segment", () => {
    renderWithTamagui(
      <>
        <ThemeControl initial="system" />
        <LangControl />
      </>,
    );
    const groups = screen.getAllByRole("radiogroup");
    expect(groups.length).toBe(2);
    for (const group of groups) {
      expect(group).toHaveAccessibleName();
    }
    // 3 theme segments (système/sombre/clair) + 2 lang segments (fr/en).
    const radios = screen.getAllByRole("radio");
    expect(radios.length).toBe(5);
    expect(radios.some((r) => r.getAttribute("aria-checked") === "true")).toBe(true);
  });

  it("has no axe violations", async () => {
    const { container } = renderWithTamagui(
      <>
        <ThemeControl initial="dark" />
        <LangControl />
      </>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
