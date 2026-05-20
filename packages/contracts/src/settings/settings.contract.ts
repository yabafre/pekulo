// packages/contracts/src/settings.contract.ts
// Settings module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/settings).

export const settingsContractV1 = {} as const;
export const settingsContract = settingsContractV1;
export const settingsContractMeta = {
  moduleKey: "settings",
  mountPath: "/rpc/v1/settings",
  version: "v1",
} as const;
