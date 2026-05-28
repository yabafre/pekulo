"use client";

import { useActionQuery } from "@zapaction/query";
import { compassKeys } from "@/lib/zapaction/keys";
import { getCompass, getCurrentProgress, getSetupState } from "../_actions/compass-actions";

// Query hook for the dashboard. Returns three queries:
//   - setup    — gates the CTA vs full dashboard branch (getSetupState).
//   - compass  — objectif + horizonYears row (getCompass). Fetched even on
//                the `incomplete` branch so an inline AddMilestoneForm can
//                derive its `horizonAbsoluteYearMax` prop without bouncing
//                through /parametres.
//   - progress — donut payload (getCurrentProgress). Disabled until setup
//                is complete (the proc throws COMPASS_NOT_FOUND otherwise).
// Convention: use<Feature><Resource> per architecture L348.
export function useDashboardCompass() {
  const setup = useActionQuery(getSetupState, {
    input: undefined,
    queryKey: compassKeys.setup(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
  const compass = useActionQuery(getCompass, {
    input: undefined,
    queryKey: compassKeys.current(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
  const progress = useActionQuery(getCurrentProgress, {
    input: undefined,
    queryKey: compassKeys.progress(),
    readPolicy: "read-only",
    staleTime: 30_000,
    enabled: setup.data === "complete",
  });
  return { setup, compass, progress };
}
