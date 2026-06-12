// apps/api/src/platform/http/error-mapper.ts
// Pure mapper: unknown thrown value → oRPC-shaped { status, body }.
// Consumed by Elysia's .onError(...) in src/app.ts and by the orpc-mount
// fall-through path. Pure: no I/O, no logger — logging happens at the
// call site so test fakes can capture it.
//
// Wire shape MUST be the canonical oRPC error JSON expected by
// @orpc/client's `isORPCErrorJson` guard: a flat object with the keys
// `{ defined, code, status, message, data }`. The client rejects bodies
// with any extra top-level key (e.g. an `error:` wrapper or a sibling
// `requestId`) — when the guard fails, the client throws a generic
// `ORPCError(getMalformedResponseErrorCode(status))` and the typed code
// (`ACCOUNT_REFERENCED_FK`, `MILESTONE_LIMIT_EXCEEDED`, etc.) is lost.
// Story 2-3 review surfaced this on the delete-account FK flow.
// `requestId` lives inside `data` so the cross-realm correlation handle
// survives without breaking the guard.

import { ZodError } from "@pekulo/zod";
import { isPekuloError, type PekuloErrorCode } from "../../common/errors";

interface OrpcErrorBody {
  defined: boolean;
  code: string;
  status: number;
  message: string;
  data: { requestId: string };
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
const ORPC_HTTP_STATUS_BY_CODE: Record<PekuloErrorCode, number> = {
  BAD_REQUEST: 400,
  // Bank-aggregator domain (story 5-6, FR-60/61/62 + NFR-31/32/33).
  // _NOT_FOUND → 404 (cross-user probe / stale id on refreshConnection).
  // _ALREADY_EXISTS → 409 (re-completeConnection of an active item).
  // _PROVIDER_UNAVAILABLE → 503 (Bridge upstream 5xx surfaces as 503 to the
  // caller). _SCA_REQUIRED → 409 (state-shape conflict: refresh blocked
  // until user reconnects via 5-7 CTA). _WEBHOOK_INVALID_SIGNATURE → 401
  // (HMAC-verified path; NFR-33 mandates 401 < 100 ms).
  BANK_CONNECTION_NOT_FOUND: 404,
  BANK_CONNECTION_ALREADY_EXISTS: 409,
  // Story 5-6 post-review aped-review: revoked items reject refreshConnection
  // with a distinct typed error code (state-shape conflict, 409) instead of
  // collapsing into the generic 404 NOT_FOUND. Clients can branch on the
  // code to surface "re-initiate via initiateConnection" instead of
  // "connection vanished".
  BANK_CONNECTION_REVOKED: 409,
  BANK_PROVIDER_UNAVAILABLE: 503,
  BANK_SCA_REQUIRED: 409,
  BANK_WEBHOOK_INVALID_SIGNATURE: 401,
  // Compass domain validation (story 1-1, FR-5): both surface as 400 — they
  // signal invalid client input to computeProgress (capitalTarget <= 0 /
  // currentWealth < 0). Keep distinct codes so clients can localise messages.
  INVALID_TARGET: 400,
  INVALID_WEALTH: 400,
  // Milestones domain (story 1-2, FR-3 / FR-4): malformed capital and
  // out-of-range year both surface as 400.
  MILESTONE_INVALID_CAPITAL: 400,
  MILESTONE_YEAR_OUT_OF_RANGE: 400,
  // CSV import (story 5-2, FR-29): csv-parse exceptions, column-count
  // mismatch, or any malformed payload surface as 400 — the client sent
  // unparseable bytes.
  INVALID_CSV: 400,
  // LLM module (story 6-1, FR-31/35 + DR-7).
  // _OPT_IN_REQUIRED → 403 (third-party egress attempted without consent).
  // _PROVIDER_UNAVAILABLE → 503 (Ollama/third-party upstream down or timeout).
  // _ROUTING_ERROR → 502 (bad gateway: malformed route / prompt-cap breach).
  LLM_OPT_IN_REQUIRED: 403,
  LLM_PROVIDER_UNAVAILABLE: 503,
  LLM_ROUTING_ERROR: 502,
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
  // Accounts 404 (story 2-1, FR-10): fires when an update or delete probe
  // walks off the userId guard (cross-user attempt or stale id). Distinct
  // code so telemetry can separate it from generic NOT_FOUND and from
  // compass/milestone-specific 404s.
  ACCOUNT_NOT_FOUND: 404,
  // Holdings 404 (story 3-1): cross-user probe or stale id on getDerived /
  // close / recordLot. Defense-in-depth shape: the explicit { id, userId }
  // guard surfaces this rather than letting RLS produce a P2025.
  HOLDING_NOT_FOUND: 404,
  // Real-estate 404 cluster (story 4-1): cross-user probe / stale id on the
  // realestate aggregate surfaces as 404. MORTGAGE_NOT_FOUND / RENTAL_NOT_FOUND
  // are emitted by update* verbs (NOT idempotent — missing child is an error);
  // detach* verbs return { ok: true } regardless.
  REALESTATE_NOT_FOUND: 404,
  MORTGAGE_NOT_FOUND: 404,
  RENTAL_NOT_FOUND: 404,
  // Transactions 404 (story 5-1): cross-user probe or stale id on get / update /
  // delete. Defense-in-depth shape: the explicit { id, userId } guard surfaces
  // this rather than letting RLS produce a confusing P2025.
  TRANSACTION_NOT_FOUND: 404,
  // Monthly sign-off (story 5-5). MONTHLY_NOT_FOUND fires when reopen targets
  // a row that doesn't exist (cross-user probe or programming error — the UI
  // only surfaces reopen on rows present in Historique). MONTHLY_OUT_OF_WINDOW
  // and MONTHLY_SIGNED_OFF are 409 — both are state-shape conflicts (the
  // request is well-formed but the world contradicts the call).
  MONTHLY_NOT_FOUND: 404,
  MONTHLY_OUT_OF_WINDOW: 409,
  MONTHLY_SIGNED_OFF: 409,
  // CSV import (story 5-2, FR-29): payload exceeded MAX_CSV_ROWS (1000)
  // before the row-loop ran. RFC-7231 § 6.5.11 maps "request entity too
  // large" to 413.
  PAYLOAD_TOO_LARGE: 413,
  // CSV import (story 5-2, FR-29): reserved code for any service-level
  // guard that decides the rows array is empty AFTER schema validation
  // (e.g. all rows filtered out post-resolution). 422 = well-formed but
  // semantically rejected. The Zod .min(1) on importCsvInputSchema covers
  // the empty-array case as 400; this code is for future "all-invalid
  // post-server-check" scenarios.
  NO_VALID_ROWS: 422,
  CONFLICT: 409,
  // Milestones cap (FR-3, ≤ 20/user) and missing compass (FR-8 precondition)
  // both surface as 409 — they signal a state-shape conflict, not malformed
  // input.
  MILESTONE_LIMIT_EXCEEDED: 409,
  COMPASS_REQUIRED: 409,
  // Accounts FK guard (story 2-1, AC-2): an account with at least one
  // referencing holding cannot be deleted — the API surfaces this as 409
  // (state-shape conflict), not as 400 (the request itself is well-formed).
  ACCOUNT_REFERENCED_FK: 409,
  // Holdings closed (story 3-1, AC-6): recordLot on a closed holding rejects
  // 409. Same shape-conflict rationale as ACCOUNT_REFERENCED_FK — request is
  // well-formed but contradicts the row state.
  HOLDING_CLOSED: 409,
  // Hypothesis projection (story 7-3, FR-57/FR-58): malformed projection
  // inputs (non-finite wealth, negative contribution, rate ∉ [0,1], horizon
  // ∉ [1,50] int) surface as 400 — defense-in-depth behind the Zod contract
  // boundary which already rejects bad wire input.
  HYPOTHESIS_INVALID_INPUT: 400,
  // Real-estate 409 (story 4-1, AC-2/AC-3): attachMortgage / attachRental on a
  // property that already has a mortgage / rental fails the UNIQUE constraint;
  // mapper raises 409 instead of letting Prisma P2002 leak through.
  MORTGAGE_ALREADY_ATTACHED: 409,
  RENTAL_ALREADY_ATTACHED: 409,
  // Transfer-pair race (story 5-3, F6 aped-review): `pairAsTransfer` ran with
  // count !== 2 — the sibling vanished (concurrent delete) or both ids resolved
  // to the same row (defensive). Surfaces as 409 because the request shape is
  // well-formed but the world state shifted under the categorise call.
  TRANSACTION_PAIR_RACE: 409,
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
    const status = ORPC_HTTP_STATUS_BY_CODE[err.code] ?? 500;
    return {
      status,
      body: {
        defined: false,
        code: err.code,
        status,
        message: err.message,
        data: { requestId },
      },
    };
  }
  if (isElysiaNotFoundError(err)) {
    return {
      status: 404,
      body: {
        defined: false,
        code: "NOT_FOUND",
        status: 404,
        message: "route not found",
        data: { requestId },
      },
    };
  }
  // Defence in depth (story 7-2 / aped-review F4): a Zod validation throw that
  // reaches here is a bad-request payload, not an internal fault. The oRPC
  // RPCHandler validates contract input BEFORE the handler runs, so for real
  // wire clients an invalid body is already a structured 400 — but a service
  // that re-parses with `schema.parse()` (e.g. dashboard-layout.service) or any
  // future internal/programmatic caller bypassing the contract would otherwise
  // surface as INTERNAL 500. Map it to BAD_REQUEST 400 instead.
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        defined: false,
        code: "BAD_REQUEST",
        status: 400,
        message: "invalid request payload",
        data: { requestId },
      },
    };
  }
  return {
    status: 500,
    body: {
      defined: false,
      code: "INTERNAL",
      status: 500,
      message: "internal server error",
      data: { requestId },
    },
  };
}
