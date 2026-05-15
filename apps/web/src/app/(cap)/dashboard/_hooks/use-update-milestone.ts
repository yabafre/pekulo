"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Milestone, UpdateMilestoneInput } from "@pekulo/validators";
import { milestonesKeys } from "@/lib/zapaction/keys";
import { updateMilestone } from "@/lib/actions/milestones-actions";

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation<Milestone, Error, UpdateMilestoneInput>({
    mutationFn: (input) => updateMilestone(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milestonesKeys.list() });
    },
  });
}
