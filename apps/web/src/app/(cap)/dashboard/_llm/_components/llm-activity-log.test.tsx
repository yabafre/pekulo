import { afterEach, describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
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
});
