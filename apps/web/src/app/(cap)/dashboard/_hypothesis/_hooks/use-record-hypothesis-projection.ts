"use client";

import { useActionMutation } from "@zapaction/query";
import { hypothesesTags } from "@/lib/zapaction/keys";
import { recordHypothesisProjection } from "../_actions/hypothesis-actions";

// Story 7-3 — record-projection mutation (FR-57). Registry-SSOT invalidation
// (R4): invalidateWithTags drives the refetch of hypothesesKeys.current() AND
// every hypothesesKeys.projection(*) via the edge in keys.ts. No optimistic
// onMutate (opt-in only, lesson 2026-05-25).
export function useRecordHypothesisProjection() {
  return useActionMutation(recordHypothesisProjection, {
    invalidateWithTags: [hypothesesTags.current()],
  });
}
