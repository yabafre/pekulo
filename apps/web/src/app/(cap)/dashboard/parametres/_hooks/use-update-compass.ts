"use client";

import { useActionMutation } from "@zapaction/query";
import { updateCompass } from "../../_actions/compass-actions";

// Compass change moves the donut + curve + history + every milestone status
// (linear-plan target shifted). `updateCompass.tags` carries `compassTags
// .current()`; the registry maps that to `compassKeys.{current,setup,
// progress,curve,history}`. Milestones list invalidation comes from the
// downstream wire — see lib/zapaction/keys.ts for the registry mappings.
export function useUpdateCompass() {
  return useActionMutation(updateCompass);
}
