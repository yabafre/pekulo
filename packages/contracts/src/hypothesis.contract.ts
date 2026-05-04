// packages/contracts/src/hypothesis.contract.ts
// Hypothesis module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/hypothesis).

export const hypothesisContractV1 = {} as const;
export const hypothesisContract = hypothesisContractV1;
export const hypothesisContractMeta = {
  moduleKey: "hypothesis",
  mountPath: "/rpc/v1/hypothesis",
  version: "v1",
} as const;
