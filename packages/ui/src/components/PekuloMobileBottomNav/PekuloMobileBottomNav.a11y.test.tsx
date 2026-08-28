import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloMobileBottomNav } from "./PekuloMobileBottomNav";

// The nav carries `$lg={{ display: "none" }}` — it exists below the Tamagui lg
// breakpoint and yields to PekuloNavRail above it. happy-dom's default window is
// exactly 1024px wide, so at the default viewport the whole subtree computes to
// `display: none`: axe then scans nothing and reports a vacuous pass, and every
// role query comes back empty. Rendering at a phone width is what makes these
// assertions mean anything.
const PHONE_WIDTH = 390;
const DEFAULT_WIDTH = 1024;

function setViewportWidth(width: number): void {
  (
    window as unknown as { happyDOM: { setViewport: (v: { width: number }) => void } }
  ).happyDOM.setViewport({ width });
}

beforeEach(() => setViewportWidth(PHONE_WIDTH));
afterEach(() => setViewportWidth(DEFAULT_WIDTH));

describe("PekuloMobileBottomNav a11y + behaviour", () => {
  it("has no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloMobileBottomNav activeKey="cap" onSelect={vi.fn()} />,
    );
    expect(getComputedStyle(container.querySelector("nav") as HTMLElement).display).not.toBe(
      "none",
    );
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("exposes the five destinations as buttons", () => {
    const { getAllByRole } = renderWithTamagui(
      <PekuloMobileBottomNav activeKey="cap" onSelect={vi.fn()} />,
    );
    expect(getAllByRole("button")).toHaveLength(5);
  });

  it("marks the active destination with aria-current", () => {
    const { getByLabelText } = renderWithTamagui(
      <PekuloMobileBottomNav activeKey="portfolio" onSelect={vi.fn()} />,
    );
    expect(getByLabelText("Portefeuille")).toHaveAttribute("aria-current", "page");
    expect(getByLabelText("Cap")).not.toHaveAttribute("aria-current");
  });

  it("fires onSelect with the tapped key", () => {
    const onSelect = vi.fn();
    const { getByText } = renderWithTamagui(
      <PekuloMobileBottomNav activeKey="cap" onSelect={onSelect} />,
    );
    fireEvent.click(getByText("Portefeuille"));
    expect(onSelect).toHaveBeenCalledWith("portfolio");
  });
});
