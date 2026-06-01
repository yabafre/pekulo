import { describe, it, expect, vi } from "vitest";
import { renderWithTamagui, axe } from "../../../test/setup.tsx";
import { PekuloPagination } from "./PekuloPagination";

// Queries go through container.querySelector by role / aria-label rather than
// getByRole({name}) — accessible-name computation on Tamagui styled.button is
// flaky under happy-dom (documented in the 6-4 review), but the DOM attributes
// themselves land reliably.
describe("PekuloPagination a11y (AC-1)", () => {
  it("renders a labelled navigation landmark, numbered buttons, and marks the active page; no serious/critical violations", async () => {
    const { container } = renderWithTamagui(
      <PekuloPagination page={2} pageCount={5} onPageChange={vi.fn()} />,
    );
    expect(container.querySelector('[role="navigation"][aria-label="Pagination"]')).not.toBeNull();
    const active = container.querySelector('[aria-current="page"]');
    expect(active?.textContent).toContain("2");
    // ≤ 7 pages → all shown, no ellipsis.
    expect(container.querySelector('[aria-label="Page 5"]')).not.toBeNull();
    const r = await axe(container);
    expect(
      (r.violations ?? []).filter((v) => v.impact === "serious" || v.impact === "critical"),
    ).toEqual([]);
  });

  it("disables Préc. at the start and Suiv. at the end; clicking a page fires onPageChange", () => {
    const onPageChange = vi.fn();
    const { container, rerender } = renderWithTamagui(
      <PekuloPagination page={1} pageCount={3} onPageChange={onPageChange} />,
    );
    expect(
      (container.querySelector('[aria-label="Page précédente"]') as HTMLButtonElement).disabled,
    ).toBe(true);
    (container.querySelector('[aria-label="Page 2"]') as HTMLButtonElement).click();
    expect(onPageChange).toHaveBeenCalledWith(2);
    rerender(<PekuloPagination page={3} pageCount={3} onPageChange={onPageChange} />);
    expect(
      (container.querySelector('[aria-label="Page suivante"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("renders nothing for a single page", () => {
    const { container } = renderWithTamagui(
      <PekuloPagination page={1} pageCount={1} onPageChange={() => {}} />,
    );
    expect(container.querySelector('[role="navigation"]')).toBeNull();
  });
});
