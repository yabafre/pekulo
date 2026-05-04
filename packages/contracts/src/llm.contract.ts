// packages/contracts/src/llm.contract.ts
// Llm module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/llm).

export const llmContractV1 = {} as const;
export const llmContract = llmContractV1;
export const llmContractMeta = {
  moduleKey: "llm",
  mountPath: "/rpc/v1/llm",
  version: "v1",
} as const;
