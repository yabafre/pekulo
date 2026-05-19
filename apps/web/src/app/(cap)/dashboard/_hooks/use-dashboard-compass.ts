"use client";

import { useQuery } from "@tanstack/react-query";
import type { Compass, CompassProgress } from "@pekulo/validators";
import type { CompassSetupState } from "@pekulo/types";
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
  const setup = useQuery<CompassSetupState>({
    queryKey: compassKeys.setup(),
    queryFn: () => getSetupState(),
    staleTime: 30_000,
  });
  const compass = useQuery<Compass | null>({
    queryKey: compassKeys.current(),
    queryFn: () => getCompass(),
    staleTime: 30_000,
  });
  const progress = useQuery<CompassProgress>({
    queryKey: compassKeys.progress(),
    queryFn: () => getCurrentProgress(),
    staleTime: 30_000,
    enabled: setup.data === "complete",
  });
  return { setup, compass, progress };
}
