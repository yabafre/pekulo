import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { TRANSACTIONS_KEY, transactionsTags } from "@/lib/zapaction/keys";

const confirmMock = vi.fn();
// Mirror 6-3's use-llm-opt-in.test: attach `.tags` to the mocked action so the
// registry edge resolves even though useActionMutation drives invalidation via
// the hook's explicit invalidateWithTags (lesson 2026-05-24).
vi.mock("../_actions/transactions-actions", () => ({
  confirmCategorisation: Object.assign((input: unknown) => confirmMock(input), {
    tags: [transactionsTags.list()],
  }),
}));

import { useConfirmCategorisation } from "./use-confirm-categorisation";

// AC-1 (verbatim from story 6-4:19):
//   Given a transaction with a pending suggestion, When I tap ✓ Confirmer, Then
//   the transaction's category is persisted … and the row leaves the
//   "Suggestions IA" section (it now appears in "Récentes").
// The mechanism: the mutation invalidates transactionsTags.list() → the bare
// [TRANSACTIONS_KEY] prefix, refreshing BOTH the pending list AND Récentes.
describe("useConfirmCategorisation (AC-1/AC-2)", () => {
  test("success → invalidates the transactions read graph (covers pending + list)", async () => {
    confirmMock.mockReset().mockResolvedValueOnce({ ok: true, transaction: { id: "tx_x" } });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useConfirmCategorisation(), { wrapper });
    result.current.mutate({ id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "courses" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS_KEY] });
  });
});
