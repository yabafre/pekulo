// Typed error class for the milestones module. Extends PekuloError so the
// Elysia error mapper translates it to an oRPC error with the matching HTTP
// status — the milestone codes are registered in ORPC_HTTP_STATUS_BY_CODE.
//
// Story 1-2 reuses `INVALID_TARGET` and `INVALID_WEALTH` from the compass
// codes (both 400) for the pure-helper guards in milestone-status.ts —
// keeps the error vocabulary stable across the epic.

import { PekuloError } from "../../common/errors";

export type MilestoneErrorCode =
  | "MILESTONE_LIMIT_EXCEEDED"
  | "MILESTONE_YEAR_OUT_OF_RANGE"
  | "MILESTONE_NOT_FOUND"
  | "MILESTONE_INVALID_CAPITAL"
  | "COMPASS_REQUIRED"
  // Reused compass codes (declared in pekulo-error.ts) — surfaced from the
  // pure helper for consistency with computeProgress's input-guard semantics.
  | "INVALID_TARGET"
  | "INVALID_WEALTH";

export class MilestoneError extends PekuloError {
  override readonly name = "MilestoneError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to MilestoneErrorCode. Without it, `new MilestoneError("UNAUTHORIZED", ...)`
  // would type-check.
  // oxlint-disable-next-line no-useless-constructor -- narrows code union (see comment above)
  constructor(code: MilestoneErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}
