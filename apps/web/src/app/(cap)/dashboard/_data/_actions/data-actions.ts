"use server";

// apps/web/src/app/(cap)/dashboard/_data/_actions/data-actions.ts
// The « Vos données » feature's server actions (one file per feature). Story
// 11-1's export needs none — the browser downloads `/v1/export` directly —
// so the file holds story 11-2's deletion (FR-50) alone for now.
//
// Thin oRPC delegator — zero business logic on the web tier (ADR-0010). Its
// one web-tier responsibility is clearing the session AFTER the account is
// gone: the httpOnly auth cookies (story 11-7) survive the Supabase Auth
// user, so without this the browser would keep presenting a cookie for a
// user that no longer exists.
//
// No `tags`: there is nothing left to invalidate, and the user is about to
// leave the app.
//
// Typed failures travel as an ENVELOPE, never as a thrown error: Next
// replaces the message of an error thrown from a server action with a
// generic one in production, so a thrown ORPCError reaches the dialog with
// its code gone and the dialog can only say "something failed". The
// envelope carries the code across (same shape as _bank's
// bank-aggregator-actions.ts for the identical BANK_PROVIDER_UNAVAILABLE).
// No `output:` on purpose — zapaction would parse the `ok: false` arm away
// (lesson 2026-05-20).
//
// The success branch ENDS with a server-side redirect rather than a return
// value. Clearing the cookies makes Next re-render the current route inside
// the action response, and that route cannot render without a session (its
// sections call apps/api) — seen live, the client was left on a blank page
// and the action promise never settled. `redirect()` short-circuits that
// re-render: Next answers with a navigation to `/`, and the root page sends
// the now-anonymous visitor on to /login (docs/ux/flows.md § Account
// deletion says "redirect to /"; where `/` bounces an unauthenticated
// visitor is the root page's decision, not this action's).
import { redirect } from "next/navigation";
import { defineAction } from "@zapaction/core";
import { ORPCError } from "@orpc/client";
import { deleteUserAccountInputSchema, type DeleteUserAccountInput } from "@pekulo/validators";
import { settingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { createClient } from "@/lib/supabase/server";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

/** Codes the dialog can name. Anything else is an unexpected failure. */
export type DeleteUserAccountErrorCode =
  | "BANK_PROVIDER_UNAVAILABLE"
  | "ACCOUNT_PARTIALLY_ERASED"
  | "FORBIDDEN";

const DELETE_USER_ACCOUNT_ERROR_CODES: ReadonlySet<string> = new Set<DeleteUserAccountErrorCode>([
  "BANK_PROVIDER_UNAVAILABLE",
  "ACCOUNT_PARTIALLY_ERASED",
  "FORBIDDEN",
]);

/**
 * Envelope for deleteUserAccount. The `ok: true` arm is never observed by the
 * caller in practice — the action redirects — but it keeps the hook's result
 * type honest for the belt-and-braces branch in the dialog.
 */
export type DeleteUserAccountResult =
  | { ok: true }
  | { ok: false; code: DeleteUserAccountErrorCode; message: string };

export const deleteUserAccount = defineAction<
  DeleteUserAccountInput,
  DeleteUserAccountResult,
  ActionContext
>({
  name: "deleteUserAccount",
  input: deleteUserAccountInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    try {
      // The row counts live in the apps/api log line, not on the wire.
      await settingsClient.deleteAccount(input);
    } catch (err) {
      if (err instanceof ORPCError && DELETE_USER_ACCOUNT_ERROR_CODES.has(err.code)) {
        // ACCOUNT_PARTIALLY_ERASED: every row is gone, the Supabase Auth user
        // is not. The session is deliberately KEPT — clearing it here would
        // re-render the settings route without a session (the blank page
        // above), and the user can retry: a second confirmation skips the
        // provider, deletes nothing, and tries the identity again.
        return {
          ok: false as const,
          code: err.code as DeleteUserAccountErrorCode,
          message: err.message,
        };
      }
      throw err;
    }

    // Order matters here too: only clear the session once apps/api has
    // confirmed the deletion. Clearing first would leave a user whose
    // deletion failed logged out of an account that still exists.
    //
    // signOut() can legitimately fail now that the user is gone — Supabase has
    // nothing left to revoke. The SSR client still clears the cookies through
    // its setAll handler, and the account is already deleted, so a failure
    // here must never surface as an error to the caller.
    const supabase = await createClient();
    try {
      await supabase.auth.signOut();
    } catch {
      // Intentionally swallowed — see above.
    }

    // `redirect` throws NEXT_REDIRECT, which zapaction rethrows untouched, so
    // nothing below this line runs and no value is returned to the caller.
    redirect("/");
  },
});
