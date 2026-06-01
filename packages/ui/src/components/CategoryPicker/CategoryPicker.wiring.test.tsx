import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui } from "../../../test/setup.tsx";

// Story 6-8 (DR-13) call-site wiring test. AC-2 asks that the category picker
// renders each option's icon. The real render path mounts items inside a
// Tamagui Select portal that does NOT mount in happy-dom (the whole
// PekuloSelect suite renders only the closed trigger — confirmed by probe:
// opening via click or `open` yields zero item SVGs). So we substitute OUR OWN
// wrapper primitive `PekuloSelect` with an inline stub (NOT Tamagui internals)
// so the items render, then assert the REAL <CategoryIcon> output (actual
// lucide SVG class) resolved per `opt.value`. This proves CategoryPicker's
// 6-8 logic — resolve the icon internally from the raw option value (decision
// Q1) — rather than asserting a mock was called. CategoryIcon itself is NOT
// mocked.
//
// vi.mock factory is hoisted (lesson 2026-05-20) → require React inside it.
vi.mock("../../primitives", () => {
  const React = require("react");
  const Pass = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Item = ({ icon, children }: { icon?: React.ReactNode; children?: React.ReactNode }) =>
    React.createElement("div", { "data-slot": "stub-item" }, icon, children);
  const PekuloSelect: Record<string, unknown> & {
    (props: { children?: React.ReactNode }): React.ReactNode;
  } = ({ children }) => React.createElement("div", null, children);
  PekuloSelect.Trigger = Pass;
  PekuloSelect.Value = () => null;
  PekuloSelect.Content = Pass;
  PekuloSelect.Group = Pass;
  PekuloSelect.Item = Item;
  return { PekuloSelect };
});

import { CategoryPicker } from "./CategoryPicker";

describe("CategoryPicker icon wiring (story 6-8, AC-2)", () => {
  it("resolves each option's lucide icon from its raw value", () => {
    const { container } = renderWithTamagui(
      <CategoryPicker
        value="courses"
        onValueChange={vi.fn()}
        id="cat"
        options={[
          { value: "courses", label: "Courses" },
          { value: "abonnements", label: "Abonnements" },
          { value: "retrait", label: "Retrait" },
        ]}
      />,
    );
    // courses → ShoppingCart, abonnements → RefreshCw (new), retrait → Landmark (new)
    expect(container.querySelector("svg.lucide-shopping-cart")).not.toBeNull();
    expect(container.querySelector("svg.lucide-refresh-cw")).not.toBeNull();
    expect(container.querySelector("svg.lucide-landmark")).not.toBeNull();
    // every resolved category glyph is aria-hidden (NFR-22/24)
    for (const svg of container.querySelectorAll("[data-slot='stub-item'] svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("falls back to the Tag glyph for an unmapped option value", () => {
    const { container } = renderWithTamagui(
      <CategoryPicker
        value="???"
        onValueChange={vi.fn()}
        options={[{ value: "???", label: "Inconnu" }]}
      />,
    );
    expect(container.querySelector("svg.lucide-tag")).not.toBeNull();
  });
});
