import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { accountsKeys } from "@/lib/zapaction/keys";

const updateMock = vi.fn();
vi.mock("../_actions/accounts-actions", () => ({
  updateAccount: (input: { id: string; label?: string }) => updateMock(input),
}));

import { useUpdateAccount } from "./use-update-account";

function makeAcc(id: string, label = "Acc") {
  return {
    id,
    userId: "00000000-0000-0000-0000-000000000001",
    label,
    type: "livret" as const,
    currency: "EUR" as const,
    cashBalance: 100,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// AC-3 (verbatim from docs/stories/2-3-accounts-ui.md:19):
//   Given the list shows an account, When I save changes in account-edit-form.tsx
//   (updateAccount({ id, label: "Nouveau" })), Then the response Account is
//   returned, accountsKeys.list() is invalidated, the list refetches, and the
//   row reflects label: "Nouveau".
describe("useUpdateAccount (AC-3)", () => {
  test("ok=true → invalidates accountsKeys.list()", async () => {
    const acc = makeAcc("acc_aaaaaaaaaaaaaaaaaaaaa", "Old");
    updateMock.mockReset().mockResolvedValueOnce({
      ok: true,
      account: { ...acc, label: "Nouveau" },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(accountsKeys.list(), [acc]);
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });
    result.current.mutate({ id: acc.id, label: "Nouveau" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
  });

  // Envelope `{ ok: false }` propagates through `result.data` for the form to
  // render — must NOT invalidate (would mask the rejected state with a
  // refetch that overwrites the stale cache before the user sees the alert).
  test("ok=false ACCOUNT_NOT_FOUND → does NOT invalidate", async () => {
    updateMock
      .mockReset()
      .mockResolvedValueOnce({ ok: false, code: "ACCOUNT_NOT_FOUND", message: "not found" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateAccount(), { wrapper });
    result.current.mutate({ id: "acc_ghostxxxxxxxxxxxxxxxx", label: "X" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
