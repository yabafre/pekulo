// packages/contracts/src/holdings.contract.ts
// Holdings module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/holdings).

export const holdingsContractV1 = {} as const;
export const holdingsContract = holdingsContractV1;
export const holdingsContractMeta = {
  moduleKey: "holdings",
  mountPath: "/rpc/v1/holdings",
  version: "v1",
} as const;
