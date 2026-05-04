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
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

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
