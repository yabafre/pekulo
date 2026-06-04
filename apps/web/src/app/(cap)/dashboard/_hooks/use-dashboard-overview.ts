"use client";

import { useActionQuery } from "@zapaction/query";
import { dashboardKeys } from "@/lib/zapaction/keys";
import { getDashboardOverview } from "../_actions/dashboard-actions";

// Story 7-1 — Cap view read hook (FR-43). Single read of the cross-domain
// overview aggregate. read-only per R4; invalidated by the registry edges on
// accounts/holdings/realestate/transactions/compass list tags (FR-44).
// Convention: use<Feature><Resource> (architecture L355).
export function useDashboardOverview() {
  return useActionQuery(getDashboardOverview, {
    input: undefined,
    queryKey: dashboardKeys.overview(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
