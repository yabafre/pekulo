// packages/contracts/src/auth.contract.ts
// Auth module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/auth).

export const authContractV1 = {} as const;
export const authContract = authContractV1;
export const authContractMeta = {
  moduleKey: "auth",
  mountPath: "/rpc/v1/auth",
  version: "v1",
} as const;
