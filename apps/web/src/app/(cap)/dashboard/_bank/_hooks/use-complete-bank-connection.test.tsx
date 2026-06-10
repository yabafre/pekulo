import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

// T26 — vitest envelope-narrowing test for useCompleteBankConnection.
// Lesson 2026-05-20: `vi.mock` factories are HOISTED to module top. Use
// `vi.hoisted` so the mutable handler reference can be reassigned per test.
const hoisted = vi.hoisted(() => ({
  completeBankConnectionImpl: vi.fn() as unknown as (input: {
    itemId: string;
    userUuid: string;
  }) => Promise<unknown>,
}));

vi.mock("../_actions/bank-aggregator-actions", () => ({
  completeBankConnection: Object.assign(
    vi.fn((input: { itemId: string; userUuid: string }) =>
      hoisted.completeBankConnectionImpl(input),
    ),
    {},
  ),
}));

import { useCompleteBankConnection } from "./use-complete-bank-connection";

// AC-1 wiring contract: the hook invalidates both bankConnections AND
// transactions on success via the zapaction tag-registry cascade — Bridge
// import lands new tx rows that the transactions list MUST repaint without
// a hard refresh. The cascade expansion is internal to zapaction ; we assert
// the bankConnections + transactions root keys are touched.
describe("useCompleteBankConnection — invalidation contract", () => {
  test("ok envelope → invalidates bankConnections + transactions (via tag-registry cascade)", async () => {
    hoisted.completeBankConnectionImpl = vi.fn(async () => ({
      ok: true,
      connection: {
        id: "bnk_1",
        userId: "u_a",
        provider: "bridge",
        providerItemId: "item-42",
        status: "active",
        displayName: "SG",
        lastRefreshedAt: null,
        lastSyncedAt: null,
        createdAt: new Date().toISOString(),
      },
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCompleteBankConnection(), { wrapper });
    result.current.mutate({ itemId: "item-42", userUuid: "bridge-uuid-1" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    const keys = invalidateSpy.mock.calls.map(
      (c) => (c[0] as { queryKey: readonly unknown[] }).queryKey,
    );
    // The registry cascade resolves both root keys (bankConnections +
    // transactions) ; assert both appear without pinning the exact tail shape.
    const bankConnectionsTouched = keys.some((k) => Array.isArray(k) && k[0] === "bankConnections");
    const transactionsTouched = keys.some((k) => Array.isArray(k) && k[0] === "transactions");
    expect(bankConnectionsTouched).toBe(true);
    expect(transactionsTouched).toBe(true);
  });

  test("ok=false envelope → mutation still succeeds at the React Query layer (narrowing handled in caller)", async () => {
    // Discriminated-union envelope: `ok: false` is NOT a thrown error at the
    // SA boundary. React Query treats it as a successful response carrying a
    // typed error code ; the caller narrows on `result.ok` (see callback page).
    hoisted.completeBankConnectionImpl = vi.fn(async () => ({
      ok: false,
      code: "BANK_CONNECTION_ALREADY_EXISTS",
      message: "bank connection already exists for this item",
    }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useCompleteBankConnection(), { wrapper });
    result.current.mutate({ itemId: "item-42", userUuid: "bridge-uuid-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data as
      | { ok: true; connection: unknown }
      | { ok: false; code: string; message: string };
    expect(data.ok).toBe(false);
    if (!data.ok) {
      expect(data.code).toBe("BANK_CONNECTION_ALREADY_EXISTS");
    }
  });
});
