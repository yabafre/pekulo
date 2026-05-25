import { describe, expect, test, vi } from "vitest";
import { axe } from "vitest-axe";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

// next/navigation hooks require the App Router context which happy-dom
// doesn't provide — stub them per the compass-section.a11y precedent.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/dashboard/transactions",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: vi.fn(async () => ({ items: [], nextCursor: null })),
  // Story 5-2 — transitively required by CsvImportForm.
  previewImportCsv: vi.fn(),
  importCsv: vi.fn(),
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
