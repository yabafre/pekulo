import { describe, expect, test, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { compassKeys, compassTags, dashboardKeys, milestonesKeys } from "@/lib/zapaction/keys";

// Post-ZAP-1: attach `.tags` so useActionMutation's tag-registry path fires.
// `compassTags.current()` is mapped in lib/zapaction/keys.ts to the full
// compass aggregate, `milestonesKeys.list()` (status badges depend on the
// objectif), `dashboardKeys.overview()` (the compass objectif moves the Cap
// total-wealth %, story 7-1) AND — since story 7-4 — the bare
// `["dashboard", "hypothesisGap"]` prefix (a new objectif re-derives the gap).
vi.mock("../_actions/compass-actions", () => ({
  updateCompass: Object.assign(
    vi.fn(async (input: { objectif: number; horizonYears: number }) => ({
      objectif: input.objectif,
      horizonYears: input.horizonYears,
    })),
    { tags: [compassTags.current()] },
  ),
}));

import { useUpdateCompass } from "./use-update-compass";

describe("useUpdateCompass (AC-9)", () => {
  test("on success → invalidates the full compass graph + milestones + dashboard overview", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useUpdateCompass(), { wrapper });
    result.current.mutate({ objectif: 800_000, horizonYears: 27 });

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledTimes(8));

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
        dashboardKeys.overview(),
        ["dashboard", "hypothesisGap"],
      ]),
    );
  });
});
