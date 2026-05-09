// apps/api/src/platform/http/error-mapper.ts
// Pure mapper: unknown thrown value → oRPC-shaped { status, body }.
// Consumed by Elysia's .onError(...) in src/app.ts and by the orpc-mount
// fall-through path. Pure: no I/O, no logger — logging happens at the
// call site so test fakes can capture it.

import { isPekuloError, type PekuloErrorCode } from "../../common/errors";

export interface OrpcErrorBody {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface MappedErrorResponse {
  status: number;
  body: OrpcErrorBody;
}

/**
 * Stable `code → HTTP status` lookup. Mirrors typical RPC conventions.
 * UNAUTHORIZED → 401, FORBIDDEN → 403, NOT_FOUND → 404, BAD_REQUEST → 400,
 * CONFLICT → 409, RATE_LIMITED → 429, INTERNAL → 500.
 */
export const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  // Compass domain validation (story 1-1, FR-5): both surface as 400 — they
  // signal invalid client input to computeProgress (capitalTarget <= 0 /
  // currentWealth < 0). Keep distinct codes so clients can localise messages.
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  // Milestones domain (story 1-2, FR-3 / FR-4): malformed capital and
  // out-of-range year both surface as 400.
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  // Compass-specific 404 (story 1-1) — distinguishes "compass row missing"
  // from generic NOT_FOUND so dashboard can branch on the setup CTA (FR-8).
  COMPASS_NOT_FOUND: 404,
  // Milestones 404 — preserved when a cross-user delete probe walks off the
  // userId guard (AC-8). Distinct from NOT_FOUND so future telemetry can
  // separate "row missing" from "route missing".
  MILESTONE_NOT_FOUND: 404,
  CONFLICT: 409,
  // Milestones cap (FR-3, ≤ 20/user) and missing compass (FR-8 precondition)
  // both surface as 409 — they signal a state-shape conflict, not malformed
  // input.
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  // Compass repository $transaction failure surfaces as 500 — the audit
  // write and the upsert must commit atomically; partial state is unrecoverable.
  TRANSACTION_FAILED: 500,
};

/**
 * Detect Elysia framework's `NotFoundError` shape.
 *
 * Elysia 1.4.x throws on unmatched routes with `{ name: "Error", code: "NOT_FOUND",
 * status: 404, message: "NOT_FOUND" }`. The `name` is the generic "Error"
 * (Elysia doesn't override it on subclasses), so `isPekuloError` rejects it
 * (strict `name === "PekuloError"` check). Without this branch, every
 * unmapped path (`/`, `/favicon.ico`, scanner traffic) falls through to
 * INTERNAL 500 instead of NOT_FOUND 404. Surfaced 2026-05-05 on Dokploy
 * deploy when scanner traffic generated INTERNAL noise; reproduced locally
 * with `curl /openapi`. See L11 in lessons.md.
 */
function isElysiaNotFoundError(err: unknown): err is { code: "NOT_FOUND" } {
  return (
    err !== null &&
    typeof err === "object" &&
    "code" in err &&
    (err as { code: unknown }).code === "NOT_FOUND"
  );
}

/**
 * Map any thrown value to an oRPC-shaped response.
 *
 * Every response carries a `requestId` so logs and the wire body share a
 * stable correlation handle — chosen over the original "PekuloError → no
 * requestId" design because the orpc-mount fall-through (AC-4) needs the
 * id to correlate a 404 back to the failing request.
 *
 * The caller (apps/api/src/app.ts) generates the requestId BEFORE logging
 * so the log line and the wire body share the same id; `mapErrorToOrpcResponse`
 * accepts it as a parameter rather than allocating internally (review F3).
 *
 * - `PekuloError`: status from the lookup, body carries the error's `code`
 *   + `message` + the requestId.
 * - Elysia `NotFoundError` (unmapped route): status 404, body carries
 *   `code: "NOT_FOUND"` + a sanitised message + the requestId.
 * - native `Error` / non-Error: status 500, message sanitised, body carries
 *   `code: "INTERNAL"` + the requestId.
 *
 * Once `apps/api/src/common/ids/request-id.ts` ships in a future story,
 * the caller swaps `crypto.randomUUID()` for the project helper — this
 * function stays unchanged.
 */
export function mapErrorToOrpcResponse(err: unknown, requestId: string): MappedErrorResponse {
  if (isPekuloError(err)) {
    return {
      status: ORPC_HTTP_STATUS_BY_CODE[err.code] ?? 500,
      body: {
        error: {
          code: err.code,
          message: err.message,
          requestId,
        },
      },
    };
  }
  if (isElysiaNotFoundError(err)) {
    return {
      status: 404,
      body: {
        error: {
          code: "NOT_FOUND",
          message: "route not found",
          requestId,
        },
      },
    };
  }
  return {
    status: 500,
    body: {
      error: {
        code: "INTERNAL",
        message: "internal server error",
        requestId,
      },
    },
  };
}
