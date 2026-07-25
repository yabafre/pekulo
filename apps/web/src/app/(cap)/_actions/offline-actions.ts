"use server";

// Story 9-2 (FR-54, ADR-0018). The Supabase session cookie is httpOnly since
// story 11-7, so the browser client cannot read the session — and therefore
// cannot know which `pekulo-cache-<userId>` database is its own. This action
// is the only bridge: it reads the cookie server-side and hands back the id.
//
// Three answers, not two. The caller purges on a CONFIRMED sign-out and must
// never purge on a backend failure, so "no session" and "we could not tell"
// have to be distinguishable:
//   • `{ userId }` — a valid session.
//   • `null`       — no session cookie at all. Decided from the cookie alone,
//                    with no network call, so it can never be confused with an
//                    outage.
//   • throws       — a session cookie exists but its claims could not be
//                    verified (JWKS unreachable, Supabase degraded). The caller
//                    treats this like an unreachable server and KEEPS the
//                    snapshot: a failed lookup is not a sign-out.
//
// `getUser()` cannot express that third state — it answers `{ user: null }`
// both for a genuine sign-out and for a 5xx/rate-limit/network failure, which
// would let a transient Supabase hiccup wipe every visiting user's cache.
// `getSession()` + `getClaims(token)` also avoids a network round-trip on the
// identity read (local JWKS signature verification — lesson 2026-06-01), which
// matters because this now runs on every navigation.
import { createClient } from "@/lib/supabase/server";

export async function getOfflineIdentity(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  // No cookie — the one unambiguous "signed out" signal available offline-safe.
  if (!session) return null;

  const { data: claimsData, error } = await supabase.auth.getClaims(session.access_token);
  if (error || !claimsData) {
    throw new Error("offline-identity: session present but claims unverifiable");
  }
  return { userId: claimsData.claims.sub };
}
