"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  llmOptInSchema,
  updateLlmOptInSchema,
  type LlmOptInState,
  type UpdateLlmOptInInput,
} from "@pekulo/validators";
import { llmClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { llmTags } from "@/lib/zapaction/keys";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

// Story 6-3 (FR-34) — third-party LLM opt-in. Both procedures return a plain
// { thirdParty } object (no typed contract error to surface — opt-in cannot
// 404), so each KEEPS the `output:` slot (mirrors createAccount; the
// envelope-without-output rule applies only to typed-error branches).

export const getLlmOptIn = defineAction<void, LlmOptInState, ActionContext>({
  name: "getLlmOptIn",
  input: z.void(),
  output: llmOptInSchema,
  handler: async () => {
    await ensureRequestContext();
    return llmClient.getOptIn();
  },
});

export const setLlmOptIn = defineAction<UpdateLlmOptInInput, LlmOptInState, ActionContext>({
  name: "setLlmOptIn",
  input: updateLlmOptInSchema,
  output: llmOptInSchema,
  tags: [llmTags.optIn()],
  handler: async ({ input }) => {
    await ensureRequestContext();
    return llmClient.setOptIn(input);
  },
});
