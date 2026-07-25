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
import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { getOfflineIdentity } from "@/app/(cap)/_actions/offline-identity";
import { purgeCacheDb, purgeOfflineCache, readLastUserId, writeLastUserId } from "./cache-db";
import {
  OFFLINE_MAX_AGE_MS,
  createEncryptedPersister,
  isOfflineEligibleQuery,
} from "./query-persister";

/** Resolve which user's cache to open, purging as the reconciliation demands.
 * Exported for the unit test — the hook itself is a thin effect around it. */
export async function resolveOfflineUserId(): Promise<string | null> {
  const remembered = readLastUserId();
  let identity: { userId: string } | null = null;
  let reachable = true;
  try {
    identity = await getOfflineIdentity();
  } catch {
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

export function useOfflinePersistence(queryClient: QueryClient): void {
  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void (async () => {
      const userId = await resolveOfflineUserId();
      if (cancelled || !userId) return;
      const [unsub] = persistQueryClient({
        queryClient,
        persister: createEncryptedPersister(userId),
        maxAge: OFFLINE_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) =>
            isOfflineEligibleQuery(query.queryKey, query.state.status),
        },
      });
      if (cancelled) {
        unsub();
        return;
      }
      unsubscribe = unsub;
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [queryClient]);
}
