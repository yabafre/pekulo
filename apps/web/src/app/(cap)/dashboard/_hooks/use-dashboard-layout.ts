"use client";

// apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-layout.ts
// Story 7-2 (D6) — read + persist the caller's widget layout. The read returns
// the RAW saved layout (or null); the merge against the registry defaults
// (AC-6) happens in resolveLayout at the grid boundary, not here. The save
// mutation declares invalidateWithTags via the registry (R4 — never a manual
// queryClient.invalidateQueries). `reset` saves an EMPTY layout: resolveLayout
// backfills every registry widget at its default order/visibility, so an empty
// stored layout reconciles to the default layout (AC-5 reset).
import { useActionMutation, useActionQuery } from "@zapaction/query";
import type { DashboardLayout } from "@pekulo/validators";
import { dashboardLayoutKeys, dashboardLayoutTags } from "@/lib/zapaction/keys";
import { getDashboardLayout, saveDashboardLayout } from "../_actions/dashboard-layout-actions";

export function useDashboardLayout() {
  const query = useActionQuery(getDashboardLayout, {
    input: undefined,
    queryKey: dashboardLayoutKeys.layout(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
  const mutation = useActionMutation(saveDashboardLayout, {
    invalidateWithTags: [dashboardLayoutTags.current()],
  });
  return {
    widgets: query.data ?? null,
    isLoading: query.isLoading,
    save: (layout: DashboardLayout) => mutation.mutate(layout),
    reset: () => mutation.mutate({ widgets: [] }),
  };
}
