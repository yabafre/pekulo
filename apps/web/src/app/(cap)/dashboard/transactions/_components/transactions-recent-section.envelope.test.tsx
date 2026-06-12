import { describe, expect, test, vi } from "vitest";
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
  // Story 5-2 — transitively required by CsvImportForm.
  previewImportCsv: vi.fn(),
  importCsv: vi.fn(),
}));
vi.mock("../../_accounts/_actions/accounts-actions", () => ({
  listAccounts: listAccountsMock,
}));
vi.mock("./month-scope-context", () => ({
  useMonthScope: () => ({
    month: "2026-02",
    summary: undefined,
    isLoading: false,
    setMonth: () => {},
    goPrev: () => {},
    goNext: () => {},
  }),
}));
vi.mock("nuqs", () => ({
  parseAsInteger: { withDefault: () => null },
  useQueryState: () => [1, () => {}],
}));
vi.mock("../_hooks/use-pending-suggestions", () => ({
  usePendingSuggestions: () => ({ data: { items: [], totalCount: 0, page: 1, pageSize: 10 } }),
}));
vi.mock("../../_llm/_components/ai-transparency-notice", () => ({
  AiTransparencyNotice: () => <span>__ai_notice__</span>,
}));

import { TransactionsRecentSection } from "./transactions-recent-section";

import type { Transaction } from "@pekulo/validators";

const fixtureTx: Transaction = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses Carrefour",
  amount: 87.5,
  type: "outflow",
  category: "courses",
  isImprevu: false,
  notes: null,
  transferPairId: null,
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

  test("error from SA — generic FR alert + retry, never the raw message", async () => {
    listTransactionsMock.mockRejectedValueOnce(new Error("boom"));
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText, queryByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );

    // The raw technical message ("boom") is mapped to a generic French copy
    // via userErrorMessage — it must never leak to the user.
    await findByText(/Une erreur est survenue\. Réessayez\./);
    // The retry affordance is present (wired to the react-query refetch).
    await findByText("Réessayer");
    expect(queryByText(/boom/)).toBeNull();
  });

  test("6-7 — auto-applied row shows the IA hint + mounts the notice when no pending", async () => {
    const autoApplied: Transaction = {
      ...fixtureTx,
      id: "tx_ccccccccccccccccccccc",
      label: "Spotify",
      category: "abonnements",
      suggestedCategory: "abonnements",
      suggestedConfidence: 0.81,
      suggestedRoute: "ollama",
    };
    listTransactionsMock.mockResolvedValueOnce({ items: [autoApplied], nextCursor: null });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { findByText } = renderWithTamagui(
      <QueryClientProvider client={qc}>
        <TransactionsRecentSection />
      </QueryClientProvider>,
    );
    await findByText(/Spotify/);
    // T5 renders the literal "IA" provenance hint for an auto-applied row.
    await findByText("IA");
    // The notice mounts (sentinel) — auto-applied row present AND no pending.
    await findByText("__ai_notice__");
  });
});
