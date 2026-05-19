"use client";

import { useQuery } from "@tanstack/react-query";
import type { Milestone } from "@pekulo/validators";
import { milestonesKeys } from "@/lib/zapaction/keys";
import { listMilestones } from "../_actions/milestones-actions";

export function useMilestones() {
  return useQuery<Milestone[]>({
    queryKey: milestonesKeys.list(),
    queryFn: () => listMilestones(),
    staleTime: 30_000,
  });
}
