// packages/contracts/src/transactions.contract.ts
// Transactions module oRPC contract — empty scaffold; procedures land with feature
// stories. See ADR-0009 (mount under /rpc/v1/transactions).

export const transactionsContractV1 = {} as const;
export const transactionsContract = transactionsContractV1;
export const transactionsContractMeta = {
  moduleKey: "transactions",
  mountPath: "/rpc/v1/transactions",
  version: "v1",
} as const;
