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
/** Mirrors `VERSION` in public/sw.js. The shell cache holds the rendered
 * /dashboard document, and the cap layout serialises the signed-in user's
 * email into that document's flight payload — so sign-out has to drop it too,
 * not just the IndexedDB snapshot. */
export const SHELL_CACHE_PREFIX = "pekulo-shell-";
export const CACHE_DB_VERSION = 1;
export const KEYS_STORE = "keys";
export const SNAPSHOTS_STORE = "snapshots";
/** Mirrors the last known userId so a cold start with no network still opens
 * the right database (a Server Action cannot answer while offline). */
export const LAST_USER_KEY = "pekulo:offline-user";

export interface EncryptedSnapshot {
  // Backing buffer pinned on purpose — see the note above `encryptJson` in
  // cache-crypto.ts: a bare `Uint8Array` is not a valid WebCrypto BufferSource.
  iv: Uint8Array<ArrayBuffer>;
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

/** `deleteDB` with the two failure modes the sign-out path cannot tolerate
 * handled: another tab holding an old connection (without a `blocked` callback
 * the request sits there forever), and a rejection (private mode, corrupt
 * store). A purge that throws would strand the user — see sign-out-button. */
async function deleteDbSafely(name: string): Promise<void> {
  try {
    await deleteDB(name, {
      blocked() {
        // Another tab still holds a connection. Ours is already closed and its
        // `blocking()` handler closes it on `versionchange`, so this resolves
        // as soon as that tab yields; the callback exists so the state is
        // observable rather than a silent stall.
      },
    });
  } catch {
    // Nothing we can do here, and nothing that justifies blocking a sign-out.
  }
}

/** Delete one user's database (AC-4 — identity change). Never throws. */
export async function purgeCacheDb(userId: string): Promise<void> {
  await closeCacheDb();
  await deleteDbSafely(cacheDbName(userId));
}

/** Delete EVERY Pekulo cache database, the Service Worker shell cache and the
 * user pointer (AC-4 — sign-out). `indexedDB.databases()` is unavailable on
 * Firefox; there we can still drop the remembered user's database, which is the
 * one that holds data. Never throws. */
export async function purgeOfflineCache(): Promise<void> {
  const remembered = readLastUserId();
  clearLastUserId();
  await closeCacheDb();

  if (typeof indexedDB !== "undefined" && typeof indexedDB.databases === "function") {
    let names: string[] = [];
    try {
      const databases = await indexedDB.databases();
      names = databases
        .map((entry) => entry.name)
        .filter(
          (name): name is string => typeof name === "string" && name.startsWith(CACHE_DB_PREFIX),
        );
    } catch {
      names = remembered ? [cacheDbName(remembered)] : [];
    }
    await Promise.all(names.map((name) => deleteDbSafely(name)));
  } else if (remembered) {
    await deleteDbSafely(cacheDbName(remembered));
  }

  await purgeShellCache();
}

/** Drop the Service Worker's cached documents. The /dashboard shell carries no
 * figures (the cap screens are client-rendered) but it does carry the signed-in
 * email, which must not outlive the session on a shared browser. */
async function purgeShellCache(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.startsWith(SHELL_CACHE_PREFIX))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Storage partitioned away or unavailable — never block a sign-out on it.
  }
}
