"use server";

// apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts
// Story 11-2 (FR-50). Thin oRPC delegator — zero business logic on the web
// tier (ADR-0010). Its one web-tier responsibility is clearing the session
// AFTER the account is gone: the httpOnly auth cookies (story 11-7) survive
// the Supabase Auth user, so without this the browser would keep presenting a
// cookie for a user that no longer exists.
//
// No `tags`: there is nothing left to invalidate, and the user is about to
// leave the app.
//
// The action ENDS with a server-side redirect rather than a return value.
// Clearing the cookies makes Next re-render the current route inside the
// action response, and that route cannot render without a session (its
// sections call apps/api) — seen live, the client was left on a blank page
// and the action promise never settled. `redirect()` short-circuits that
// re-render: Next answers with a navigation to `/` instead, and the proxy
// sends the now-anonymous visitor on to /login.
import { redirect } from "next/navigation";
import { defineAction } from "@zapaction/core";
import {
  deleteUserAccountInputSchema,
  type DeleteUserAccountInput,
  type DeleteUserAccountResult,
} from "@pekulo/validators";
import { settingsClient } from "@/lib/orpc/modules";
import { ensureRequestContext } from "@/lib/orpc/request-context";
import { createClient } from "@/lib/supabase/server";
import type { ActionContext } from "@/lib/zapaction/context";
import "@/lib/zapaction/context";

export const deleteUserAccount = defineAction<
  DeleteUserAccountInput,
  DeleteUserAccountResult,
  ActionContext
>({
  name: "deleteUserAccount",
  input: deleteUserAccountInputSchema,
  handler: async ({ input }) => {
    await ensureRequestContext();
    const result = await settingsClient.deleteAccount(input);

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

    // docs/ux/flows.md § Account deletion ends on `/`, not `/login`: there is
    // no account to sign back into. `redirect` throws NEXT_REDIRECT, which
    // zapaction rethrows untouched, so `result` is never returned to the
    // caller — the row counts live in the apps/api log line, not on the wire.
    void result;
    redirect("/");
  },
});
