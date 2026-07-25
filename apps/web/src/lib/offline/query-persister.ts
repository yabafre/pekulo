// apps/web/src/lib/offline/query-persister.ts
// Implements @tanstack/react-query-persist-client's `Persister` on top of the
// encrypted per-user store (ADR-0018). Only the three offline-eligible feature
// trees are dehydrated; everything else (settings, transactions, monthly, llm,
// bank) stays in memory and never touches disk.
//
// `restoreClient` NEVER throws: persistQueryClientRestore re-throws whatever it
// catches after wiping the cache, which would surface as an unhandled rejection
// in the provider. A snapshot we cannot read is simply treated as absent.
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { SNAPSHOTS_STORE, openCacheDb, type EncryptedSnapshot } from "./cache-db";
import { decryptJson, encryptJson, getCacheKey, getOrCreateCacheKey } from "./cache-crypto";

export const SNAPSHOT_ID = "react-query";
/** NFR-20 — read-only cached views for at most 60 minutes. */
export const OFFLINE_MAX_AGE_MS = 60 * 60 * 1000;
/** Feature key prefixes whose screens are offline-eligible (FR-54). The prefix
 * is `queryKey[0]` for every key built by zapaction's `createFeatureKeys`
 * (e.g. `dashboardKeys.overview()` → `["dashboard", "overview"]`), so sub-keys
 * such as `realestate/byId` ride along and the immobilier detail panel keeps
 * working offline. */
export const OFFLINE_FEATURE_PREFIXES: readonly string[] = ["dashboard", "holdings", "realestate"];

/** Dehydrate filter — replaces react-query's default, which is why the
 * success check is explicit here (a pending or errored query must never be
 * persisted as if it held data). */
export function isOfflineEligibleQuery(queryKey: readonly unknown[], status: string): boolean {
  if (status !== "success") return false;
  const [prefix] = queryKey;
  return typeof prefix === "string" && OFFLINE_FEATURE_PREFIXES.includes(prefix);
}

export function createEncryptedPersister(userId: string, now: () => number = Date.now): Persister {
  return {
    async persistClient(client: PersistedClient): Promise<void> {
      try {
        const db = await openCacheDb(userId);
        const key = await getOrCreateCacheKey(db);
        const { iv, data } = await encryptJson(key, client);
        await db.put(SNAPSHOTS_STORE, { iv, data, savedAt: now() }, SNAPSHOT_ID);
      } catch {
        // Quota, private mode, or a closed connection — losing the offline
        // snapshot must never break the online app.
      }
    },

    async restoreClient(): Promise<PersistedClient | undefined> {
      try {
        const db = await openCacheDb(userId);
        const row = (await db.get(SNAPSHOTS_STORE, SNAPSHOT_ID)) as EncryptedSnapshot | undefined;
        if (!row) return undefined;
        // AC-3 — defence in depth alongside persistQueryClient's own maxAge.
        if (now() - row.savedAt > OFFLINE_MAX_AGE_MS) {
          await db.delete(SNAPSHOTS_STORE, SNAPSHOT_ID);
          return undefined;
        }
        const key = await getCacheKey(db);
        if (!key) return undefined;
        return await decryptJson<PersistedClient>(key, row.iv, row.data);
      } catch {
        return undefined;
      }
    },

    async removeClient(): Promise<void> {
      try {
        const db = await openCacheDb(userId);
        await db.delete(SNAPSHOTS_STORE, SNAPSHOT_ID);
      } catch {
        // Nothing to remove.
      }
    },
  };
}
