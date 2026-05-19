import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { milestonesKeys } from "@/lib/zapaction/keys";

vi.mock("../_actions/milestones-actions", () => ({
  addMilestone: vi.fn(
    async (input: { targetCapital: number; targetYear: number; label?: string }) => ({
      id: "mst_aaaaaaaaaaaaaaaaaaaaa",
      userId: "user-A",
      targetCapital: input.targetCapital,
      targetYear: input.targetYear,
      label: input.label ?? null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ),
}));

import { useAddMilestoneForm } from "./use-add-milestone-form";

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useAddMilestoneForm (AC-9)", () => {
  test("on success → invalidates milestonesKeys.list()", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAddMilestoneForm({ milestoneCount: 0 }), {
      wrapper: makeWrapper(client),
    });
    result.current.submit({ targetCapital: 100_000, targetYear: 2030 });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: milestonesKeys.list() });
  });

  test("capReached toggles when count meets the cap", () => {
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ count }: { count: number }) => useAddMilestoneForm({ milestoneCount: count }),
      { wrapper: makeWrapper(client), initialProps: { count: 19 } },
    );
    expect(result.current.capReached).toBe(false);
    rerender({ count: 20 });
    expect(result.current.capReached).toBe(true);
  });
});
