"use client";

import { useActionQuery } from "@zapaction/query";
import { milestonesKeys } from "@/lib/zapaction/keys";
import { listMilestones } from "../_actions/milestones-actions";

export function useMilestones() {
  return useActionQuery(listMilestones, {
    input: undefined,
    queryKey: milestonesKeys.list(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
