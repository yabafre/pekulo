// packages/contracts/src/llm/llm.contract.ts
// Llm module oRPC contract. Story 6-3 (FR-34) adds the FIRST client-facing
// procedures: getOptIn (read the per-user third-party opt-in flag) + setOptIn
// (write it). Story 6-4 (DR-12) adds the AI-notice "seen" pair. Story 6-5
// (FR-36) adds getActivityLog — the 90-day audit read. Mount under /rpc/v1/llm
// (ADR-0009). The /internal/llm/attest listener (story 6-1) stays Elysia-native
// and is NOT part of this contract.
import { oc } from "@orpc/contract";
import {
  aiNoticeStateSchema,
  llmActivityLogSchema,
  llmOptInSchema,
  updateLlmOptInSchema,
} from "@pekulo/validators";

export const llmContractV1 = {
  getOptIn: oc.output(llmOptInSchema),
  setOptIn: oc.input(updateLlmOptInSchema).output(llmOptInSchema),
  // Story 6-4 (DR-12 / AC-3) — AI transparency notice "seen once" flag.
  getAiNotice: oc.output(aiNoticeStateSchema),
  markAiNotice: oc.output(aiNoticeStateSchema),
  // Story 6-5 (FR-36) — 90-day LLM activity log read. No input (the userId is
  // taken from the verified JWT context server-side, never the client).
  getActivityLog: oc.output(llmActivityLogSchema),
} as const;

export const llmContract = llmContractV1;
export const llmContractMeta = {
  moduleKey: "llm",
  mountPath: "/rpc/v1/llm",
  version: "v1",
} as const;
