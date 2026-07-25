"use server";

// Story 9-2 (FR-54, ADR-0018). The Supabase session cookie is httpOnly since
// story 11-7, so the browser client cannot read the session — and therefore
// cannot know which `pekulo-cache-<userId>` database is its own. This action
// is the only bridge: it reads the cookie server-side and hands back the id.
// It returns null (rather than throwing) when there is no session, which the
// caller treats as "confirmed signed out" and purges on.
import { createClient } from "@/lib/supabase/server";

export async function getOfflineIdentity(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { userId: user.id };
}
