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

// ─── Price chain (story 3-2) ─────────────────────────────────────────────
// PriceProviderError is a plain Error subclass — NOT a PekuloError. The
// orchestrator throws it when all 4 tiers fail; the caller (story 3-3's
// snapshot logic) translates it to a typed oRPC error of its choosing.
// Wrapping it in PekuloError now would force a contract error code that no
// procedure declares.

import type { PriceProviderAttempt } from "@pekulo/types";

export class PriceProviderError extends Error {
  override readonly name = "PriceProviderError";
  readonly attempts: readonly PriceProviderAttempt[];

  constructor(attempts: readonly PriceProviderAttempt[]) {
    const summary =
      attempts.length === 0
        ? "Aucun provider disponible."
        : attempts.map((a) => `${a.provider}: ${a.reason}`).join(" · ");
    super(summary);
    this.attempts = attempts;
  }
}
