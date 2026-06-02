import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// 6-9: Net/Entrées/Sorties come from the provider's server monthSummary.
vi.mock("./month-scope-context", () => ({
  useMonthScope: () => ({
    month: "2026-02",
    summary: { month: "2026-02", incomeEur: 3000, spendingEur: 200, netChangeEur: 2800 },
    isLoading: false,
    setMonth: vi.fn(),
    goPrev: vi.fn(),
    goNext: vi.fn(),
  }),
}));
// 6-4: "À confirmer" must reflect the live pending total, not a hardcoded 0.
vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => ({
    data: { items: [], totalCount: 7, page: 1, pageSize: 10 },
  }),
}));

import { TransactionsStatsRow } from "./transactions-stats-row";

describe("TransactionsStatsRow (6-9)", () => {
  test("Net reflects the server month summary", async () => {
    renderWithTamagui(<TransactionsStatsRow />);
    const nets = await screen.findAllByText("+2 800 €");
    expect(nets.length).toBeGreaterThanOrEqual(1);
  });
  test("'À confirmer' shows the live pending total, not 0", async () => {
    renderWithTamagui(<TransactionsStatsRow />);
    const counts = await screen.findAllByText("7");
    expect(counts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("À confirmer").length).toBeGreaterThanOrEqual(1);
  });
});
