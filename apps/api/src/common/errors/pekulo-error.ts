// apps/api/src/common/errors/pekulo-error.ts
// Domain error base class — every typed error thrown by apps/api services
// (CompassError, LlmRoutingError, …) extends PekuloError. The error-mapper
// matches on `code` to derive the HTTP status.

/**
 * Stable error codes for the V1 (a) personal-use phase. The list will grow
 * as feature stories add module-specific errors (e.g. `INVALID_LOT`,
 * `LLM_ROUTE_DOWN`). Keep the union sorted alphabetically for readability.
 */
export type PekuloErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED";

export class PekuloError extends Error {
  override readonly name = "PekuloError";
  readonly code: PekuloErrorCode;

  constructor(code: PekuloErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

/**
 * Type guard. Use in `catch` blocks: `if (isPekuloError(err)) ...`.
 * Plays nicely with `instanceof` across realm boundaries (Bun workers, etc.)
 * by checking the `name` field as a fallback.
 */
export function isPekuloError(err: unknown): err is PekuloError {
  if (err instanceof PekuloError) return true;
  if (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    "code" in err &&
    (err as { name: unknown }).name === "PekuloError"
  ) {
    return true;
  }
  return false;
}
