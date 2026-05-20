"use client";

import { useActionMutation } from "@zapaction/query";
import { MILESTONES_PER_USER_CAP } from "@pekulo/validators";
import { milestonesTags } from "@/lib/zapaction/keys";
import { addMilestone } from "../_actions/milestones-actions";

// Mutation orchestrator. Component reads `{ submit, isPending, capReached }`
// directly — no separate useForm hook in this V1 pass; the form component
// handles its own field state via component-local useState (architecture
// L192 — boundary rule). When epic 5 lands the import-csv form, we promote
// the TanStack-Form orchestrator pattern.
//
// Invalidation: `addMilestone` carries `tags: [milestonesTags.list()]`, and
// the tag registry (lib/zapaction/keys.ts) maps that tag to both
// `milestonesKeys.list()` AND `compassKeys.setup()` — so adding the first
// milestone flips the setup state from "incomplete" to "complete" and the
// dashboard re-renders the donut + milestones-section without a manual
// invalidate here.
export function useAddMilestoneForm(args: { milestoneCount: number }) {
  const mutation = useActionMutation(addMilestone);
  return {
    submit: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
    capReached: args.milestoneCount >= MILESTONES_PER_USER_CAP,
    tag: milestonesTags.list(),
  };
}
