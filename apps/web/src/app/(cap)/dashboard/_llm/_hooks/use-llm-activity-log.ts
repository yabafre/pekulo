"use client";

import { useActionQuery } from "@zapaction/query";
import { llmKeys } from "@/lib/zapaction/keys";
import { getLlmActivityLog } from "../_actions/llm-actions";

// Story 6-5 (FR-36) — read-only 90-day activity log. No mutation pairs with it
// (the web tier never writes llm_call_log), so there is no useActionMutation
// sibling and no invalidateWithTags edge — it refreshes on staleTime. Mirrors
// useLlmOptIn's read shape.
export function useLlmActivityLog() {
  return useActionQuery(getLlmActivityLog, {
    input: undefined,
    queryKey: llmKeys.activityLog(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}
