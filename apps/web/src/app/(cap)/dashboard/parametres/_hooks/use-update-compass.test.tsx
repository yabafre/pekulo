import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { compassKeys, milestonesKeys } from "@/lib/zapaction/keys";

vi.mock("@/lib/actions/compass-actions", () => ({
  updateCompass: vi.fn(async (input: { objectif: number; horizonYears: number }) => ({
    objectif: input.objectif,
    horizonYears: input.horizonYears,
  })),
}));

import { useUpdateCompass } from "./use-update-compass";

describe("useUpdateCompass (AC-9)", () => {
  test("on success → invalidates the full compass graph + milestones list", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateCompass(), { wrapper });
    result.current.mutate({ objectif: 800_000, horizonYears: 27 });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(6));

    const calledKeys = invalidateSpy.mock.calls.map(
      ([arg]) => (arg as { queryKey: unknown }).queryKey,
    );
    expect(calledKeys).toEqual(
      expect.arrayContaining([
        compassKeys.current(),
        compassKeys.setup(),
        compassKeys.progress(),
        compassKeys.curve(),
        compassKeys.history(),
        milestonesKeys.list(),
      ]),
    );
  });
});
