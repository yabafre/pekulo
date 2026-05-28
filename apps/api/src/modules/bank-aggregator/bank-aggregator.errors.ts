// apps/api/src/modules/bank-aggregator/bank-aggregator.errors.ts
// Typed error class + factories for the bank-aggregator domain (story 5-6).
// Extends PekuloError so the Elysia error mapper translates instances to
// oRPC error responses with stable { code, message } per
// ORPC_HTTP_STATUS_BY_CODE:
//   BANK_CONNECTION_NOT_FOUND          → 404
//   BANK_CONNECTION_ALREADY_EXISTS     → 409
//   BANK_CONNECTION_REVOKED            → 409 (revoked items reject refreshConnection)
//   BANK_PROVIDER_UNAVAILABLE          → 503
//   BANK_SCA_REQUIRED                  → 409
//   BANK_WEBHOOK_INVALID_SIGNATURE     → 401 (NFR-33 fast-path, < 100 ms)
//   RATE_LIMITED                       → 429 (AC-9 refresh rate-limit)

import { PekuloError } from "../../common/errors";

export type BankAggregatorErrorCode =
  | "BANK_CONNECTION_NOT_FOUND"
  | "BANK_CONNECTION_ALREADY_EXISTS"
  | "BANK_CONNECTION_REVOKED"
  | "BANK_PROVIDER_UNAVAILABLE"
  | "BANK_SCA_REQUIRED"
  | "BANK_WEBHOOK_INVALID_SIGNATURE"
  | "RATE_LIMITED";

export class BankAggregatorError extends PekuloError {
  override readonly name = "BankAggregatorError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to BankAggregatorErrorCode — mirrors RealestateError / AccountError.
  // oxlint-disable-next-line no-useless-constructor -- narrows code union
  constructor(code: BankAggregatorErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function bankConnectionNotFound(connectionId: string): BankAggregatorError {
  return new BankAggregatorError(
    "BANK_CONNECTION_NOT_FOUND",
    `bank connection ${connectionId} not found`,
  );
}

export function bankConnectionAlreadyExists(providerItemId: string): BankAggregatorError {
  return new BankAggregatorError(
    "BANK_CONNECTION_ALREADY_EXISTS",
    `bank connection already exists for provider item ${providerItemId}`,
  );
}

export function bankProviderUnavailable(reason: string): BankAggregatorError {
  return new BankAggregatorError(
    "BANK_PROVIDER_UNAVAILABLE",
    `bank provider unavailable: ${reason}`,
  );
}

export function bankWebhookInvalidSignature(): BankAggregatorError {
  return new BankAggregatorError("BANK_WEBHOOK_INVALID_SIGNATURE", "invalid webhook signature");
}

export function bankScaRequired(connectionId: string): BankAggregatorError {
  return new BankAggregatorError(
    "BANK_SCA_REQUIRED",
    `SCA refresh required for connection ${connectionId} — user must reconnect`,
  );
}

export function bankConnectionRevoked(connectionId: string): BankAggregatorError {
  return new BankAggregatorError(
    "BANK_CONNECTION_REVOKED",
    `bank connection ${connectionId} is revoked — re-initiate via initiateConnection`,
  );
}

export function bankRefreshRateLimited(retryAfterSeconds: number): BankAggregatorError {
  return new BankAggregatorError(
    "RATE_LIMITED",
    `refresh rate limit exceeded — retry in ${retryAfterSeconds}s`,
  );
}
