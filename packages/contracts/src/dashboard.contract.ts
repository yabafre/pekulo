// packages/contracts/src/dashboard.contract.ts
// Dashboard module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/dashboard).

export const dashboardContractV1 = {} as const;
export const dashboardContract = dashboardContractV1;
export const dashboardContractMeta = {
  moduleKey: "dashboard",
  mountPath: "/rpc/v1/dashboard",
  version: "v1",
} as const;
