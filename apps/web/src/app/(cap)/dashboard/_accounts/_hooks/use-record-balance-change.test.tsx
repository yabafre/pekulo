import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { accountsKeys, accountsTags } from "@/lib/zapaction/keys";

const balanceMock = vi.fn();
// Post-ZAP-1: attach `.tags` so useActionMutation's tag-registry path fires.
vi.mock("../_actions/accounts-actions", () => ({
  recordBalanceChange: Object.assign(
    (input: { id: string; valuedOn: Date; cashBalance: number }) => balanceMock(input),
    { tags: [accountsTags.list()] },
  ),
}));

import { useRecordBalanceChange } from "./use-record-balance-change";

function makeAcc(id: string, cashBalance = 1_000) {
  return {
    id,
    userId: "00000000-0000-0000-0000-000000000001",
    label: "Livret balance",
    type: "livret" as const,
    currency: "EUR" as const,
    cashBalance,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// AC-4 (verbatim from docs/stories/2-3-accounts-ui.md:20):
//   Given an account with cashBalance: 1_000, When I submit account-balance-form
//   with { valuedOn, cashBalance: 1_500 } (calls recordBalanceChange), Then the
//   response Account has cashBalance: 1_500, accountsKeys.list() is invalidated,
//   and the row updates to show 1 500 €.
describe("useRecordBalanceChange (AC-4)", () => {
  test("ok=true → invalidates accountsKeys.list()", async () => {
    const acc = makeAcc("acc_balancexxxxxxxxxxxxx", 1_000);
    balanceMock.mockReset().mockResolvedValueOnce({
      ok: true,
      account: { ...acc, cashBalance: 1_500 },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(accountsKeys.list(), [acc]);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRecordBalanceChange(), { wrapper });
    result.current.mutate({
      id: acc.id,
      valuedOn: new Date("2026-05-01T00:00:00.000Z"),
      cashBalance: 1_500,
    });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
  });

  // Post-ZAP-1 + R9: the tag registry fires on every success (envelope-false
  // is data, not error). The refetch is a no-op (server didn't change) so the
  // mutation.data alert still surfaces correctly.
  test("ok=false ACCOUNT_NOT_FOUND → mutation.data carries the envelope (R9 invalidate-anyway)", async () => {
    balanceMock
      .mockReset()
      .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_NOT_FOUND", message: "not found" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useRecordBalanceChange(), { wrapper });
    result.current.mutate({
      id: "acc_ghostxxxxxxxxxxxxxxxx",
      valuedOn: new Date("2026-05-01T00:00:00.000Z"),
      cashBalance: 9_999,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      ok: false,
      code: "ACCOUNT_NOT_FOUND",
      message: "not found",
    });
  });
});
