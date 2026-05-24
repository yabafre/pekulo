import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: vi.fn(async () => ({ items: [], nextCursor: null })),
}));
vi.mock("../../parametres/_actions/accounts-actions", () => ({
  listAccounts: vi.fn(async () => []),
}));

import { TransactionsRecentSection } from "./transactions-recent-section";

describe("TransactionsRecentSection a11y (AC-13)", () => {
  test("zero axe violations on empty state", async () => {
    const qc = new QueryClient();
    const { container } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
