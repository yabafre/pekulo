// apps/web/src/lib/offline/cache-db.ts
// Per-user IndexedDB store backing the FR-54 offline cache (ADR-0018).
// Browser-only. One database per user — `pekulo-cache-<userId>` — with two
// object stores:
//   • `keys`      — the single non-extractable AES-GCM CryptoKey (AC-2).
//   • `snapshots` — the encrypted React Query snapshot + its savedAt stamp.
// Mirrors the connection discipline of `lib/llm/attest-db.ts` (story 6-6):
// one memoised connection released on `blocking` / `terminated` so a deleteDB
// never deadlocks. Unlike that store this one IS encrypted — it holds real
// balances and property names, not hashed attestations.
import { openDB, deleteDB, type DBSchema, type IDBPDatabase } from "idb";

export const CACHE_DB_PREFIX = "pekulo-cache-";
export const CACHE_DB_VERSION = 1;
export const KEYS_STORE = "keys";
export const SNAPSHOTS_STORE = "snapshots";
/** Mirrors the last known userId so a cold start with no network still opens
 * the right database (a Server Action cannot answer while offline). */
export const LAST_USER_KEY = "pekulo:offline-user";

export interface EncryptedSnapshot {
  iv: Uint8Array;
  data: ArrayBuffer;
  savedAt: number;
}

interface CacheDb extends DBSchema {
  keys: { key: string; value: CryptoKey };
  snapshots: { key: string; value: EncryptedSnapshot };
}

export function cacheDbName(userId: string): string {
  return `${CACHE_DB_PREFIX}${userId}`;
}

let dbPromise: Promise<IDBPDatabase<CacheDb>> | null = null;
let openName: string | null = null;

/** Open (and create on first use) the cache database for one user. Switching
 * users closes the previous connection first — two open connections to two
 * databases would keep the old one alive through a deleteDB. */
export function openCacheDb(userId: string): Promise<IDBPDatabase<CacheDb>> {
  const name = cacheDbName(userId);
  if (dbPromise && openName === name) return dbPromise;
  if (dbPromise) {
    const previous = dbPromise;
    dbPromise = null;
    openName = null;
    void previous.then((db) => db.close()).catch(() => undefined);
  }
  const promise = openDB<CacheDb>(name, CACHE_DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(KEYS_STORE);
      db.createObjectStore(SNAPSHOTS_STORE);
    },
    blocking() {
      void promise.then((db) => db.close()).catch(() => undefined);
      if (dbPromise === promise) {
        dbPromise = null;
        openName = null;
      }
    },
    terminated() {
      if (dbPromise === promise) {
        dbPromise = null;
        openName = null;
      }
    },
  });
  dbPromise = promise;
  openName = name;
  return promise;
}

/** Release the memoised connection. Idempotent. */
export async function closeCacheDb(): Promise<void> {
  if (!dbPromise) return;
  const pending = dbPromise;
  dbPromise = null;
  openName = null;
  try {
    (await pending).close();
  } catch {
    // Connection already gone / closing — nothing to release.
  }
}

export function readLastUserId(): string | null {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
}

export function writeLastUserId(userId: string): void {
  try {
    localStorage.setItem(LAST_USER_KEY, userId);
  } catch {
    // Private mode / quota — the cache simply won't survive a cold offline start.
  }
}

export function clearLastUserId(): void {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Delete one user's database (AC-4 — identity change). */
export async function purgeCacheDb(userId: string): Promise<void> {
  await closeCacheDb();
  await deleteDB(cacheDbName(userId));
}

/** Delete EVERY Pekulo cache database plus the user pointer (AC-4 — sign-out).
 * `indexedDB.databases()` is unavailable on Firefox; there we can still drop
 * the remembered user's database, which is the one that holds data. */
export async function purgeOfflineCache(): Promise<void> {
  const remembered = readLastUserId();
  clearLastUserId();
  await closeCacheDb();
  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    const databases = await indexedDB.databases();
    const names = databases
      .map((entry) => entry.name)
      .filter(
        (name): name is string => typeof name === "string" && name.startsWith(CACHE_DB_PREFIX),
      );
    await Promise.all(names.map((name) => deleteDB(name)));
    return;
  }
  if (remembered) await deleteDB(cacheDbName(remembered));
}
