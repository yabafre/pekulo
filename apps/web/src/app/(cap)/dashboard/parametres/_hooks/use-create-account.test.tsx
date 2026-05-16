import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { accountsKeys } from "@/lib/zapaction/keys";

vi.mock("@/lib/actions/accounts-actions", () => ({
  createAccount: vi.fn(
    async (input: { label: string; type: string; currency: string; cashBalance: number }) => ({
      id: "acc_aaaaaaaaaaaaaaaaaaaaa",
      userId: "00000000-0000-0000-0000-000000000001",
      label: input.label,
      type: input.type,
      currency: input.currency,
      cashBalance: input.cashBalance,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ),
}));

import { useCreateAccount } from "./use-create-account";

// AC-1 (verbatim from docs/stories/2-3-accounts-ui.md:17):
//   Given I open /dashboard/parametres and the accounts section renders,
//   When I submit account-create-form with { label, type, currency, cashBalance },
//   Then the new row appears in accounts-section.tsx AND navigating to
//   /dashboard?tab=patrimoine shows it inside PekuloAccountsSection (both
//   surfaces consume accountsKeys.list(); the mutation invalidates that
//   key, so both refetch on next subscription tick).
describe("useCreateAccount (AC-1)", () => {
  test("on success → invalidates accountsKeys.list()", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCreateAccount(), { wrapper });
    result.current.mutate({
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5_000,
    });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: accountsKeys.list() });
  });
});
