"use client";

import { useActionMutation } from "@zapaction/query";
import { milestonesTags } from "@/lib/zapaction/keys";
import { updateMilestone } from "../_actions/milestones-actions";

// invalidateWithTags explicit per lessons.md 2026-05-24 — action.tags is
// server-only (Next.js SA boundary strips it).
export function useUpdateMilestone() {
  return useActionMutation(updateMilestone, {
    invalidateWithTags: [milestonesTags.list()],
  });
}
