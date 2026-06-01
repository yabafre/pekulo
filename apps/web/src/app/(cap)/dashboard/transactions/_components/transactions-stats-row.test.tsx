import { describe, expect, test, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithTamagui } from "../../../../../../test/setup";

// "À confirmer" must reflect the live pending-suggestion total (story 6-4),
// not the old hardcoded 0. The count is gated on hydration, so it appears after
// the mount effect (renderWithTamagui flushes effects in act()).
vi.mock("../_hooks/use-transactions", () => ({
  useTransactions: () => ({ data: { items: [] } }),
}));
vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => ({
    data: { items: [], totalCount: 7, page: 1, pageSize: 10 },
  }),
}));

import { TransactionsStatsRow } from "./transactions-stats-row";

describe("TransactionsStatsRow (6-4)", () => {
  test("'À confirmer' shows the live pending total, not 0", async () => {
    renderWithTamagui(<TransactionsStatsRow />);
    // Rendered in both the mobile and desktop branches (one hidden via CSS).
    const counts = await screen.findAllByText("7");
    expect(counts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("À confirmer").length).toBeGreaterThanOrEqual(1);
  });
});
