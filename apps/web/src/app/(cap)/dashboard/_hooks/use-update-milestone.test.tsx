import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { milestonesKeys } from "@/lib/zapaction/keys";

vi.mock("@/lib/actions/milestones-actions", () => ({
  updateMilestone: vi.fn(
    async (input: { id: string; targetCapital?: number; targetYear?: number; label?: string }) => ({
      id: input.id,
      userId: "user-A",
      targetCapital: input.targetCapital ?? 100_000,
      targetYear: input.targetYear ?? 2030,
      label: input.label ?? null,
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ),
}));

import { useUpdateMilestone } from "./use-update-milestone";

describe("useUpdateMilestone (AC-9)", () => {
  test("on success → invalidates milestonesKeys.list()", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateMilestone(), { wrapper });
    result.current.mutate({ id: "mst_aaaaaaaaaaaaaaaaaaaaa", targetCapital: 200_000 });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: milestonesKeys.list() });
  });
});
