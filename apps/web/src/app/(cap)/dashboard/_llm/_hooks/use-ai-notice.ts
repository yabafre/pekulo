"use client";

import { useActionMutation, useActionQuery } from "@zapaction/query";
import { llmKeys, llmTags } from "@/lib/zapaction/keys";
import { getAiNotice, markAiNotice } from "../_actions/llm-actions";

export function useAiNotice() {
  return useActionQuery(getAiNotice, {
    input: undefined,
    queryKey: llmKeys.aiNotice(),
    readPolicy: "read-only",
    staleTime: 60_000,
  });
}

export function useMarkAiNotice() {
  return useActionMutation(markAiNotice, { invalidateWithTags: [llmTags.aiNotice()] });
}
