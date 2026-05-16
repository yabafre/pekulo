// packages/contracts/src/accounts.contract.ts
// Accounts module oRPC contract. Four procedures:
//   - create: insert an account; returns the new Account row.
//   - update: patch label/type/currency/cashBalance/notes of an existing account.
//   - delete: remove an account scoped by id+userId (FK-guarded at service layer).
//   - list:   read all accounts for the user, ordered by createdAt asc.
// See ADR-0009 (mount under /rpc/v1/accounts).

import { oc } from "@orpc/contract";
import {
  accountSchema,
  createAccountInputSchema,
  deleteAccountInputSchema,
  deleteAccountOutputSchema,
  listAccountsOutputSchema,
  recordBalanceChangeInputSchema,
  recordBalanceChangeOutputSchema,
  updateAccountInputSchema,
} from "@pekulo/validators";

export const accountsContractV1 = {
  create: oc.input(createAccountInputSchema).output(accountSchema),
  update: oc.input(updateAccountInputSchema).output(accountSchema),
  delete: oc.input(deleteAccountInputSchema).output(deleteAccountOutputSchema),
  list: oc.output(listAccountsOutputSchema),
  recordBalanceChange: oc
    .input(recordBalanceChangeInputSchema)
    .output(recordBalanceChangeOutputSchema),
} as const;

export const accountsContract = accountsContractV1;
export const accountsContractMeta = {
  moduleKey: "accounts",
  mountPath: "/rpc/v1/accounts",
  version: "v1",
} as const;
