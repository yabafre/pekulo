// Typed error class for the accounts module. Extends PekuloError so the
// Elysia error mapper translates it to an oRPC error with the matching HTTP
// status — ACCOUNT_NOT_FOUND → 404 and ACCOUNT_REFERENCED_FK → 409 are both
// registered in ORPC_HTTP_STATUS_BY_CODE (story 2-1 T3).
//
// Factories ensure messages are stable so the mapper + telemetry can group
// them safely.

import { PekuloError } from "../../common/errors";

export type AccountErrorCode = "ACCOUNT_NOT_FOUND" | "ACCOUNT_REFERENCED_FK";

export class AccountError extends PekuloError {
  override readonly name = "AccountError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to AccountErrorCode — without it, `new AccountError("UNAUTHORIZED", ...)`
  // would type-check (mirrors MilestoneError's pattern).
  // oxlint-disable-next-line no-useless-constructor -- narrows code union (see comment above)
  constructor(code: AccountErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function accountNotFound(): AccountError {
  return new AccountError("ACCOUNT_NOT_FOUND", "account not found");
}

export function accountReferencedFk(holdingCount: number): AccountError {
  return new AccountError(
    "ACCOUNT_REFERENCED_FK",
    `account is referenced by ${holdingCount} holding${holdingCount === 1 ? "" : "s"}`,
  );
}
