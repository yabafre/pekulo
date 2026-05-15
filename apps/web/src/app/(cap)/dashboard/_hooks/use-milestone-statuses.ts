"use client";

import { useQuery } from "@tanstack/react-query";
import type { MilestoneStatusEntry } from "@pekulo/validators";
import { milestonesKeys } from "@/lib/zapaction/keys";
import { getMilestoneStatuses } from "@/lib/actions/milestones-actions";

export function useMilestoneStatuses(currentWealth: number, opts?: { enabled?: boolean }) {
  return useQuery<MilestoneStatusEntry[]>({
    queryKey: milestonesKeys.statuses(currentWealth),
    queryFn: () => getMilestoneStatuses({ currentWealth }),
    staleTime: 30_000,
    enabled: (opts?.enabled ?? true) && Number.isFinite(currentWealth) && currentWealth >= 0,
  });
}
