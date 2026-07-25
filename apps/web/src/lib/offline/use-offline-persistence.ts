"use client";

// Story 9-2 (FR-54, ADR-0018). Boots the encrypted persister once the identity
// is known, and reconciles three cases:
//   • server reachable + session      → persist under that userId; if the
//                                       remembered id differs, purge the old
//                                       database FIRST (AC-4, no cross-user read).
//   • server reachable + NO session   → confirmed signed out: purge everything.
//   • server unreachable (offline)    → fall back to the remembered id, which is
//                                       the whole point of FR-54. Never purge here:
//                                       a failed request is not a sign-out.
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { getOfflineIdentity } from "@/app/(cap)/_actions/offline-actions";
import { purgeCacheDb, purgeOfflineCache, readLastUserId, writeLastUserId } from "./cache-db";
import {
  OFFLINE_MAX_AGE_MS,
  createEncryptedPersister,
  isOfflineEligibleQuery,
} from "./query-persister";

/** How long we wait for the identity round-trip before deciding the server is
 * unreachable. AC-1 budgets one second for the whole offline render, so a
 * captive portal that holds the POST open must not be allowed to sit on it —
 * a hard disconnect rejects instantly, a flaky one does not. */
export const IDENTITY_TIMEOUT_MS = 1500;

/** Resolve which user's cache to open, purging as the reconciliation demands.
 * Exported for the unit test — the hook itself is a thin effect around it. */
export async function resolveOfflineUserId(): Promise<string | null> {
  const remembered = readLastUserId();

  // Offline by the browser's own account: skip the round-trip entirely rather
  // than wait for it to fail. This is the FR-54 cold-start path.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return remembered;

  let identity: { userId: string } | null = null;
  let reachable = true;
  try {
    identity = await withTimeout(getOfflineIdentity(), IDENTITY_TIMEOUT_MS);
  } catch {
    // Transport failure, timeout, or a session whose claims could not be
    // verified. None of those is a sign-out — see offline-actions.ts.
    reachable = false;
  }

  if (reachable && !identity) {
    await purgeOfflineCache();
    return null;
  }
  if (identity) {
    if (remembered && remembered !== identity.userId) await purgeCacheDb(remembered);
    writeLastUserId(identity.userId);
    return identity.userId;
  }
  return remembered;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("offline-identity: timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function useOfflinePersistence(queryClient: QueryClient): void {
  const pathname = usePathname();
  // The userId the live subscription is bound to — `undefined` while nothing
  // has been resolved yet, `null` once we know there is no session. Keyed on
  // the IDENTITY rather than on mount: `Providers` lives in the root layout and
  // both sign-in and sign-out are client-side `router.push`es, so it never
  // unmounts. A mount-only guard resolved identity exactly once per tab, which
  // left the persister bound to the FIRST user for the whole session — the
  // account-switch leak in AC-4.
  const installedUserRef = useRef<string | null | undefined>(undefined);
  const unsubscribeRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const userId = await resolveOfflineUserId();
      if (cancelled) return;
      // Same user as the live subscription — leave it alone. Re-installing
      // would restore a second time and clobber data fresher than the snapshot.
      if (installedUserRef.current === userId) return;

      const previous = installedUserRef.current;
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;

      // A DIFFERENT identity is taking over this tab. The query keys carry no
      // userId (`dashboardKeys.overview()` is ["dashboard","overview"]) and
      // nothing else in the app clears the client, so the incoming user would
      // otherwise read the previous one's figures straight from memory — and
      // the persister would write them back out under the new name.
      if (previous !== undefined && previous !== userId) queryClient.clear();

      installedUserRef.current = userId;
      if (!userId) return;

      const [unsubscribe, restored] = persistQueryClient({
        queryClient,
        persister: createEncryptedPersister(userId),
        maxAge: OFFLINE_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            isOfflineEligibleQuery(query.queryKey, query.state.status),
          // Offline, react-query pauses every mutation and its default
          // dehydrator persists paused ones — which would put transactions,
          // monthly and settings writes on disk, contradicting this module's
          // documented scope, and resume them on reconnect with no mutationFn.
          shouldDehydrateMutation: () => false,
        },
      });
      // persistQueryClientRestore re-throws after wiping; `restoreClient` is
      // catch-all but `hydrate()` runs outside it, so a malformed clientState
      // would surface as an unhandled rejection.
      void restored?.catch?.(() => undefined);
      unsubscribeRef.current = unsubscribe;
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient, pathname]);

  // Release the subscription when the provider itself goes away — and only then.
  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = undefined;
      installedUserRef.current = undefined;
    };
  }, []);
}
