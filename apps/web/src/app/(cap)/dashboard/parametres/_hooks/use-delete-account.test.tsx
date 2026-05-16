import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { accountsKeys } from "@/lib/zapaction/keys";

const deleteMock = vi.fn();
vi.mock("@/lib/actions/accounts-actions", () => ({
  deleteAccount: (input: { id: string }) => deleteMock(input),
}));

import { useDeleteAccount } from "./use-delete-account";

function makeAcc(id: string) {
  return {
    id,
    userId: "00000000-0000-0000-0000-000000000001",
    label: `Acc ${id}`,
    type: "livret" as const,
    currency: "EUR" as const,
    cashBalance: 100,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// AC-2 (verbatim from docs/stories/2-3-accounts-ui.md:18):
//   Given an account referenced by ≥ 1 holding (existing FK from holdings.account_id),
//   When I confirm deletion in account-delete-confirm.tsx,
//   Then the server action returns { ok: false, code: "ACCOUNT_REFERENCED_FK",
//   message: <api> } (NOT throws — see T2) AND the dialog renders the
//   localised message ... The account row stays in the list (no optimistic
//   remove on ok: false).
describe("useDeleteAccount (AC-2)", () => {
  test("ok=true → invalidates accountsKeys.list()", async () => {
    deleteMock.mockReset().mockResolvedValueOnce({ ok: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(accountsKeys.list(), [makeAcc("acc_aaaaaaaaaaaaaaaaaaaaa")]);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });
    result.current.mutate({ id: "acc_aaaaaaaaaaaaaaaaaaaaa" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
  });

  test("ok=false FK → restores the removed row in cache", async () => {
    deleteMock
      .mockReset()
      .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_REFERENCED_FK", message: "fk" });
    const acc = makeAcc("acc_bbbbbbbbbbbbbbbbbbbbb");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(accountsKeys.list(), [acc]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useDeleteAccount(), { wrapper });
    result.current.mutate({ id: acc.id });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = client.getQueryData<(typeof acc)[]>(accountsKeys.list());
    expect(data?.some((a) => a.id === acc.id)).toBe(true);
  });
});
