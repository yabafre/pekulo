// apps/api/src/modules/realestate/realestate.errors.ts
// Typed error class + factories for the realestate domain (story 4-1).
// Extends PekuloError so the Elysia error mapper translates instances to
// oRPC error responses with stable { code, message } — REALESTATE_NOT_FOUND
// / MORTGAGE_NOT_FOUND / RENTAL_NOT_FOUND → 404; MORTGAGE_ALREADY_ATTACHED /
// RENTAL_ALREADY_ATTACHED → 409 (registered in ORPC_HTTP_STATUS_BY_CODE, T5).

import { PekuloError } from "../../common/errors";

export type RealestateErrorCode =
  | "REALESTATE_NOT_FOUND"
  | "MORTGAGE_ALREADY_ATTACHED"
  | "MORTGAGE_NOT_FOUND"
  | "RENTAL_ALREADY_ATTACHED"
  | "RENTAL_NOT_FOUND";

export class RealestateError extends PekuloError {
  override readonly name = "RealestateError";

  // Forwarding constructor narrows `code` from PekuloErrorCode (parent union)
  // to RealestateErrorCode — without it, `new RealestateError("UNAUTHORIZED", …)`
  // would type-check (mirrors HoldingError / AccountError).
  // oxlint-disable-next-line no-useless-constructor -- narrows code union (see comment above)
  constructor(code: RealestateErrorCode, message: string, options?: { cause?: unknown }) {
    super(code, message, options);
  }
}

export function realestateNotFound(): RealestateError {
  return new RealestateError("REALESTATE_NOT_FOUND", "real estate not found");
}

export function mortgageAlreadyAttached(): RealestateError {
  return new RealestateError(
    "MORTGAGE_ALREADY_ATTACHED",
    "property already has a mortgage attached",
  );
}

export function mortgageNotFound(): RealestateError {
  return new RealestateError("MORTGAGE_NOT_FOUND", "mortgage not found");
}

export function rentalAlreadyAttached(): RealestateError {
  return new RealestateError("RENTAL_ALREADY_ATTACHED", "property already has a rental attached");
}

export function rentalNotFound(): RealestateError {
  return new RealestateError("RENTAL_NOT_FOUND", "rental not found");
}
