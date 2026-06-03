import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// Story 6-5 (FR-36). Mock the read hook so the list renders deterministically.
const { activityMock } = vi.hoisted(() => ({ activityMock: vi.fn() }));
vi.mock("../_hooks/use-llm-activity-log", () => ({
  useLlmActivityLog: () => activityMock(),
}));

import { LlmActivityLog } from "./llm-activity-log";

function entry(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "llm_1",
    callId: "c1",
    phase: "outcome",
    route: "ollama",
    latencyMs: 240,
    outcome: "success",
    occurredAt: "2026-06-01T08:00:00.000Z",
    ...over,
  };
}

afterEach(() => activityMock.mockReset());

describe("LlmActivityLog (story 6-5)", () => {
  test("AC-1 — renders route, latency and outcome labels for each call", async () => {
    activityMock.mockReturnValue({ data: { items: [entry()] }, isLoading: false });
    renderWithTamagui(<LlmActivityLog />);
    expect(await screen.findByText("Ollama")).toBeInTheDocument();
    expect(screen.getByText("240 ms")).toBeInTheDocument();
    expect(screen.getByText("Réussi")).toBeInTheDocument();
  });

  test("AC-4 — renders the empty state when there are no calls", async () => {
    activityMock.mockReturnValue({ data: { items: [] }, isLoading: false });
    renderWithTamagui(<LlmActivityLog />);
    expect(
      await screen.findByText("Aucun appel IA sur les 90 derniers jours."),
    ).toBeInTheDocument();
  });

  test("AC-1 — paginates: page 1 shows 10 of 12 rows", async () => {
    const items = Array.from({ length: 12 }, (_, i) => entry({ id: `llm_${i}`, callId: `c${i}` }));
    activityMock.mockReturnValue({ data: { items }, isLoading: false });
    renderWithTamagui(<LlmActivityLog />);
    // 12 rows → 2 pages; page 1 renders exactly 10 list items.
    expect(await screen.findAllByRole("listitem")).toHaveLength(10);
  });

  test("AC-2 — never renders prompt content (no label/amount/merchant in the DOM)", async () => {
    activityMock.mockReturnValue({ data: { items: [entry()] }, isLoading: false });
    const { container } = renderWithTamagui(<LlmActivityLog />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/label|montant|merchant|prompt/i);
  });

  test("AC-1 — ≥200 calls: 20 pages, page 1 shows 10, navigating to page 2 shows the next slice", async () => {
    // latencyMs = index → distinguishable text per row, so a page slice is provable.
    const items = Array.from({ length: 200 }, (_, i) =>
      entry({ id: `llm_${i}`, callId: `c${i}`, latencyMs: i }),
    );
    activityMock.mockReturnValue({ data: { items }, isLoading: false });
    const { container } = renderWithTamagui(<LlmActivityLog />);
    // 200 / 10 = 20 pages; page 1 renders exactly 10 list items + the nav with a "Page 20".
    expect(await screen.findAllByRole("listitem")).toHaveLength(10);
    expect(container.querySelector('[role="navigation"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Page 20"]')).not.toBeNull();
    // page 1 = latency 0..9 ms
    expect(screen.getByText("0 ms")).toBeInTheDocument();
    expect(screen.queryByText("10 ms")).toBeNull();
    // navigate to page 2 → latency 10..19 ms (proves the slice math past page 1).
    // querySelector by aria-label, not getByRole({name}) — accessible-name on a
    // Tamagui styled.button is flaky under happy-dom (6-4 review precedent).
    fireEvent.click(container.querySelector('[aria-label="Page 2"]')!);
    expect(await screen.findByText("10 ms")).toBeInTheDocument();
    expect(screen.queryByText("0 ms")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  test("AC-1 — preserves server order (most-recent-first); the list does not re-sort", async () => {
    // Server returns most-recent-first (repo orderBy createdAt desc, id desc — see
    // llm.repository.test.ts). The component must render that order verbatim.
    const items = [
      entry({ id: "newer", latencyMs: 240, occurredAt: "2026-06-01T08:00:00.000Z" }),
      entry({ id: "older", latencyMs: 99, occurredAt: "2026-05-01T08:00:00.000Z" }),
    ];
    activityMock.mockReturnValue({ data: { items }, isLoading: false });
    const { container } = renderWithTamagui(<LlmActivityLog />);
    const rows = container.querySelectorAll('[role="listitem"]');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.textContent).toContain("240 ms");
    expect(rows[1]!.textContent).toContain("99 ms");
  });

  test("AC-6 — loading announces via an aria-live region; the dated list is hydration-gated (R13)", () => {
    activityMock.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = renderWithTamagui(<LlmActivityLog />);
    const status = container.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status!.getAttribute("aria-live")).toBe("polite");
    expect(status!.textContent).toContain("Chargement");
    // R13: while loading (which includes the pre-hydration first paint) the
    // locale/tz-dated list never mounts — only the loading region renders.
    expect(container.querySelector('[role="listitem"]')).toBeNull();
  });

  test("AC-6 — route/outcome/date labels are grayscale (no $accent/$success/$danger)", async () => {
    activityMock.mockReturnValue({ data: { items: [entry()] }, isLoading: false });
    const { container } = renderWithTamagui(<LlmActivityLog />);
    const row = container.querySelector('[role="listitem"]');
    expect(row).not.toBeNull();
    // Tamagui emits the color token as an atomic class (`$color` → `_col-color`,
    // `$colorSecondary` → `_col-colorSecond…`, `$colorTertiary` → `_col-colorTertia…`).
    // No label may carry a reserved ± / status color (lesson 2026-05-07, AC-6).
    const labels = row!.querySelectorAll(".is_Text");
    expect(labels.length).toBeGreaterThan(0);
    for (const el of labels) {
      expect(el.className).not.toMatch(/_col-(danger|success|accent|red|green|emerald)/);
    }
    // …and the route label uses the primary grayscale $color.
    expect(container.querySelector("._col-color")).not.toBeNull();
  });
});
