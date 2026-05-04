// packages/contracts/src/compass.contract.ts
// Compass module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/compass).

export const compassContractV1 = {} as const;
export const compassContract = compassContractV1;
export const compassContractMeta = {
  moduleKey: "compass",
  mountPath: "/rpc/v1/compass",
  version: "v1",
} as const;
