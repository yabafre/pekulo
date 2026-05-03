import "server-only";
import { setActionContext } from "@zapaction/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ActionContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
};

setActionContext<ActionContext>(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return {
    supabase: supabase as unknown as SupabaseClient,
    userId: user.id,
    email: user.email ?? null,
  };
});
