// Typed error class for the compass module. Extends PekuloError so the Elysia
// error mapper translates it to an oRPC error with the matching HTTP status —
// the four compass codes are registered in ORPC_HTTP_STATUS_BY_CODE.

import { PekuloError } from "../../common/errors";

export type CompassErrorCode =
  | "INVALID_TARGET"
  | "INVALID_WEALTH"
  | "COMPASS_NOT_FOUND"
  | "TRANSACTION_FAILED";

export class CompassError extends PekuloError {
  override readonly name = "CompassError";

  constructor(code: CompassErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}
