// apps/web/src/lib/user-error-message.ts
// Maps any thrown/query error to a single generic, user-facing French
// message. We never surface raw `error.message` to the user: those strings
// are English/technical (oRPC envelopes, fetch failures, stack traces) and
// can leak internals. Components keep the technical detail in `console.error`
// for debugging and render `USER_ERROR_MESSAGE` instead.

/** Generic French copy shown to the end user for any unhandled error. */
export const USER_ERROR_MESSAGE = "Une erreur est survenue. Réessayez.";

/**
 * Returns the generic French error message and logs the underlying technical
 * detail to the console (preserving the original error for debugging).
 *
 * @param error - the caught/query error (logged, never shown verbatim)
 * @param context - optional label to scope the console group (e.g. "accounts")
 */
export function userErrorMessage(error: unknown, context?: string): string {
  if (error != null) {
    // eslint-disable-next-line no-console
    console.error(context ? `[${context}]` : "[error]", error);
  }
  return USER_ERROR_MESSAGE;
}
