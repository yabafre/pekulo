import { describe, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderWithTamagui } from "../../../../../../test/setup";

const { listTransactionsMock, listAccountsMock } = vi.hoisted(() => ({
  listTransactionsMock: vi.fn(),
  listAccountsMock: vi.fn(async () => [
    {
      id: "acc_aaa111111111111111111",
      userId: "00000000-0000-0000-0000-000000000000",
      label: "Compte courant",
      type: "courant" as const,
      currency: "EUR" as const,
      cashBalance: 1000,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
}));
vi.mock("../_actions/transactions-actions", () => ({
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  listTransactions: listTransactionsMock,
}));
vi.mock("../../parametres/_actions/accounts-actions", () => ({
  listAccounts: listAccountsMock,
}));

import { TransactionsRecentSection } from "./transactions-recent-section";

const fixtureTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses Carrefour",
  amount: 87.5,
  type: "outflow" as const,
  category: "courses" as const,
  isImprevu: false,
  notes: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

describe("TransactionsRecentSection envelope (AC-13)", () => {
  test("populated list — row label is rendered after data resolves", async () => {
    listTransactionsMock.mockResolvedValueOnce({
      items: [fixtureTx, { ...fixtureTx, id: "tx_bbbbbbbbbbbbbbbbbbbbb", label: "Loyer" }],
      nextCursor: null,
    });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );

    // findByText auto-retries until the cache + hydration both flush.
    await findByText(/Courses Carrefour/);
    await findByText(/Loyer/);
  });

  test("empty list — empty-state copy renders", async () => {
    listTransactionsMock.mockResolvedValueOnce({ items: [], nextCursor: null });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );

    await findByText(/Aucune transaction/);
  });

  test("error from SA — alert text surfaces", async () => {
    listTransactionsMock.mockRejectedValueOnce(new Error("boom"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );

    await findByText(/boom/);
  });
});
