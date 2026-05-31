"use client";

import { useActionMutation, useActionQuery } from "@zapaction/query";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";
import { getLlmOptIn, setLlmOptIn } from "../_actions/llm-actions";

export function useLlmOptIn() {
  return useActionQuery(getLlmOptIn, {
    input: undefined,
    queryKey: llmKeys.optIn(),
    readPolicy: "read-only",
    staleTime: 30_000,
  });
}

// invalidateWithTags explicit — the SA boundary strips `action.tags`
// (lessons.md 2026-05-24). The registry maps llmTags.optIn() → llmKeys.optIn().
export function useSetLlmOptIn() {
  return useActionMutation(setLlmOptIn, {
    invalidateWithTags: [llmTags.optIn()],
  });
}
