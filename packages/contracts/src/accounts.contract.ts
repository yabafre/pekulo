// packages/contracts/src/accounts.contract.ts
// Accounts module oRPC contract. Four procedures:
//   - create: insert an account; returns the new Account row.
//   - update: patch label/type/currency/cashBalance/notes of an existing account.
//   - delete: remove an account scoped by id+userId (FK-guarded at service layer).
//   - list:   read all accounts for the user, ordered by createdAt asc.
// See ADR-0009 (mount under /rpc/v1/accounts).
//
// Story 2-3 review: declared error codes (`ACCOUNT_NOT_FOUND`,
// `ACCOUNT_REFERENCED_FK`) propagate as typed `defined` errors through
// `@orpc/client`'s `isDefinedError(err)` discriminator. The server-side
// error-mapper still emits these as canonical oRPC error JSON (see
// apps/api/src/platform/http/error-mapper.ts); declaring them here lets
// the web SAs branch on `err.code` with full type safety.

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

// Declared errors propagate as typed `defined` ORPCError instances on the
// client. `isDefinedError(err)` returns true when the wire JSON's `code`
// matches a declared entry — the web SAs can then narrow `err.code` with
// full TS safety. Data schema omitted: the server attaches `requestId`
// inside `data` regardless (see error-mapper.ts), and clients only branch
// on `code`. Status codes mirror ORPC_HTTP_STATUS_BY_CODE.
const accountNotFoundError = {
  status: 404 as const,
  message: "account not found",
};

const accountReferencedFkError = {
  status: 409 as const,
  message: "account is referenced by holding(s)",
};

export const accountsContractV1 = {
  create: oc.input(createAccountInputSchema).output(accountSchema),
  update: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(updateAccountInputSchema)
    .output(accountSchema),
  delete: oc
    .errors({
      ACCOUNT_NOT_FOUND: accountNotFoundError,
      ACCOUNT_REFERENCED_FK: accountReferencedFkError,
    })
    .input(deleteAccountInputSchema)
    .output(deleteAccountOutputSchema),
  list: oc.output(listAccountsOutputSchema),
  recordBalanceChange: oc
    .errors({ ACCOUNT_NOT_FOUND: accountNotFoundError })
    .input(recordBalanceChangeInputSchema)
    .output(recordBalanceChangeOutputSchema),
} as const;

export const accountsContract = accountsContractV1;
export const accountsContractMeta = {
  moduleKey: "accounts",
  mountPath: "/rpc/v1/accounts",
  version: "v1",
} as const;
