import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Milestone } from "@pekulo/validators";
import { milestonesKeys, milestonesTags } from "@/lib/zapaction/keys";

const deleteSpy = vi.fn();

// Post-ZAP-1: attach `.tags` so useActionMutation's tag-registry path fires.
vi.mock("../_actions/milestones-actions", () => ({
  deleteMilestone: Object.assign((input: { id: string }) => deleteSpy(input), {
    tags: [milestonesTags.list()],
  }),
}));

import { useDeleteMilestone } from "./use-delete-milestone";

const mil = (id: string): Milestone => ({
  id,
  userId: "user-A",
  targetCapital: 100_000,
  targetYear: 2030,
  label: null,
  position: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe("useDeleteMilestone (AC-5, AC-9)", () => {
  test("on success → invalidates milestonesKeys.list()", async () => {
    deleteSpy.mockResolvedValueOnce({ id: "mst_aaaaaaaaaaaaaaaaaaaaa" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useDeleteMilestone(), { wrapper: makeWrapper(client) });
    result.current.mutate({ id: "mst_aaaaaaaaaaaaaaaaaaaaa" });
    await waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: milestonesKeys.list() });
  });

  test("rollback on error restores only the deleted row", async () => {
    deleteSpy.mockRejectedValueOnce(new Error("boom"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const seeded = [mil("mst_aaaaaaaaaaaaaaaaaaaaa"), mil("mst_bbbbbbbbbbbbbbbbbbbbb")];
    client.setQueryData<Milestone[]>(milestonesKeys.list(), seeded);

    const { result } = renderHook(() => useDeleteMilestone(), { wrapper: makeWrapper(client) });
    result.current.mutate({ id: "mst_aaaaaaaaaaaaaaaaaaaaa" });

    // After the rejected mutation settles + onSettled fires, both rows are
    // present (rollback restored the deleted row; sibling never moved).
    await waitFor(() => expect(result.current.isError).toBe(true));
    const cur = client.getQueryData<Milestone[]>(milestonesKeys.list());
    expect(cur?.find((m) => m.id === "mst_aaaaaaaaaaaaaaaaaaaaa")).toBeDefined();
    expect(cur?.find((m) => m.id === "mst_bbbbbbbbbbbbbbbbbbbbb")).toBeDefined();
  });
});
