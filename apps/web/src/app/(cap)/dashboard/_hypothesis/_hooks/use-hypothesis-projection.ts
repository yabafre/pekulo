"use client";

import { useActionQuery } from "@zapaction/query";
import { hypothesesKeys } from "@/lib/zapaction/keys";
import { getHypothesisProjection } from "../_actions/hypothesis-actions";

// Story 7-3 — projection read hook (FR-58). currentWealthEur comes from the
// 7-1 dashboard overview (story 7-4 wires the two together). Gated on a finite
// wealth so it doesn't fire before the overview resolves (load-time-gate
// pattern, lesson 2026-06-03). read-only per R4.
export function useHypothesisProjection(currentWealthEur: number | undefined) {
  return useActionQuery(getHypothesisProjection, {
    input: { currentWealthEur: currentWealthEur ?? 0 },
    queryKey: hypothesesKeys.projection(currentWealthEur ?? 0),
    readPolicy: "read-only",
    enabled: typeof currentWealthEur === "number" && Number.isFinite(currentWealthEur),
    staleTime: 30_000,
  });
}
