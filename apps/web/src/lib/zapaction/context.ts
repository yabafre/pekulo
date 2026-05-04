import "server-only";
import { setActionContext } from "@zapaction/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ensureRequestContext } from "@/lib/orpc/request-context";

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
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  // Seed the AsyncLocalStorage so the oRPC client (called from inside
  // ported actions like apps/web/src/lib/actions/hypotheses.ts) can read
  // the access token from getRequestContext().
  await ensureRequestContext();
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: session.user.id,
    email: session.user.email ?? null,
  };
});
