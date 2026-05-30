// packages/contracts/src/llm/llm.contract.ts
// Llm module oRPC contract. Story 6-3 (FR-34) adds the FIRST client-facing
// procedures: getOptIn (read the per-user third-party opt-in flag) + setOptIn
// (write it). Mount under /rpc/v1/llm (ADR-0009). The /internal/llm/attest
// listener (story 6-1) stays Elysia-native and is NOT part of this contract.
import { oc } from "@orpc/contract";
import { llmOptInSchema, updateLlmOptInSchema } from "@pekulo/validators";

export const llmContractV1 = {
  getOptIn: oc.output(llmOptInSchema),
  setOptIn: oc.input(updateLlmOptInSchema).output(llmOptInSchema),
} as const;

export const llmContract = llmContractV1;
export const llmContractMeta = {
  moduleKey: "llm",
  mountPath: "/rpc/v1/llm",
  version: "v1",
} as const;
