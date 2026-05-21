"use client";

import { useActionQuery } from "@zapaction/query";
import { compassKeys } from "@/lib/zapaction/keys";
import { getCompass } from "../../_actions/compass-actions";

// Parametres-scoped read of the compass row. Mirrors the dashboard hook
// (`useDashboardCompass.compass`) but lives next to the parametres-only
// consumers so the import surface stays local to the route group. Both
// hooks share `compassKeys.current()` so React Query dedupes — adding a
// second subscriber does not double-fetch.
export function useCompass() {
  return useActionQuery(getCompass, {
    input: undefined,
    queryKey: compassKeys.current(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
