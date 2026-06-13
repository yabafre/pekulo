"use client";

import { useActionQuery } from "@zapaction/query";
import { dashboardKeys } from "@/lib/zapaction/keys";
import { getHypothesisGap } from "../_actions/hypothesis-gap-actions";

// Story 7-4 (FR-59) — projection-vs-compass gap read. currentWealthEur comes
// from the 7-1 overview (via useCapDashboardState); it is part of the queryKey
// so a wealth change refetches naturally (mirrors useHypothesisProjection /
// 7-3). Gated on a finite wealth (load-time-gate, lesson 2026-06-03). The data
// is null when the user has no compass. read-only (R4).
export function useHypothesisGap(currentWealthEur: number | undefined) {
  return useActionQuery(getHypothesisGap, {
    input: { currentWealthEur: currentWealthEur ?? 0 },
    queryKey: dashboardKeys.hypothesisGap(currentWealthEur ?? 0),
    readPolicy: "read-only",
    enabled: typeof currentWealthEur === "number" && Number.isFinite(currentWealthEur),
    staleTime: 30_000,
  });
}
