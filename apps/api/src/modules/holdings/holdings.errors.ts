// Typed error class for the holdings module. Extends PekuloError so the
// Elysia error mapper translates it to an oRPC error with the matching HTTP
// status — HOLDING_NOT_FOUND → 404 and HOLDING_CLOSED → 409 are both
// registered in ORPC_HTTP_STATUS_BY_CODE (story 3-1 T3).
//
// Factories ensure messages are stable so the mapper + telemetry can group
// them safely.

import { PekuloError } from "../../common/errors";

export type HoldingErrorCode = "HOLDING_NOT_FOUND" | "HOLDING_CLOSED";

export class HoldingError extends PekuloError {
  override readonly name = "HoldingError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to HoldingErrorCode — without it, `new HoldingError("UNAUTHORIZED", ...)`
  // would type-check (mirrors AccountError's pattern).
  // oxlint-disable-next-line no-useless-constructor -- narrows code union (see comment above)
  constructor(code: HoldingErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function holdingNotFound(): HoldingError {
  return new HoldingError("HOLDING_NOT_FOUND", "holding not found");
}

export function holdingClosed(): HoldingError {
  return new HoldingError("HOLDING_CLOSED", "holding is closed");
}
