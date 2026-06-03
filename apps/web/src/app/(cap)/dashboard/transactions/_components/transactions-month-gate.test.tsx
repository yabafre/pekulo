// Regression — aped-debug 2026-06-03. The month-scoped reads on the transactions
// page must NOT fire a throwaway no-month request while MonthScopeProvider
// resolves the active month (the load-time double-fetch). With the `enabled:
// month != null` gate, each read fires exactly once, scoped to the resolved
// month. Async monthSummary mock = the key: it resolves on a microtask so the
// provider transitions month from null → "2026-05" like production.

import { describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

const calls = {
  listTransactions: [] as Record<string, unknown>[],
  listPendingSuggestions: [] as Record<string, unknown>[],
};

vi.mock("../_actions/transactions-actions", () => ({
  monthSummary: vi.fn(async () => ({
    month: "2026-05",
    incomeEur: 0,
    spendingEur: 0,
    netChangeEur: 0,
  })),
  listTransactions: vi.fn(async (input: Record<string, unknown>) => {
    calls.listTransactions.push(input);
    return { items: [], nextCursor: null, totalCount: 0 };
  }),
  listPendingSuggestions: vi.fn(async (input: Record<string, unknown>) => {
    calls.listPendingSuggestions.push(input);
    return { items: [], totalCount: 0, page: 1, pageSize: 10 };
  }),
  createTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  previewImportCsv: vi.fn(),
  importCsv: vi.fn(),
  confirmCategorisation: vi.fn(),
}));

import { MonthScopeProvider, useMonthScope } from "./month-scope-context";
import { useTransactions } from "../_hooks/use-transactions";
import { usePendingSuggestions } from "../_hooks/use-pending-suggestions";

function Consumer() {
  const { month } = useMonthScope();
  // Mirrors the real consumers: gated on the resolved month.
  useTransactions(10, month ?? undefined, 1, month != null);
  usePendingSuggestions(1, undefined, month ?? undefined, month != null);
  return <div data-testid="m">{month ?? "null"}</div>;
}

function renderConsumer() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MonthScopeProvider>
      <Consumer />
    </MonthScopeProvider>,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams="">
          <QueryClientProvider client={qc}>{children}</QueryClientProvider>
        </NuqsTestingAdapter>
      ),
    },
  );
}

describe("transactions month-scope read gating (aped-debug)", () => {
  test("month-scoped reads fire ONCE, scoped to the resolved month (no no-month pre-fetch)", async () => {
    const { findByText } = renderConsumer();
    await findByText("2026-05");
    await new Promise((r) => setTimeout(r, 50));

    expect(calls.listTransactions).toHaveLength(1);
    expect(calls.listTransactions[0]).toMatchObject({ limit: 10, month: "2026-05", page: 1 });

    expect(calls.listPendingSuggestions).toHaveLength(1);
    expect(calls.listPendingSuggestions[0]).toMatchObject({ page: 1, month: "2026-05" });
  });
});
