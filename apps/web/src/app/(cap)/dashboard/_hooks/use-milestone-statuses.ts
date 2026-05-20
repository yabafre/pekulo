"use client";

import { useActionQuery } from "@zapaction/query";
import { milestonesKeys } from "@/lib/zapaction/keys";
import { getMilestoneStatuses } from "../_actions/milestones-actions";

export function useMilestoneStatuses(currentWealth: number, opts?: { enabled?: boolean }) {
  return useActionQuery(getMilestoneStatuses, {
    input: { currentWealth },
    queryKey: milestonesKeys.statuses(currentWealth),
    readPolicy: "read-only",
    staleTime: 30_000,
    enabled: (opts?.enabled ?? true) && Number.isFinite(currentWealth) && currentWealth >= 0,
  });
}
