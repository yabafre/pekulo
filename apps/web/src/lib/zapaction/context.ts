import "server-only";
import { setActionContext } from "@zapaction/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { seedRequestContext } from "@/lib/orpc/request-context";

// ActionContext keeps `supabase` for backward compat — brownfield actions
// that haven't been ported yet (portfolio, transactions, monthly,
// holding-lots) still call ctx.supabase.from(...). Their port stories
// (2-1, 3-1, 5-1, 5-4) drop that dependency and remove `supabase` from
// ActionContext.
export type ActionContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
};

setActionContext<ActionContext>(async () => {
  const supabase = await createClient();
  // getSession() yields the raw access_token (forwarded as Bearer to apps/api);
  // reading session.access_token is safe. IDENTITY (userId/email) comes from
  // getClaims(token) — local JWKS signature verification, no network call, no
  // "session.user is insecure" warning. NEVER read session.user here (that is
  // what auth-js flags). Passing the token avoids a second getSession() call.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  const { data: claimsData, error } = await supabase.auth.getClaims(session.access_token);
  if (error || !claimsData) {
    throw new Error("UNAUTHORIZED");
  }
  const userId = claimsData.claims.sub;
  const email = claimsData.claims.email ?? null;
  // Seed the AsyncLocalStorage so the oRPC client (called from inside ported
  // actions) reads the access token from getRequestContext() without re-auth.
  seedRequestContext({ accessToken: session.access_token, userId, email });
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId,
    email,
  };
});
