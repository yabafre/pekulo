"use server";

import { defineAction } from "@zapaction/core";
import { z } from "@pekulo/zod";
import {
  aiNoticeStateSchema,
  llmActivityLogSchema,
  llmOptInSchema,
  updateLlmOptInSchema,
  type AiNoticeState,
  type LlmActivityLog,
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

// Story 6-4 (DR-12 / AC-3) — AI transparency notice "seen once" flag. Both KEEP
// `output:` (no typed error to surface). markAiNotice carries tags for Next
// revalidate; React Query invalidation comes via the hook's invalidateWithTags.
export const getAiNotice = defineAction<void, AiNoticeState, ActionContext>({
  name: "getAiNotice",
  input: z.void(),
  output: aiNoticeStateSchema,
  handler: async () => {
    await ensureRequestContext();
    return llmClient.getAiNotice();
  },
});

export const markAiNotice = defineAction<void, AiNoticeState, ActionContext>({
  name: "markAiNotice",
  input: z.void(),
  output: aiNoticeStateSchema,
  tags: [llmTags.aiNotice()],
  handler: async () => {
    await ensureRequestContext();
    return llmClient.markAiNotice();
  },
});

// Story 6-5 (FR-36) — 90-day LLM activity log read. KEEPS `output:` (no typed
// error branch to surface — the read cannot 404). No tags: read-only, nothing
// on the web tier writes the audit log, so there is no invalidation edge.
export const getLlmActivityLog = defineAction<void, LlmActivityLog, ActionContext>({
  name: "getLlmActivityLog",
  input: z.void(),
  output: llmActivityLogSchema,
  handler: async () => {
    await ensureRequestContext();
    return llmClient.getActivityLog();
  },
});
