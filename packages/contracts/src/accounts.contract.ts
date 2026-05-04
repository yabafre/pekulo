// packages/contracts/src/accounts.contract.ts
// Accounts module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/accounts).

export const accountsContractV1 = {} as const;
export const accountsContract = accountsContractV1;
export const accountsContractMeta = {
  moduleKey: "accounts",
  mountPath: "/rpc/v1/accounts",
  version: "v1",
} as const;
