// apps/mobile/lib/orpc/errors.ts
// Small helpers to read the typed error a `@pekulo/contracts` call rejected with.

import { ORPCError } from "@orpc/client";

/** The oRPC error code (`"UNAUTHORIZED"`, `"ACCOUNT_PARTIALLY_ERASED"`, …) or `null`. */
export function orpcErrorCode(error: unknown): string | null {
  return error instanceof ORPCError ? error.code : null;
}

/** The API rejected the Bearer token (expired, revoked or invalid). */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ORPCError && (error.code === "UNAUTHORIZED" || error.status === 401);
}
