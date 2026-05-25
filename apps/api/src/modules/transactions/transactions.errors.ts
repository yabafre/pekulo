// Typed error class for the transactions module (story 5-1). Extends
// PekuloError so the Elysia error mapper translates it to an oRPC error with
// the matching HTTP status — TRANSACTION_NOT_FOUND → 404 is registered in
// ORPC_HTTP_STATUS_BY_CODE (T3). ACCOUNT_NOT_FOUND is reused from the
// accounts module for the cross-aggregate guard.

import { PekuloError } from "../../common/errors";

export type TransactionErrorCode = "TRANSACTION_NOT_FOUND";

export class TransactionsError extends PekuloError {
  override readonly name = "TransactionsError";

  // oxlint-disable-next-line no-useless-constructor -- narrows code union to TransactionErrorCode
  constructor(code: TransactionErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function transactionNotFound(id: string): TransactionsError {
  return new TransactionsError("TRANSACTION_NOT_FOUND", `transaction not found: ${id}`);
}
