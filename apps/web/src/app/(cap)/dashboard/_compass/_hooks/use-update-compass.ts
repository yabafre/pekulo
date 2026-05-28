"use client";

import { useActionMutation } from "@zapaction/query";
import { compassTags } from "@/lib/zapaction/keys";
import { updateCompass } from "../_actions/compass-actions";

// invalidateWithTags explicit — see lessons.md 2026-05-24 entry
// "defineAction tags is server-only" for the SA-boundary rationale.
// `compassTags.current()` maps in the registry to compassKeys.{current,
// setup,progress,curve,history} + milestonesKeys.list() — one tag, full
// downstream invalidation.
export function useUpdateCompass() {
  return useActionMutation(updateCompass, {
    invalidateWithTags: [compassTags.current()],
  });
}
