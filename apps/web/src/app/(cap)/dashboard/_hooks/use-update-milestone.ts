"use client";

import { useActionMutation } from "@zapaction/query";
import { updateMilestone } from "../_actions/milestones-actions";

// Invalidation handled by the tag registry — `updateMilestone` carries
// `tags: [milestonesTags.list()]`, which the registry maps to
// `milestonesKeys.list()` + `compassKeys.setup()`.
export function useUpdateMilestone() {
  return useActionMutation(updateMilestone);
}
