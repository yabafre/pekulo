// packages/contracts/src/realestate.contract.ts
// Realestate module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/realestate).

export const realestateContractV1 = {} as const;
export const realestateContract = realestateContractV1;
export const realestateContractMeta = {
  moduleKey: "realestate",
  mountPath: "/rpc/v1/realestate",
  version: "v1",
} as const;
