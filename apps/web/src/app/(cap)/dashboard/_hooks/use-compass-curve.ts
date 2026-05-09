"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompassCurve } from "@pekulo/types";
import { compassKeys } from "@/lib/zapaction/keys";
import { getCompassCurve } from "@/lib/actions/compass-actions";

export function useCompassCurve(opts?: { enabled?: boolean }) {
  return useQuery<CompassCurve>({
    queryKey: compassKeys.curve(),
    queryFn: () => getCompassCurve(),
    staleTime: 60_000,
    enabled: opts?.enabled ?? true,
  });
}
