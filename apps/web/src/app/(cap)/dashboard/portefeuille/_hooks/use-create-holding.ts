"use client";

import { useActionMutation } from "@zapaction/query";
import { holdingsTags } from "@/lib/zapaction/keys";
import { createHolding } from "../_actions/holdings-actions";

// Envelope `{ ok: false }` is data, surfaced to the form. The tag registry
// invalidates `holdingsKeys.list()` + portfolio aggregate on success — no
// manual orchestration needed.
export function useCreateHolding() {
  return useActionMutation(createHolding, {
    invalidateWithTags: [holdingsTags.list()],
  });
}
