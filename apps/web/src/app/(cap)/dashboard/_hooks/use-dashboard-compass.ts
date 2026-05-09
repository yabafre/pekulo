"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompassProgress } from "@pekulo/validators";
import type { CompassSetupState } from "@pekulo/types";
import { compassKeys } from "@/lib/zapaction/keys";
import { getCurrentProgress, getSetupState } from "@/lib/actions/compass-actions";

// Query hook for the dashboard donut. Returns BOTH the setup state (so the
// caller can short-circuit to the setup-CTA) and the progress payload.
// Convention: use<Feature><Resource> per architecture L348.
export function useDashboardCompass() {
  const setup = useQuery<CompassSetupState>({
    queryKey: compassKeys.setup(),
    queryFn: () => getSetupState(),
    staleTime: 30_000,
  });
  const progress = useQuery<CompassProgress>({
    queryKey: compassKeys.progress(),
    queryFn: () => getCurrentProgress(),
    staleTime: 30_000,
    // Skip when setup state says incomplete — prevents an unnecessary 404 round
    // trip on a fresh user (compass.getCurrentProgress throws COMPASS_NOT_FOUND
    // when no compass row exists).
    enabled: setup.data === "complete",
  });
  return { setup, progress };
}
