// Typed error class for the hypothesis module. Extends PekuloError so the
// Elysia error mapper translates it to a 400 (HYPOTHESIS_INVALID_INPUT is
// registered in ORPC_HTTP_STATUS_BY_CODE). Mirrors compass.errors.ts.

import { PekuloError } from "../../common/errors";

export type HypothesisErrorCode = "HYPOTHESIS_INVALID_INPUT";

export class HypothesisError extends PekuloError {
  override readonly name = "HypothesisError";

  // Narrows `code` from PekuloErrorCode to HypothesisErrorCode (TS-level).
  // oxlint-disable-next-line no-useless-constructor
  constructor(code: HypothesisErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}
