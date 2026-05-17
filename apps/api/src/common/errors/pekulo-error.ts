// apps/api/src/common/errors/pekulo-error.ts
// Domain error base class — every typed error thrown by apps/api services
// (CompassError, MilestoneError, LlmRoutingError, …) extends PekuloError.
// The error-mapper matches on `code` to derive the HTTP status.

/**
 * Stable error codes for the V1 (a) personal-use phase. The list will grow
 * as feature stories add module-specific errors (e.g. `INVALID_LOT`,
 * `LLM_ROUTE_DOWN`). Keep the union sorted alphabetically for readability.
 *
 * Discipline (review F9): every new code MUST update both `PekuloErrorCode`
 * AND `ORPC_HTTP_STATUS_BY_CODE` in the same commit, with the HTTP status
 * reviewed against RFC-7231/RFC-6585. The `Record<PekuloErrorCode, number>`
 * type on `ORPC_HTTP_STATUS_BY_CODE` is the compile-time guard.
 */
export type PekuloErrorCode =
  | "ACCOUNT_NOT_FOUND"
  | "ACCOUNT_REFERENCED_FK"
  | "BAD_REQUEST"
  | "COMPASS_NOT_FOUND"
  | "COMPASS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "HOLDING_CLOSED"
  | "HOLDING_NOT_FOUND"
  | "INTERNAL"
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "MILESTONE_INVALID_CAPITAL"
  | "MILESTONE_LIMIT_EXCEEDED"
  | "MILESTONE_NOT_FOUND"
  | "MILESTONE_YEAR_OUT_OF_RANGE"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TRANSACTION_FAILED"
  | "UNAUTHORIZED";

const PEKULO_ERROR_CODES: ReadonlySet<PekuloErrorCode> = new Set<PekuloErrorCode>([
  "ACCOUNT_NOT_FOUND",
  "ACCOUNT_REFERENCED_FK",
  "BAD_REQUEST",
  "COMPASS_NOT_FOUND",
  "COMPASS_REQUIRED",
  "CONFLICT",
  "FORBIDDEN",
  "HOLDING_CLOSED",
  "HOLDING_NOT_FOUND",
  "INTERNAL",
  "INVALID_TARGET",
  "INVALID_WEALTH",
  "MILESTONE_INVALID_CAPITAL",
  "MILESTONE_LIMIT_EXCEEDED",
  "MILESTONE_NOT_FOUND",
  "MILESTONE_YEAR_OUT_OF_RANGE",
  "NOT_FOUND",
  "RATE_LIMITED",
  "TRANSACTION_FAILED",
  "UNAUTHORIZED",
]);

export class PekuloError extends Error {
  // Typed `string` (not the literal "PekuloError") so subclasses like
  // CompassError can narrow it to their own literal name without TS2416.
  // Runtime duck-type in isPekuloError() still demands exact equality, so
  // cross-realm payloads with mutated names cannot pass through.
  override readonly name: string = "PekuloError";
  readonly code: PekuloErrorCode;

  constructor(code: PekuloErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

/**
 * Type guard. Use in `catch` blocks: `if (isPekuloError(err)) ...`.
 *
 * In-realm: `instanceof PekuloError` covers it (same goes for subclasses
 * like CompassError extends PekuloError).
 *
 * Cross-realm fallback (Bun workers, queue redelivery, IPC re-throws):
 * the duck-type requires `name === "PekuloError"`, `code` to be a known
 * `PekuloErrorCode`, AND `message` to be a string — so a malformed payload
 * with `{ name: "PekuloError", code: "BOGUS" }` or no `message` cannot
 * pass and reach the mapper with an undefined HTTP status (review F4).
 */
export function isPekuloError(err: unknown): err is PekuloError {
  if (err instanceof PekuloError) return true;
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    "code" in err &&
    "message" in err &&
    (err as { name: unknown }).name === "PekuloError" &&
    typeof (err as { message: unknown }).message === "string" &&
    typeof (err as { code: unknown }).code === "string" &&
    PEKULO_ERROR_CODES.has((err as { code: PekuloErrorCode }).code)
  ) {
    return true;
  }
  return false;
}
