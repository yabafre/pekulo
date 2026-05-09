"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AddMilestoneInput, Milestone } from "@pekulo/validators";
import { MILESTONES_PER_USER_CAP } from "@pekulo/validators";
import { milestonesKeys, milestonesTags } from "@/lib/zapaction/keys";
import { addMilestone } from "@/lib/actions/milestones-actions";

// Mutation orchestrator. Component reads `{ submit, isPending, capReached }`
// directly — no separate useForm hook in this V1 pass; the form component
// handles its own field state via component-local useState (architecture
// L192 — boundary rule). When epic 5 lands the import-csv form, we promote
// the TanStack-Form orchestrator pattern.
export function useAddMilestoneForm(args: { milestoneCount: number }) {
  const queryClient = useQueryClient();
  const mutation = useMutation<Milestone, Error, AddMilestoneInput>({
    mutationFn: (input) => addMilestone(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: milestonesKeys.list() });
    },
  });
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    capReached: args.milestoneCount >= MILESTONES_PER_USER_CAP,
    tag: milestonesTags.list(),
  };
}
