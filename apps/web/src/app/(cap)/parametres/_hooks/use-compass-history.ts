"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompassHistoryEntry } from "@pekulo/types";
import { compassKeys } from "@/lib/zapaction/keys";
import { listHistory } from "@/lib/actions/compass-actions";

export function useCompassHistory(opts?: { limit?: number }) {
  return useQuery<CompassHistoryEntry[]>({
    queryKey: compassKeys.history(opts?.limit),
    queryFn: () => listHistory(opts ? { limit: opts.limit } : undefined),
    staleTime: 60_000,
  });
}
