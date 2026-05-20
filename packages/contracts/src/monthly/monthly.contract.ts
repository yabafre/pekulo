// packages/contracts/src/monthly.contract.ts
// Monthly module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/monthly).

export const monthlyContractV1 = {} as const;
export const monthlyContract = monthlyContractV1;
export const monthlyContractMeta = {
  moduleKey: "monthly",
  mountPath: "/rpc/v1/monthly",
  version: "v1",
} as const;
