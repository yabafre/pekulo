# Story: 9-2-pwa-offline-cache — Service Worker app shell + encrypted IndexedDB read-only cache

**Epic:** Epic 9 — PWA install + offline
**Status:** done
**Ticket:** #45
**Branch:** feature/45-9-2-pwa-offline-cache
**Complexity:** L
**Covered FRs:** FR-54 · **Binds:** NFR-8, NFR-20 · **Supersedes:** ADR-0003 (via new ADR-0018)

**Design decision — two layers, not one.** The epic/architecture text says "Service Worker, stale-while-revalidate on the three routes". **That alone cannot satisfy AC-1.** Every one of those screens reads its data through zapaction Server Actions (`useActionQuery(getDashboardOverview, …)` → `"use server"` → **POST** to the current URL, with a `Next-Action` id that changes each build, returning an RSC stream). A Service Worker cannot replay that offline: the Cache API does not cache POST requests.

So the story ships **two** independent layers:

| Layer | Owns | Delivers |
|---|---|---|
| `public/sw.js` — runtime caching | the **shell**: navigation documents + `/_next/static/*` | the app boots at all while offline |
| Encrypted IndexedDB persister for React Query | the **data** | the screens actually have content |

**No install-time precache.** Runtime caching guarantees the cached HTML and the cached chunks come from the *same* build; a hand-versioned precache list breaks on the next deploy when the HTML references chunk hashes that no longer exist.

## User Story

**As a** Pekulo user, **I want** to open dashboard, portefeuille and immobilier in read-only mode when offline (served from the last cached snapshot, at most 60 minutes old), **so that** I can check my compass even on a flaky train.

## Acceptance Criteria

- **AC-1** — **Given** I have opened the dashboard online at least once, **When** I lose connectivity and open the dashboard again, **Then** it renders my figures from the last cached snapshot in under 1 s, with no successful network request.
- **AC-2** — **Given** I inspect the browser's stored Pekulo data for my account, **When** I read it, **Then** no account label, amount, ticker or property name is legible — the stored payload is ciphertext, and the key it was encrypted under cannot be exported by any script or developer tool.
- **AC-3** — **Given** the last cached snapshot is more than 60 minutes old, **When** I open the app offline, **Then** the stale figures are discarded rather than shown (NFR-20).
- **AC-4** — **Given** I sign out, **When** the sign-out completes, **Then** no cached financial data for me remains in the browser; **and given** a different account then signs in on the same browser, **When** its first screen loads, **Then** none of the previous account's cached data is readable or displayed (NFR-8).
- **AC-5** — **Given** I am offline, **When** I attempt any action that changes data, **Then** it fails against the network rather than being answered from the cache — no write is ever silently served as if it had succeeded.
- **AC-6** — **Given** I am viewing cached figures while offline, **When** the screen renders, **Then** a banner tells me I am offline and how many minutes old the figures are, in my own language (fr + en), rendered in the app's own typeface.

**Scope guard:** this story adds no new domain data, no API change, and no push notifications. It touches `apps/api` not at all.

## Tasks

- [x] **T1 — ADR-0018 + supersede ADR-0003 + doc-sync** [AC: AC-1, AC-2, AC-4]

  Three artefacts contradict the code and must be corrected in the same commit as the decision (lesson 2026-05-31 — mid-flight additions carry their own doc-sync).

  Create `docs/adr/0018-pwa-offline-cache-revised-for-httponly-sessions.md`:
  ```markdown
  # PWA offline cache — revised for httpOnly sessions and Server-Action data

  **Date:** 2026-07-25
  **Status:** accepted
  **Supersedes:** ADR-0003
  **Decided by:** Alex

  ## Context

  ADR-0003 (2026-05-03) specified the FR-54 offline cache as: a Service Worker doing
  stale-while-revalidate on three routes, plus an IndexedDB cache encrypted with a key
  derived from the active Supabase session, purged on
  `auth.onAuthStateChange('SIGNED_OUT')`. Two things have changed in the codebase since.

  1. **Data no longer travels over cacheable GETs.** Every cap screen reads through
     zapaction Server Actions (`useActionQuery` → `"use server"` `defineAction`), which are
     POST requests to the current URL carrying a per-build `Next-Action` id and returning an
     RSC stream. The Cache API cannot cache POST, so a route-level SW strategy can restore
     the shell but never the data.
  2. **The session cookie is httpOnly** since story 11-7 (`proxy.ts`,
     `cookieOptions: { httpOnly: true }`). The browser client cannot read the session:
     `getSession()` yields no token client-side, `onAuthStateChange('SIGNED_OUT')` never
     fires (auth runs through server actions), and the client does not even know its own
     `user_id`. Both the key-derivation input and the purge trigger of ADR-0003 are gone.

  ## Decision

  **Split the concern in two layers.**

  - **Shell** — `apps/web/public/sw.js`, hand-written, no `next-pwa`, no Serwist (the Next 16
    PWA guide notes Serwist "requires webpack configuration"; this app builds with Turbopack).
    Runtime caching only, no install-time precache: navigation requests to the three
    offline-eligible routes are network-first with a cache fallback, `/_next/static/*` is
    cache-first, non-GET and cross-origin requests are passed through untouched.
  - **Data** — the React Query cache is persisted through
    `@tanstack/react-query-persist-client` into `pekulo-cache-<userId>` (IndexedDB), encrypted
    with **AES-GCM under a non-extractable `CryptoKey`** generated by
    `crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, …)` and stored in the
    same database. `maxAge` = 60 min (NFR-20). Only queries whose key prefix is
    `dashboard`, `holdings` or `realestate` are dehydrated.
  - **Identity** — a `"use server"` action reads the httpOnly cookie server-side and returns
    `{ userId }`. The last known id is mirrored into `localStorage` so a cold start with no
    network can still open the right database. A confirmed-online "no session" answer purges
    everything; an identity change purges the previous user's database.

  ## Why not derive the key from the session

  Offline-at-cold-start is the whole point of FR-54. Any key that must be fetched from the
  server before decryption makes the cache unreadable in exactly the scenario the FR
  describes (a train with no signal). A non-extractable `CryptoKey` keeps the AC-2 property
  that matters — no plaintext PII at rest, key material unreachable from JS and from DevTools —
  without a network dependency. It does not defend against JavaScript already executing in the
  origin, and no browser-side scheme does.

  ## Consequences

  - `worker-src 'self'` is added to the enforced CSP so the registration cannot break
    silently if `default-src` is ever tightened.
  - The purge trigger moves from the (never-firing) `SIGNED_OUT` client event to the
    sign-out button's success path plus a boot-time reconciliation.
  - Route paths are `/dashboard`, `/dashboard/portefeuille`, `/dashboard/immobilier` — the
    `(cap)` route group, not the top-level paths ADR-0003 assumed.
  ```

  In `docs/adr/0003-pwa-offline-cache-encrypted-indexeddb.md`, replace:
  ```markdown
  **Status:** accepted
  ```
  with:
  ```markdown
  **Status:** superseded by [ADR-0018](0018-pwa-offline-cache-revised-for-httponly-sessions.md)
  ```

  In `docs/architecture.md`, replace:
  ```markdown
    - Service Worker: Next 16 native `app/sw.ts` (no `next-pwa` dependency). Strategy = stale-while-revalidate on routes `/dashboard`, `/portefeuille`, `/immobilier`. Network-first on every mutation. Satisfies FR-53, FR-54.
    - Offline cache: **encrypted IndexedDB scoped per `user_id`**, encryption key derived from session via Web Crypto `SubtleCrypto.deriveKey`; cache cleared on `auth.onAuthStateChange('SIGNED_OUT')`. Cache TTL = 60 min (NFR-20).
  ```
  with:
  ```markdown
    - Service Worker: hand-written `apps/web/public/sw.js` (no `next-pwa`, no Serwist — Next 16's PWA guide prescribes `public/sw.js` + manual registration; there is NO native `app/sw.ts` convention). Runtime caching only: navigations to `/dashboard`, `/dashboard/portefeuille`, `/dashboard/immobilier` are network-first with cache fallback; `/_next/static/*` is cache-first; non-GET (Server-Action mutations) and cross-origin pass through. Satisfies FR-53, FR-54.
    - Offline cache: **encrypted IndexedDB scoped per `user_id`** (`pekulo-cache-<userId>`), AES-GCM under a NON-EXTRACTABLE `CryptoKey` generated client-side — the session cookie is httpOnly since story 11-7, so no session-derived key is reachable from JS. Purged on the sign-out success path and on identity change. Cache TTL = 60 min (NFR-20). Persists the React Query cache, because the screens read through Server Actions (POST) that a Service Worker cannot cache.
  ```

  In `docs/architecture.md`, replace:
  ```markdown
  │   │   │   └── sw.ts                ← Service Worker (PWA, encrypted IndexedDB)
  ```
  with:
  ```markdown
  │   │   │   └── (public/sw.js)       ← Service Worker (PWA app shell — ADR-0018)
  ```

  In `docs/architecture.md`, replace:
  ```markdown
  │   │   │   └── sw.ts                                Service Worker (FR-54, ADR-0003)
  ```
  with:
  ```markdown
  │   │   │   └── (public/sw.js)                       Service Worker app shell (FR-54, ADR-0018)
  ```

  In `docs/architecture.md`, replace:
  ```markdown
  | FR-54 | Offline read-only on dashboard/portefeuille/immobilier          | `apps/web/src/sw.ts` (encrypted IndexedDB scoped per userId, ADR-0003)                                    |
  ```
  with:
  ```markdown
  | FR-54 | Offline read-only on dashboard/portefeuille/immobilier          | `apps/web/public/sw.js` (app shell) + `apps/web/src/lib/offline/*` (encrypted IndexedDB per userId, ADR-0018) |
  ```

  In `docs/epics.md`, replace:
  ```markdown
  **Summary:** Implement `apps/web/src/sw.ts` + an encrypted IndexedDB cache scoped per userId per ADR-0003. Honour the 60-minute staleness ceiling (NFR-20). Likely splits in `aped-story`.
  ```
  with:
  ```markdown
  **Summary:** Implement `apps/web/public/sw.js` (app-shell runtime caching) + an encrypted IndexedDB persister for the React Query cache, scoped per userId, per ADR-0018 (which supersedes ADR-0003 — the session is httpOnly and the screens read through Server Actions). Honour the 60-minute staleness ceiling (NFR-20). Kept as one story by user decision 2026-07-25.
  ```

  Run: `cd /Users/fredyaba/Documents/Saas-projects/pekulo && grep -c "ADR-0018" docs/architecture.md docs/epics.md docs/adr/0003-pwa-offline-cache-encrypted-indexeddb.md docs/adr/0018-pwa-offline-cache-revised-for-httponly-sessions.md`
  Expected: four lines ending in `:3`, `:1`, `:1`, `:1` respectively (architecture cites it three times), exit 0.
  Commit: `git add docs/adr/0018-pwa-offline-cache-revised-for-httponly-sessions.md docs/adr/0003-pwa-offline-cache-encrypted-indexeddb.md docs/architecture.md docs/epics.md && git commit -m "docs(#45): ADR-0018 supersedes ADR-0003 — offline cache revised for httpOnly + Server Actions"`

- [x] **T2 — Add the persistence dependency** [AC: AC-1, AC-3]

  ```bash
  cd apps/web && bun add @tanstack/react-query-persist-client@5.101.4
  ```
  Run: `cd apps/web && bun -e "const p=require('./package.json'); console.log(p.dependencies['@tanstack/react-query-persist-client'])"`
  Expected: prints `5.101.4`, exit 0.
  Commit: `git add apps/web/package.json bun.lock && git commit -m "chore(#45): add @tanstack/react-query-persist-client"`

- [x] **T3 — Encrypted cache database + user pointer** [AC: AC-2, AC-4]

  Create `apps/web/src/lib/offline/cache-db.ts`:
  ```ts
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
        .filter((name): name is string => typeof name === "string" && name.startsWith(CACHE_DB_PREFIX));
      await Promise.all(names.map((name) => deleteDB(name)));
      return;
    }
    if (remembered) await deleteDB(cacheDbName(remembered));
  }
  ```
  Create `apps/web/src/lib/offline/cache-db.test.ts`:
  ```ts
  // AC-4 — "Given I sign out, When the sign-out action resolves, Then every
  // pekulo-cache-* database and the remembered-user pointer are deleted."
  import "fake-indexeddb/auto";
  import { beforeEach, describe, expect, test } from "vitest";
  import {
    CACHE_DB_PREFIX,
    LAST_USER_KEY,
    SNAPSHOTS_STORE,
    cacheDbName,
    clearLastUserId,
    closeCacheDb,
    openCacheDb,
    purgeCacheDb,
    purgeOfflineCache,
    readLastUserId,
    writeLastUserId,
  } from "./cache-db";

  async function dbNames(): Promise<string[]> {
    const entries = await indexedDB.databases();
    return entries
      .map((entry) => entry.name)
      .filter((name): name is string => typeof name === "string");
  }

  beforeEach(async () => {
    await closeCacheDb();
    clearLastUserId();
    for (const name of await dbNames()) {
      if (name.startsWith(CACHE_DB_PREFIX)) {
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        });
      }
    }
  });

  describe("cache-db (story 9-2)", () => {
    test("names the database per user", () => {
      expect(cacheDbName("user_alex")).toBe("pekulo-cache-user_alex");
    });

    test("creates both object stores on first open", async () => {
      const db = await openCacheDb("user_alex");
      expect(Array.from(db.objectStoreNames).sort()).toEqual(["keys", "snapshots"]);
    });

    test("memoises one connection per user and swaps it on identity change", async () => {
      const first = await openCacheDb("user_alex");
      const same = await openCacheDb("user_alex");
      expect(same).toBe(first);
      const other = await openCacheDb("user_bob");
      expect(other).not.toBe(first);
      expect(other.name).toBe("pekulo-cache-user_bob");
    });

    test("purgeCacheDb removes only the named user's database", async () => {
      await openCacheDb("user_alex");
      await closeCacheDb();
      await openCacheDb("user_bob");
      await closeCacheDb();
      await purgeCacheDb("user_alex");
      const names = await dbNames();
      expect(names).not.toContain("pekulo-cache-user_alex");
      expect(names).toContain("pekulo-cache-user_bob");
    });

    test("AC-4 — purgeOfflineCache drops every pekulo cache database and the pointer", async () => {
      writeLastUserId("user_alex");
      const alex = await openCacheDb("user_alex");
      await alex.put(SNAPSHOTS_STORE, { iv: new Uint8Array([1]), data: new ArrayBuffer(1), savedAt: 1 }, "react-query");
      await closeCacheDb();
      await openCacheDb("user_bob");
      await closeCacheDb();

      await purgeOfflineCache();

      const names = await dbNames();
      expect(names.filter((name) => name.startsWith(CACHE_DB_PREFIX))).toEqual([]);
      expect(readLastUserId()).toBeNull();
      expect(localStorage.getItem(LAST_USER_KEY)).toBeNull();
    });

    test("the user pointer round-trips and survives a missing localStorage", () => {
      writeLastUserId("user_alex");
      expect(readLastUserId()).toBe("user_alex");
      clearLastUserId();
      expect(readLastUserId()).toBeNull();
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/offline/cache-db.test.ts`
  Expected: `Test Files  1 passed`, `Tests  6 passed`, exit 0.
  Commit: `git add apps/web/src/lib/offline/cache-db.ts apps/web/src/lib/offline/cache-db.test.ts && git commit -m "feat(#45): per-user encrypted-cache IndexedDB store + purge (AC-4)"`

- [x] **T4 — AES-GCM helpers under a non-extractable key** [AC: AC-2]

  Create `apps/web/src/lib/offline/cache-crypto.ts`:
  ```ts
  // apps/web/src/lib/offline/cache-crypto.ts
  // AES-GCM envelope for the offline cache (ADR-0018, AC-2). The key is generated
  // with `extractable: false`, so its raw material can never be read back by JS
  // (`crypto.subtle.exportKey` rejects) nor by DevTools — while remaining usable
  // for encrypt/decrypt and structured-cloneable into IndexedDB. It is NOT derived
  // from the Supabase session: that cookie is httpOnly since story 11-7, and a
  // server round-trip to obtain a key would make the cache unreadable in exactly
  // the offline cold-start FR-54 is about.
  import type { IDBPDatabase } from "idb";

  export const CACHE_KEY_ID = "cache-key";
  export const CACHE_ALGORITHM = "AES-GCM";
  /** 96 bits — the IV length AES-GCM is specified for. */
  export const IV_BYTES = 12;

  type KeyStoreDb = Pick<IDBPDatabase<never>, never> & {
    get: (store: "keys", key: string) => Promise<unknown>;
    put: (store: "keys", value: CryptoKey, key: string) => Promise<unknown>;
  };

  /** Read the stored key, or undefined when this database has none yet. Used on
   * the restore path: minting a fresh key there would silently make an existing
   * snapshot undecryptable instead of surfacing it. */
  export async function getCacheKey(db: KeyStoreDb): Promise<CryptoKey | undefined> {
    const stored = await db.get("keys", CACHE_KEY_ID);
    return (stored as CryptoKey | undefined) ?? undefined;
  }

  /** Read the stored key, generating and persisting one on first use. */
  export async function getOrCreateCacheKey(db: KeyStoreDb): Promise<CryptoKey> {
    const existing = await getCacheKey(db);
    if (existing) return existing;
    const key = await crypto.subtle.generateKey({ name: CACHE_ALGORITHM, length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]);
    await db.put("keys", key, CACHE_KEY_ID);
    return key;
  }

  export async function encryptJson(
    key: CryptoKey,
    value: unknown,
  ): Promise<{ iv: Uint8Array; data: ArrayBuffer }> {
    const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const data = await crypto.subtle.encrypt({ name: CACHE_ALGORITHM, iv }, key, plaintext);
    return { iv, data };
  }

  export async function decryptJson<T>(
    key: CryptoKey,
    iv: Uint8Array,
    data: ArrayBuffer,
  ): Promise<T> {
    const plaintext = await crypto.subtle.decrypt({ name: CACHE_ALGORITHM, iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }
  ```
  Create `apps/web/src/lib/offline/cache-crypto.test.ts`:
  ```ts
  // AC-2 — "the payload is encrypted … no plaintext PII at rest in the browser"
  // and "the stored CryptoKey reports extractable === false".
  import "fake-indexeddb/auto";
  import { beforeEach, describe, expect, test } from "vitest";
  import { KEYS_STORE, closeCacheDb, openCacheDb, purgeOfflineCache } from "./cache-db";
  import {
    CACHE_KEY_ID,
    decryptJson,
    encryptJson,
    getCacheKey,
    getOrCreateCacheKey,
  } from "./cache-crypto";

  const SECRET = { account: "Livret A", balance: 18450.32, property: "Studio Lyon 7" };

  beforeEach(async () => {
    await purgeOfflineCache();
  });

  describe("cache-crypto (story 9-2)", () => {
    test("AC-2 — the generated key is non-extractable", async () => {
      const db = await openCacheDb("user_alex");
      const key = await getOrCreateCacheKey(db);
      expect(key.extractable).toBe(false);
      expect(key.algorithm.name).toBe("AES-GCM");
      await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
    });

    test("the same key is reused across calls and survives a reopen", async () => {
      const db = await openCacheDb("user_alex");
      const first = await getOrCreateCacheKey(db);
      const second = await getOrCreateCacheKey(db);
      expect(second.extractable).toBe(false);
      await closeCacheDb();
      const reopened = await openCacheDb("user_alex");
      const stored = await getCacheKey(reopened);
      expect(stored).toBeDefined();
      // Proof it still decrypts what the first handle encrypted.
      const { iv, data } = await encryptJson(first, SECRET);
      await expect(decryptJson(stored as CryptoKey, iv, data)).resolves.toEqual(SECRET);
    });

    test("getCacheKey returns undefined before any key is minted", async () => {
      const db = await openCacheDb("user_fresh");
      expect(await getCacheKey(db)).toBeUndefined();
    });

    test("AC-2 — the ciphertext holds no plaintext PII", async () => {
      const db = await openCacheDb("user_alex");
      const key = await getOrCreateCacheKey(db);
      const { iv, data } = await encryptJson(key, SECRET);
      expect(iv).toHaveLength(12);
      const asText = new TextDecoder().decode(data);
      expect(asText).not.toContain("Livret A");
      expect(asText).not.toContain("18450");
      expect(asText).not.toContain("Studio Lyon 7");
      await expect(decryptJson(key, iv, data)).resolves.toEqual(SECRET);
    });

    test("a wrong key cannot decrypt the payload", async () => {
      const db = await openCacheDb("user_alex");
      const key = await getOrCreateCacheKey(db);
      const { iv, data } = await encryptJson(key, SECRET);
      const other = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]);
      await expect(decryptJson(other, iv, data)).rejects.toThrow();
    });

    test("the key is stored under the documented id", async () => {
      const db = await openCacheDb("user_alex");
      await getOrCreateCacheKey(db);
      expect(await db.get(KEYS_STORE, CACHE_KEY_ID)).toBeDefined();
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/offline/cache-crypto.test.ts`
  Expected: `Test Files  1 passed`, `Tests  6 passed`, exit 0.
  Commit: `git add apps/web/src/lib/offline/cache-crypto.ts apps/web/src/lib/offline/cache-crypto.test.ts && git commit -m "feat(#45): AES-GCM envelope under a non-extractable CryptoKey (AC-2)"`

- [x] **T5 — Encrypted React Query persister + 60-minute ceiling** [AC: AC-1, AC-3]

  Create `apps/web/src/lib/offline/query-persister.ts`:
  ```ts
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
  import {
    SNAPSHOTS_STORE,
    openCacheDb,
    type EncryptedSnapshot,
  } from "./cache-db";
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
  ```
  Create `apps/web/src/lib/offline/query-persister.test.ts`:
  ```ts
  // AC-1 (snapshot round-trips), AC-3 (60-minute ceiling), plus the dehydrate filter.
  import "fake-indexeddb/auto";
  import { beforeEach, describe, expect, test } from "vitest";
  import type { PersistedClient } from "@tanstack/react-query-persist-client";
  import { SNAPSHOTS_STORE, openCacheDb, purgeOfflineCache } from "./cache-db";
  import {
    OFFLINE_MAX_AGE_MS,
    SNAPSHOT_ID,
    createEncryptedPersister,
    isOfflineEligibleQuery,
  } from "./query-persister";

  const USER = "user_alex";

  function snapshot(at: number): PersistedClient {
    return {
      timestamp: at,
      buster: "",
      clientState: {
        mutations: [],
        queries: [
          {
            queryKey: ["dashboard", "overview"],
            queryHash: '["dashboard","overview"]',
            state: {
              data: { netWorth: 128_400.5, accounts: ["Livret A"] },
              dataUpdatedAt: at,
              error: null,
              errorUpdatedAt: 0,
              fetchFailureCount: 0,
              fetchFailureReason: null,
              fetchMeta: null,
              isInvalidated: false,
              status: "success",
              fetchStatus: "idle",
            },
          },
        ],
      },
    } as unknown as PersistedClient;
  }

  function clock(start: number) {
    let t = start;
    return { now: () => t, advance: (ms: number) => { t += ms; } };
  }

  beforeEach(async () => {
    await purgeOfflineCache();
  });

  describe("query-persister (story 9-2)", () => {
    test("AC-1 — a persisted snapshot restores identically", async () => {
      const c = clock(1_000_000);
      const persister = createEncryptedPersister(USER, c.now);
      await persister.persistClient(snapshot(1_000_000));
      const restored = await persister.restoreClient();
      expect(restored).toBeDefined();
      expect(restored?.clientState.queries[0]?.queryKey).toEqual(["dashboard", "overview"]);
      expect((restored?.clientState.queries[0]?.state.data as { netWorth: number }).netWorth).toBe(
        128_400.5,
      );
    });

    test("AC-2 — what lands on disk is ciphertext, not the payload", async () => {
      const c = clock(1_000_000);
      await createEncryptedPersister(USER, c.now).persistClient(snapshot(1_000_000));
      const db = await openCacheDb(USER);
      const row = await db.get(SNAPSHOTS_STORE, SNAPSHOT_ID);
      expect(row).toBeDefined();
      const asText = new TextDecoder().decode(row!.data);
      expect(asText).not.toContain("Livret A");
      expect(asText).not.toContain("128400");
      expect(asText).not.toContain("dashboard");
    });

    test("AC-3 — a snapshot older than 60 minutes is rejected and deleted", async () => {
      const c = clock(1_000_000);
      const persister = createEncryptedPersister(USER, c.now);
      await persister.persistClient(snapshot(1_000_000));
      c.advance(OFFLINE_MAX_AGE_MS + 1);
      expect(await persister.restoreClient()).toBeUndefined();
      const db = await openCacheDb(USER);
      expect(await db.get(SNAPSHOTS_STORE, SNAPSHOT_ID)).toBeUndefined();
    });

    test("AC-3 — a snapshot exactly at the ceiling is still served", async () => {
      const c = clock(1_000_000);
      const persister = createEncryptedPersister(USER, c.now);
      await persister.persistClient(snapshot(1_000_000));
      c.advance(OFFLINE_MAX_AGE_MS);
      expect(await persister.restoreClient()).toBeDefined();
    });

    test("restoreClient returns undefined (never throws) when nothing is stored", async () => {
      const persister = createEncryptedPersister("user_empty");
      await expect(persister.restoreClient()).resolves.toBeUndefined();
    });

    test("removeClient drops the snapshot", async () => {
      const persister = createEncryptedPersister(USER);
      await persister.persistClient(snapshot(Date.now()));
      await persister.removeClient();
      await expect(persister.restoreClient()).resolves.toBeUndefined();
    });

    test("another user's persister cannot read the snapshot", async () => {
      await createEncryptedPersister(USER).persistClient(snapshot(Date.now()));
      await expect(createEncryptedPersister("user_bob").restoreClient()).resolves.toBeUndefined();
    });

    test("the dehydrate filter keeps only successful offline-eligible queries", () => {
      expect(isOfflineEligibleQuery(["dashboard", "overview"], "success")).toBe(true);
      expect(isOfflineEligibleQuery(["holdings", "list"], "success")).toBe(true);
      expect(isOfflineEligibleQuery(["realestate", "byId", "prop_1"], "success")).toBe(true);
      expect(isOfflineEligibleQuery(["dashboard", "overview"], "pending")).toBe(false);
      expect(isOfflineEligibleQuery(["dashboard", "overview"], "error")).toBe(false);
      expect(isOfflineEligibleQuery(["transactions", "list"], "success")).toBe(false);
      expect(isOfflineEligibleQuery(["settings", "preferences"], "success")).toBe(false);
      expect(isOfflineEligibleQuery([], "success")).toBe(false);
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/offline/query-persister.test.ts`
  Expected: `Test Files  1 passed`, `Tests  8 passed`, exit 0.
  Commit: `git add apps/web/src/lib/offline/query-persister.ts apps/web/src/lib/offline/query-persister.test.ts && git commit -m "feat(#45): encrypted React Query persister with 60-min ceiling (AC-1, AC-3)"`

- [x] **T6 — Server-side offline identity** [AC: AC-1, AC-4]

  The browser cannot read the httpOnly session cookie, so the userId that names the
  database must come from the server. Create `apps/web/src/app/(cap)/_actions/offline-identity.ts`:
  ```ts
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
  ```
  Run: `cd apps/web && bun run typecheck`
  Expected: `tsc --noEmit` exits 0 with no output.
  Commit: `git add "apps/web/src/app/(cap)/_actions/offline-identity.ts" && git commit -m "feat(#45): server action exposing the offline cache identity"`

- [x] **T7 — Persistence wiring hook (identity reconciliation + purge)** [AC: AC-1, AC-3, AC-4]

  Create `apps/web/src/lib/offline/use-offline-persistence.ts`:
  ```ts
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
  ```
  Create `apps/web/src/lib/offline/use-offline-persistence.test.ts`:
  ```ts
  // AC-4 — identity reconciliation: purge on sign-out, purge the previous user on
  // identity change, and NEVER purge merely because the server was unreachable.
  import "fake-indexeddb/auto";
  import { beforeEach, describe, expect, test, vi } from "vitest";

  // vi.mock factories are hoisted — the mock fn must come from vi.hoisted
  // (lesson 2026-05-20), otherwise the reference is not yet initialised.
  const { getOfflineIdentity } = vi.hoisted(() => ({ getOfflineIdentity: vi.fn() }));
  vi.mock("@/app/(cap)/_actions/offline-identity", () => ({ getOfflineIdentity }));

  import { SNAPSHOTS_STORE, closeCacheDb, openCacheDb, purgeOfflineCache, readLastUserId, writeLastUserId } from "./cache-db";
  import { resolveOfflineUserId } from "./use-offline-persistence";

  async function seed(userId: string): Promise<void> {
    const db = await openCacheDb(userId);
    await db.put(SNAPSHOTS_STORE, { iv: new Uint8Array([1]), data: new ArrayBuffer(2), savedAt: 1 }, "react-query");
    await closeCacheDb();
  }

  async function hasSnapshot(userId: string): Promise<boolean> {
    const db = await openCacheDb(userId);
    const row = await db.get(SNAPSHOTS_STORE, "react-query");
    await closeCacheDb();
    return row !== undefined;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    await purgeOfflineCache();
  });

  describe("resolveOfflineUserId (story 9-2)", () => {
    test("returns the server identity and remembers it", async () => {
      getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
      expect(await resolveOfflineUserId()).toBe("user_alex");
      expect(readLastUserId()).toBe("user_alex");
    });

    test("AC-4 — a confirmed signed-out answer purges everything", async () => {
      writeLastUserId("user_alex");
      await seed("user_alex");
      getOfflineIdentity.mockResolvedValue(null);

      expect(await resolveOfflineUserId()).toBeNull();
      expect(readLastUserId()).toBeNull();
      expect(await hasSnapshot("user_alex")).toBe(false);
    });

    test("AC-4 — an identity change purges the previous user's database first", async () => {
      writeLastUserId("user_alex");
      await seed("user_alex");
      getOfflineIdentity.mockResolvedValue({ userId: "user_bob" });

      expect(await resolveOfflineUserId()).toBe("user_bob");
      expect(readLastUserId()).toBe("user_bob");
      expect(await hasSnapshot("user_alex")).toBe(false);
    });

    test("AC-1 — an unreachable server falls back to the remembered user", async () => {
      writeLastUserId("user_alex");
      await seed("user_alex");
      getOfflineIdentity.mockRejectedValue(new Error("Failed to fetch"));

      expect(await resolveOfflineUserId()).toBe("user_alex");
      // A failed request is NOT a sign-out — the snapshot must survive.
      expect(await hasSnapshot("user_alex")).toBe(true);
      expect(readLastUserId()).toBe("user_alex");
    });

    test("returns null when offline with nothing remembered", async () => {
      getOfflineIdentity.mockRejectedValue(new Error("Failed to fetch"));
      expect(await resolveOfflineUserId()).toBeNull();
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/offline/use-offline-persistence.test.ts`
  Expected: `Test Files  1 passed`, `Tests  5 passed`, exit 0.
  Commit: `git add apps/web/src/lib/offline/use-offline-persistence.ts apps/web/src/lib/offline/use-offline-persistence.test.ts && git commit -m "feat(#45): offline identity reconciliation + persister boot (AC-4)"`

- [x] **T8 — Mount the persister and the banner in Providers** [AC: AC-1, AC-6]

  ⚠️ **Do this task AFTER T14 and T15.** It imports `OfflineBanner`, which T15 creates and
  T14's copy feeds; running it earlier fails typecheck on a module that does not exist yet.

  Edit `apps/web/src/components/providers.tsx`. **(a)** replace:
  ```tsx
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState, type ErrorInfo, type ReactNode } from "react";
  import { PekuloErrorBoundary, PekuloRootProvider } from "@pekulo/ui";
  import "@/lib/zapaction/keys";
  ```
  with:
  ```tsx
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState, type ErrorInfo, type ReactNode } from "react";
  import { PekuloErrorBoundary, PekuloRootProvider } from "@pekulo/ui";
  import { useOfflinePersistence } from "@/lib/offline/use-offline-persistence";
  import { OfflineBanner } from "@/components/offline-banner";
  import "@/lib/zapaction/keys";
  ```
  **(b)** replace:
  ```tsx
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
        }),
    );
    return (
      <PekuloRootProvider>
        <PekuloErrorBoundary onError={reportClientError} fullScreen>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </PekuloErrorBoundary>
      </PekuloRootProvider>
    );
  ```
  with:
  ```tsx
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
        }),
    );
    // Story 9-2 (FR-54) — restores the encrypted snapshot into this client and
    // keeps persisting it. Imperative rather than <PersistQueryClientProvider>:
    // the userId arrives asynchronously from a Server Action, and gating the whole
    // tree on that round-trip would delay first paint for every online visit.
    useOfflinePersistence(queryClient);
    return (
      <PekuloRootProvider>
        <PekuloErrorBoundary onError={reportClientError} fullScreen>
          <QueryClientProvider client={queryClient}>
            {children}
            {/* Inside the provider — the banner reads the snapshot age from the
                query cache. */}
            <OfflineBanner />
          </QueryClientProvider>
        </PekuloErrorBoundary>
      </PekuloRootProvider>
    );
  ```
  Run: `cd apps/web && bun run typecheck`
  Expected: `tsc --noEmit` exits 0 with no output.
  Commit: `git add apps/web/src/components/providers.tsx && git commit -m "feat(#45): wire the offline persister + banner into Providers (AC-1, AC-6)"`

- [x] **T9 — Purge the cache on sign-out** [AC: AC-4]

  Edit `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx`. **(a)** replace:
  ```tsx
  import { signOut } from "@/app/(auth)/_actions/auth-actions";
  ```
  with:
  ```tsx
  import { signOut } from "@/app/(auth)/_actions/auth-actions";
  import { purgeOfflineCache } from "@/lib/offline/cache-db";
  ```
  **(b)** replace:
  ```tsx
        const result = await signOut();
        if (!result.ok) {
          toast.danger(t("title"), result.message);
          return;
        }
        router.push("/login");
        router.refresh();
  ```
  with:
  ```tsx
        const result = await signOut();
        if (!result.ok) {
          toast.danger(t("title"), result.message);
          return;
        }
        // AC-4 — the session is gone; the decrypted-at-rest snapshot must go with
        // it before we leave the page. `onAuthStateChange('SIGNED_OUT')` (ADR-0003)
        // never fires here: auth runs server-side under httpOnly cookies.
        await purgeOfflineCache();
        router.push("/login");
        router.refresh();
  ```
  Create `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.test.tsx`:
  ```tsx
  // AC-4 — "Given I sign out, When the sign-out action resolves, Then every
  // pekulo-cache-* database and the remembered-user pointer are deleted."
  import "fake-indexeddb/auto";
  import { beforeEach, describe, expect, test, vi } from "vitest";
  import { screen, waitFor } from "@testing-library/react";
  import { userEvent } from "@testing-library/user-event";
  import { renderWithTamagui } from "../../../../../../test/setup";

  const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
  vi.mock("@/app/(auth)/_actions/auth-actions", () => ({ signOut }));
  const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

  import { SNAPSHOTS_STORE, closeCacheDb, openCacheDb, readLastUserId, writeLastUserId } from "@/lib/offline/cache-db";
  import { SignOutButton } from "./sign-out-button";

  beforeEach(async () => {
    vi.clearAllMocks();
    writeLastUserId("user_alex");
    const db = await openCacheDb("user_alex");
    await db.put(SNAPSHOTS_STORE, { iv: new Uint8Array([1]), data: new ArrayBuffer(2), savedAt: 1 }, "react-query");
    await closeCacheDb();
  });

  describe("SignOutButton (story 9-2)", () => {
    test("AC-4 — a successful sign-out purges the offline cache", async () => {
      signOut.mockResolvedValue({ ok: true });
      renderWithTamagui(<SignOutButton />);
      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(push).toHaveBeenCalledWith("/login");
      });
      expect(readLastUserId()).toBeNull();
      const names = (await indexedDB.databases()).map((entry) => entry.name);
      expect(names).not.toContain("pekulo-cache-user_alex");
    });

    test("AC-4 — a FAILED sign-out keeps the cache (the session is still valid)", async () => {
      signOut.mockResolvedValue({ ok: false, message: "nope" });
      renderWithTamagui(<SignOutButton />);
      await userEvent.click(screen.getByRole("button"));

      await waitFor(() => {
        expect(signOut).toHaveBeenCalled();
      });
      expect(push).not.toHaveBeenCalled();
      expect(readLastUserId()).toBe("user_alex");
    });
  });
  ```
  `@testing-library/user-event` is NOT yet a devDependency (verified at story-writing time) —
  add it before running the test:
  ```bash
  cd apps/web && bun add -d @testing-library/user-event
  ```
  Run: `cd apps/web && bun run test src/app/\(cap\)/dashboard/_account/_components/sign-out-button.test.tsx`
  Expected: `Test Files  1 passed`, `Tests  2 passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx" "apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.test.tsx" apps/web/package.json bun.lock && git commit -m "feat(#45): purge the encrypted offline cache on sign-out (AC-4)"`

- [x] **T10 — Service Worker + its no-cache header** [AC: AC-1, AC-5]

  Create `apps/web/public/sw.js`:
  ```js
  // apps/web/public/sw.js
  // Pekulo PWA app shell (FR-54, ADR-0018). Hand-written on purpose: Next 16 has
  // NO native `app/sw.ts` convention (its PWA guide prescribes public/sw.js +
  // manual registration), and Serwist needs a webpack config this Turbopack app
  // does not have.
  //
  // Runtime caching only — nothing is precached at install. That keeps the cached
  // document and the cached /_next/static chunks from the SAME build: a
  // hand-versioned precache list would serve an HTML file pointing at chunk
  // hashes that no longer exist after the next deploy.
  //
  // This worker caches the SHELL, never the DATA: the cap screens read through
  // Server Actions (POST) that the Cache API cannot store. Data lives encrypted
  // in IndexedDB via src/lib/offline/*.
  const VERSION = "pekulo-shell-v1";
  const SHELL_CACHE = VERSION;
  const OFFLINE_ROUTES = ["/dashboard", "/dashboard/portefeuille", "/dashboard/immobilier"];

  self.addEventListener("install", () => {
    // Take over as soon as the new worker is ready — an old shell serving a new
    // build's HTML is exactly the mismatch we are avoiding.
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => name !== VERSION).map((name) => caches.delete(name)));
        await self.clients.claim();
      })(),
    );
  });

  function isOfflineRoute(url) {
    return OFFLINE_ROUTES.indexOf(url.pathname) !== -1;
  }

  async function networkFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    try {
      const response = await fetch(request);
      if (response && response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw error;
    }
  }

  async function cacheFirst(request) {
    const cache = await caches.open(SHELL_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok) await cache.put(request, response.clone());
    return response;
  }

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    // AC-5 — every mutation (Server Actions are POST) goes straight to the
    // network. Returning without respondWith hands the request back to the browser.
    if (request.method !== "GET") return;
    const url = new URL(request.url);
    // Cross-origin (Supabase auth, logo upstreams) is never intercepted.
    if (url.origin !== self.location.origin) return;
    // Build assets are content-hashed and immutable.
    if (url.pathname.indexOf("/_next/static/") === 0) {
      event.respondWith(cacheFirst(request));
      return;
    }
    if (request.mode === "navigate" && isOfflineRoute(url)) {
      event.respondWith(networkFirst(request));
    }
  });
  ```
  Edit `apps/web/next.config.ts` — replace:
  ```ts
    turbopack: {
      resolveAlias: {
        "react-native": "react-native-web",
      },
  ```
  with:
  ```ts
    // Story 9-2 — the Service Worker script must never be served from the HTTP
    // cache, or a stale worker outlives its build (Next 16 PWA guide, § Securing
    // your application).
    async headers() {
      return [
        {
          source: "/sw.js",
          headers: [
            { key: "Content-Type", value: "application/javascript; charset=utf-8" },
            { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          ],
        },
      ];
    },
    turbopack: {
      resolveAlias: {
        "react-native": "react-native-web",
      },
  ```
  Run: `cd apps/web && node --check public/sw.js && echo "sw.js parses"`
  Expected: prints `sw.js parses`, exit 0.
  Commit: `git add apps/web/public/sw.js apps/web/next.config.ts && git commit -m "feat(#45): app-shell service worker + no-cache header (AC-1, AC-5)"`

- [x] **T11 — Service Worker behaviour tests** [AC: AC-1, AC-5]

  The worker is a standalone script with no exports, so the test loads the real
  file and evaluates it against a fake `self`. `new Function` is fed a repo file
  (never user input) inside a test — this is the only way to exercise a worker
  script's handlers under Vitest.

  Create `apps/web/src/lib/offline/sw.test.ts`:
  ```ts
  // AC-1 (navigation falls back to cache offline) and AC-5 (mutations are never
  // served from cache). Loads apps/web/public/sw.js verbatim and drives its
  // listeners against a fake ServiceWorkerGlobalScope.
  import { readFileSync } from "node:fs";
  import { resolve } from "node:path";
  import { beforeEach, describe, expect, test, vi } from "vitest";

  const ORIGIN = "https://pekulo.test";

  interface FetchEvent {
    request: { method: string; url: string; mode?: string };
    respondWith: (response: Promise<unknown>) => void;
  }

  function loadWorker() {
    const store = new Map<string, string>();
    const cache = {
      match: vi.fn(async (request: { url: string }) => store.get(request.url)),
      put: vi.fn(async (request: { url: string }, response: { body: string }) => {
        store.set(request.url, response.body);
      }),
    };
    const caches = {
      open: vi.fn(async () => cache),
      keys: vi.fn(async () => ["pekulo-shell-v1", "pekulo-shell-v0"]),
      delete: vi.fn(async () => true),
    };
    const listeners = new Map<string, (event: unknown) => void>();
    const self = {
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        listeners.set(type, handler);
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => undefined) },
      location: { origin: ORIGIN },
    };
    const fetchMock = vi.fn();

    const source = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    // eslint-disable-next-line no-new-func
    new Function("self", "caches", "fetch", source)(self, caches, fetchMock);

    return { listeners, self, caches, cache, fetchMock, store };
  }

  function navigate(url: string): FetchEvent & { responded: () => Promise<unknown> | undefined } {
    let captured: Promise<unknown> | undefined;
    return {
      request: { method: "GET", url, mode: "navigate" },
      respondWith: (response: Promise<unknown>) => {
        captured = response;
      },
      responded: () => captured,
    };
  }

  let worker: ReturnType<typeof loadWorker>;

  beforeEach(() => {
    worker = loadWorker();
  });

  describe("public/sw.js (story 9-2)", () => {
    test("registers install, activate and fetch listeners", () => {
      expect(worker.listeners.has("install")).toBe(true);
      expect(worker.listeners.has("activate")).toBe(true);
      expect(worker.listeners.has("fetch")).toBe(true);
    });

    test("install takes over immediately", () => {
      worker.listeners.get("install")!({});
      expect(worker.self.skipWaiting).toHaveBeenCalledTimes(1);
    });

    test("activate deletes caches from other versions and claims clients", async () => {
      let waited: Promise<unknown> | undefined;
      worker.listeners.get("activate")!({ waitUntil: (p: Promise<unknown>) => { waited = p; } });
      await waited;
      expect(worker.caches.delete).toHaveBeenCalledWith("pekulo-shell-v0");
      expect(worker.caches.delete).not.toHaveBeenCalledWith("pekulo-shell-v1");
      expect(worker.self.clients.claim).toHaveBeenCalled();
    });

    test("AC-5 — a POST is never intercepted", () => {
      let responded = false;
      worker.listeners.get("fetch")!({
        request: { method: "POST", url: `${ORIGIN}/dashboard`, mode: "navigate" },
        respondWith: () => { responded = true; },
      });
      expect(responded).toBe(false);
    });

    test("cross-origin GETs are never intercepted", () => {
      let responded = false;
      worker.listeners.get("fetch")!({
        request: { method: "GET", url: "https://supabase.co/auth/v1/user", mode: "cors" },
        respondWith: () => { responded = true; },
      });
      expect(responded).toBe(false);
    });

    test("a non-offline route is not intercepted", () => {
      const event = navigate(`${ORIGIN}/dashboard/transactions`);
      worker.listeners.get("fetch")!(event);
      expect(event.responded()).toBeUndefined();
    });

    test("AC-1 — an offline route is served from the network and cached", async () => {
      worker.fetchMock.mockResolvedValue({ ok: true, body: "SHELL", clone: () => ({ body: "SHELL" }) });
      const event = navigate(`${ORIGIN}/dashboard`);
      worker.listeners.get("fetch")!(event);
      await event.responded();
      expect(worker.cache.put).toHaveBeenCalled();
      expect(worker.store.get(`${ORIGIN}/dashboard`)).toBe("SHELL");
    });

    test("AC-1 — when the network fails the cached shell is returned", async () => {
      worker.fetchMock.mockResolvedValueOnce({ ok: true, body: "SHELL", clone: () => ({ body: "SHELL" }) });
      const online = navigate(`${ORIGIN}/dashboard/portefeuille`);
      worker.listeners.get("fetch")!(online);
      await online.responded();

      worker.fetchMock.mockRejectedValue(new Error("offline"));
      const offline = navigate(`${ORIGIN}/dashboard/portefeuille`);
      worker.listeners.get("fetch")!(offline);
      await expect(offline.responded()).resolves.toBe("SHELL");
    });

    test("AC-1 — an uncached route offline rejects rather than resolving empty", async () => {
      worker.fetchMock.mockRejectedValue(new Error("offline"));
      const event = navigate(`${ORIGIN}/dashboard/immobilier`);
      worker.listeners.get("fetch")!(event);
      await expect(event.responded()).rejects.toThrow("offline");
    });

    test("build assets are served cache-first", async () => {
      worker.fetchMock.mockResolvedValue({ ok: true, body: "CHUNK", clone: () => ({ body: "CHUNK" }) });
      const url = `${ORIGIN}/_next/static/chunks/main.js`;
      let first: Promise<unknown> | undefined;
      worker.listeners.get("fetch")!({
        request: { method: "GET", url, mode: "no-cors" },
        respondWith: (p: Promise<unknown>) => { first = p; },
      });
      await first;
      expect(worker.fetchMock).toHaveBeenCalledTimes(1);

      let second: Promise<unknown> | undefined;
      worker.listeners.get("fetch")!({
        request: { method: "GET", url, mode: "no-cors" },
        respondWith: (p: Promise<unknown>) => { second = p; },
      });
      await expect(second).resolves.toBe("CHUNK");
      // Served from cache — no second network call.
      expect(worker.fetchMock).toHaveBeenCalledTimes(1);
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/offline/sw.test.ts`
  Expected: `Test Files  1 passed`, `Tests  10 passed`, exit 0.
  Commit: `git add apps/web/src/lib/offline/sw.test.ts && git commit -m "test(#45): cover the service worker's shell, fallback and passthrough paths"`

- [x] **T12 — Register the worker from the layout** [AC: AC-1]

  Create `apps/web/src/components/service-worker-registrar.tsx`:
  ```tsx
  "use client";

  // Story 9-2 (FR-54, ADR-0018). Next 16 has no native service-worker route, so
  // registration is manual (Next PWA guide, § Creating a Service Worker).
  // Production only: in dev the worker would cache Turbopack's HMR documents and
  // shadow every subsequent edit.
  import { useEffect } from "react";

  export function ServiceWorkerRegistrar() {
    useEffect(() => {
      if (process.env.NODE_ENV !== "production") return;
      if (!("serviceWorker" in navigator)) return;

      const register = () => {
        void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
          // A failed registration must never break the page: the app simply
          // stays online-only.
        });
      };

      // Registering during load competes with the first paint for bandwidth.
      if (document.readyState === "complete") {
        register();
        return;
      }
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }, []);

    return null;
  }
  ```
  Edit `apps/web/src/app/layout.tsx`. **(a)** replace:
  ```tsx
  import { InstallPrompt } from "@/components/install-prompt";
  ```
  with:
  ```tsx
  import { InstallPrompt } from "@/components/install-prompt";
  import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
  ```
  **(b)** replace:
  ```tsx
          {/* Fixed-position install banner — inside the intl provider for
              useTranslations; DOM order is irrelevant (position: fixed). */}
          <InstallPrompt />
  ```
  with:
  ```tsx
          {/* Fixed-position install banner — inside the intl provider for
              useTranslations; DOM order is irrelevant (position: fixed). */}
          <InstallPrompt />
          {/* Registers /sw.js in production (story 9-2). Renders nothing. */}
          <ServiceWorkerRegistrar />
  ```
  Create `apps/web/src/components/service-worker-registrar.test.tsx`:
  ```tsx
  // AC-1 — the shell can only be cached if the worker is actually registered.
  import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
  import { render } from "@testing-library/react";
  import { ServiceWorkerRegistrar } from "./service-worker-registrar";

  const ORIGINAL_ENV = process.env.NODE_ENV;
  const registerMock = vi.fn();

  beforeEach(() => {
    registerMock.mockReset().mockResolvedValue({});
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: registerMock },
      configurable: true,
    });
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.env, "NODE_ENV", { value: ORIGINAL_ENV, configurable: true });
  });

  describe("ServiceWorkerRegistrar (story 9-2)", () => {
    test("registers /sw.js at the root scope in production", () => {
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
      render(<ServiceWorkerRegistrar />);
      expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    });

    test("registers nothing outside production", () => {
      Object.defineProperty(process.env, "NODE_ENV", { value: "development", configurable: true });
      render(<ServiceWorkerRegistrar />);
      expect(registerMock).not.toHaveBeenCalled();
    });

    test("a rejected registration does not throw", async () => {
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
      registerMock.mockRejectedValue(new Error("insecure context"));
      expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
      await Promise.resolve();
    });

    test("renders no DOM", () => {
      Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
      const { container } = render(<ServiceWorkerRegistrar />);
      expect(container).toBeEmptyDOMElement();
    });
  });
  ```
  Run: `cd apps/web && bun run test src/components/service-worker-registrar.test.tsx`
  Expected: `Test Files  1 passed`, `Tests  4 passed`, exit 0.
  Commit: `git add apps/web/src/components/service-worker-registrar.tsx apps/web/src/components/service-worker-registrar.test.tsx apps/web/src/app/layout.tsx && git commit -m "feat(#45): register the service worker from the root layout (AC-1)"`

- [x] **T13 — Allow the worker in the enforced CSP** [AC: AC-1]

  `worker-src` is currently absent, so it falls back to `default-src 'self'` — the
  registration works today but would break silently the day `default-src` is
  tightened. Make it explicit.

  Edit `apps/web/src/lib/security/headers.ts` — replace:
  ```ts
      "connect-src": ["'self'", ...supabase, ...connectExtra],
      "frame-ancestors": ["'none'"],
  ```
  with:
  ```ts
      "connect-src": ["'self'", ...supabase, ...connectExtra],
      // Story 9-2 — /sw.js is same-origin. Explicit rather than inherited from
      // default-src so tightening default-src can never silently kill the PWA.
      "worker-src": ["'self'"],
      "frame-ancestors": ["'none'"],
  ```
  `apps/web/src/lib/security/headers.test.ts` already exists with 9 tests, uses `test(` (not
  `it(`) and defines `const NONCE = "dGVzdC1ub25jZQ==";` at module scope. Extend it — replace
  its final block:
  ```ts
    // AC-3: "Tamagui styles load via style-src 'unsafe-inline'" — the nonce
    // scope is script-src only.
    test("style-src keeps unsafe-inline for Tamagui (AC-3 scope)", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
    });
  });
  ```
  with:
  ```ts
    // AC-3: "Tamagui styles load via style-src 'unsafe-inline'" — the nonce
    // scope is script-src only.
    test("style-src keeps unsafe-inline for Tamagui (AC-3 scope)", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toMatch(/style-src[^;]*'unsafe-inline'/);
    });

    // Story 9-2 (AC-1) — /sw.js is same-origin; the enforced CSP must allow it
    // explicitly rather than by inheritance from default-src.
    test("worker-src allows the same-origin service worker (story 9-2, AC-1)", () => {
      const csp = buildContentSecurityPolicy({ dev: false, nonce: NONCE });
      expect(csp).toContain("worker-src 'self'");
    });
  });
  ```
  Run: `cd apps/web && bun run test src/lib/security/headers.test.ts`
  Expected: `Test Files  1 passed`, `Tests  10 passed` (9 pre-existing + 1), exit 0.
  Commit: `git add apps/web/src/lib/security/headers.ts apps/web/src/lib/security/headers.test.ts && git commit -m "feat(#45): add worker-src 'self' to the enforced CSP (AC-1)"`

- [x] **T14 — Offline banner copy (fr + en)** [AC: AC-6]

  In `apps/web/messages/fr.json`, replace:
  ```json
  {
    "install": {
  ```
  with:
  ```json
  {
    "offline": {
      "aria": "Mode hors ligne",
      "title": "Hors ligne — données en lecture seule.",
      "age": "Hors ligne — données d'il y a {minutes} min, en lecture seule."
    },
    "install": {
  ```
  In `apps/web/messages/en.json`, replace:
  ```json
  {
    "install": {
  ```
  with:
  ```json
  {
    "offline": {
      "aria": "Offline mode",
      "title": "Offline — read-only data.",
      "age": "Offline — data from {minutes} min ago, read-only."
    },
    "install": {
  ```
  Run: `cd apps/web && bun -e "const fr=JSON.parse(require('fs').readFileSync('messages/fr.json','utf8')); const en=JSON.parse(require('fs').readFileSync('messages/en.json','utf8')); if(!fr.offline?.age||!en.offline?.age) throw new Error('offline namespace missing'); console.log('both message files parse with the offline namespace')"`
  Expected: prints `both message files parse with the offline namespace`, exit 0.
  Commit: `git add apps/web/messages/fr.json apps/web/messages/en.json && git commit -m "feat(#45): add offline banner copy (fr + en)"`

- [x] **T15 — Offline banner component** [AC: AC-6]

  Create `apps/web/src/components/offline-banner.tsx`:
  ```tsx
  "use client";

  // Story 9-2 (FR-54, AC-6). Signal-gated: renders only while the browser reports
  // offline. Styled with inline `style` on plain DOM rather than Tamagui, which is
  // why it carries `font_body` — DS COLOUR vars are global, but `--f-family` only
  // exists under Tamagui's font_* classes, and omitting it is what shipped the
  // install banner in serif (lesson 2026-07-13).
  import { useEffect, useState } from "react";
  import { useTranslations } from "next-intl";
  import { useQueryClient } from "@tanstack/react-query";
  import { WifiOff } from "lucide-react";
  import { dashboardKeys } from "@/lib/zapaction/keys";

  export function OfflineBanner() {
    const t = useTranslations("offline");
    const queryClient = useQueryClient();
    // Start hidden so the server render and the first client paint agree — the
    // effect is the only thing that may reveal the banner (lesson 2026-05-20).
    const [offline, setOffline] = useState(false);

    useEffect(() => {
      const sync = () => setOffline(navigator.onLine === false);
      sync();
      window.addEventListener("online", sync);
      window.addEventListener("offline", sync);
      return () => {
        window.removeEventListener("online", sync);
        window.removeEventListener("offline", sync);
      };
    }, []);

    if (!offline) return null;

    // The overview query is the one every cap screen depends on, so its
    // dataUpdatedAt is the honest age of what the user is looking at.
    const updatedAt = queryClient.getQueryState(dashboardKeys.overview())?.dataUpdatedAt ?? 0;
    const minutes = updatedAt > 0 ? Math.max(0, Math.round((Date.now() - updatedAt) / 60_000)) : null;

    return (
      <div
        role="status"
        aria-live="polite"
        aria-label={t("aria")}
        className="font_body"
        style={{
          position: "fixed",
          left: 16,
          right: 16,
          top: "calc(env(safe-area-inset-top, 0px) + 12px)",
          zIndex: 60,
          maxWidth: 480,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 14,
          background: "var(--backgroundElevated)",
          color: "var(--color)",
          border: "1px solid color-mix(in srgb, var(--color) 12%, transparent)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          fontSize: 13,
        }}
      >
        <span aria-hidden style={{ display: "flex", flexShrink: 0 }}>
          <WifiOff size={16} />
        </span>
        <span style={{ minWidth: 0 }}>{minutes === null ? t("title") : t("age", { minutes })}</span>
      </div>
    );
  }
  ```
  Create `apps/web/src/components/offline-banner.test.tsx`:
  ```tsx
  // AC-6 — "a banner states the offline mode and the age in minutes of the
  // displayed snapshot, localised in fr + en, carrying the font_body class."
  import { act } from "react";
  import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
  import { screen } from "@testing-library/react";
  import { axe } from "vitest-axe";
  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { NextIntlClientProvider } from "next-intl";
  import { render } from "@testing-library/react";
  import { dashboardKeys } from "@/lib/zapaction/keys";
  import frMessages from "../../messages/fr.json";
  import enMessages from "../../messages/en.json";
  import { OfflineBanner } from "./offline-banner";

  function setOnline(value: boolean): void {
    Object.defineProperty(navigator, "onLine", { value, configurable: true });
  }

  function renderBanner(locale: "fr" | "en", client: QueryClient) {
    return render(
      <NextIntlClientProvider locale={locale} messages={locale === "fr" ? frMessages : enMessages}>
        <QueryClientProvider client={client}>
          <OfflineBanner />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
  }

  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
    setOnline(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setOnline(true);
  });

  describe("OfflineBanner (story 9-2)", () => {
    it("renders nothing while online", () => {
      renderBanner("fr", client);
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("AC-6 — appears when the browser goes offline", async () => {
      renderBanner("fr", client);
      setOnline(false);
      act(() => {
        window.dispatchEvent(new Event("offline"));
      });
      const banner = await screen.findByRole("status");
      expect(banner).toHaveAccessibleName("Mode hors ligne");
      expect(banner.className).toContain("font_body");
    });

    it("AC-6 — reports the snapshot age in minutes", async () => {
      client.setQueryData(dashboardKeys.overview(), { netWorth: 1 });
      const state = client.getQueryState(dashboardKeys.overview());
      vi.spyOn(Date, "now").mockReturnValue((state?.dataUpdatedAt ?? 0) + 7 * 60_000);
      setOnline(false);
      renderBanner("fr", client);
      const banner = await screen.findByRole("status");
      expect(banner).toHaveTextContent("il y a 7 min");
    });

    it("AC-6 — falls back to the age-less copy with no snapshot", async () => {
      setOnline(false);
      renderBanner("fr", client);
      const banner = await screen.findByRole("status");
      expect(banner).toHaveTextContent("lecture seule");
      expect(banner).not.toHaveTextContent("il y a");
    });

    it("AC-6 — renders the en catalog", async () => {
      setOnline(false);
      renderBanner("en", client);
      const banner = await screen.findByRole("status");
      expect(banner).toHaveTextContent("read-only");
      expect(banner).toHaveAccessibleName("Offline mode");
    });

    it("disappears again when connectivity returns", async () => {
      setOnline(false);
      renderBanner("fr", client);
      await screen.findByRole("status");
      setOnline(true);
      act(() => {
        window.dispatchEvent(new Event("online"));
      });
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("has no axe violations", async () => {
      setOnline(false);
      const { container } = renderBanner("fr", client);
      await screen.findByRole("status");
      expect(await axe(container)).toHaveNoViolations();
    });
  });
  ```
  Run: `cd apps/web && bun run test src/components/offline-banner.test.tsx`
  Expected: `Test Files  1 passed`, `Tests  7 passed`, exit 0.
  Commit: `git add apps/web/src/components/offline-banner.tsx apps/web/src/components/offline-banner.test.tsx && git commit -m "feat(#45): offline banner with snapshot age, fr + en (AC-6)"`

- [x] **T16 — Full verification gate** [AC: AC-1, AC-2, AC-3, AC-4, AC-5, AC-6]

  Run, in this order:
  ```bash
  cd apps/web && bun run typecheck
  cd apps/web && bun run lint
  cd apps/web && bun run test
  ```
  Expected: `tsc --noEmit` exits 0 with no output; `oxlint src` reports `Found 0 warnings and 0 errors` (or its no-diagnostics line), exit 0; the suite reports **109 test files** and **338 tests passed** — the 101 files / 289 tests baseline from story 9-1, plus 8 new files carrying 48 tests (cache-db 6, cache-crypto 6, query-persister 8, use-offline-persistence 5, sw 10, service-worker-registrar 4, offline-banner 7, sign-out-button 2) and the 1 test appended to the existing `headers.test.ts`. A lower count means a task was skipped.
  Commit: nothing to commit — this task is a gate. If anything is red, fix it in the task that owns the file and amend that commit.

  **Mandatory live visual pass (do NOT defer — lesson 2026-07-13).** The banner is
  signal-gated exactly like story 9-1's install prompt, which reached `done` rendering
  in serif because the live pass was postponed. Inject the signal instead:
  ```bash
  cd apps/web && bun run build && bun run start
  ```
  Then, on `http://localhost:3002/dashboard` signed in: DevTools → Network → **Offline**,
  reload, and confirm with `mcp__react-grab-mcp__get_element_context` on the banner that
  (a) the text renders in Geist and not a serif fallback, (b) the banner clears the top of
  the content and does not collide with the install prompt at the bottom, (c) the dashboard
  still shows values rather than empty states. Then Application → Service Workers shows
  `/sw.js` **activated**, and Application → IndexedDB → `pekulo-cache-<userId>` →
  `snapshots` shows a binary payload with no readable account label.

## Dev Notes

- **Architecture:**
  - **ADR-0018 (written in T1) is the governing decision; ADR-0003 is superseded.** Do not
    implement ADR-0003's session-derived key or its `onAuthStateChange('SIGNED_OUT')` purge —
    neither is reachable under httpOnly cookies (story 11-7).
  - **There is no native `app/sw.ts` in Next 16.** Verified against the embedded guide at
    `apps/web/node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` § 5, which
    prescribes `public/sw.js` plus `navigator.serviceWorker.register('/sw.js')`. That doc also
    notes Serwist "requires webpack configuration" — this app builds with Turbopack, so Serwist
    is out. `apps/web/AGENTS.md` ("This is NOT the Next.js you know") applies: prefer the
    embedded docs over training-data assumptions for anything Next-specific.
  - **Route paths are the `(cap)` group's real URLs**: `/dashboard`,
    `/dashboard/portefeuille`, `/dashboard/immobilier`. The architecture's `/portefeuille` and
    `/immobilier` were wrong and are corrected in T1.
  - **Data flow that forces the two-layer design**: `useDashboardOverview()` →
    `useActionQuery(getDashboardOverview, …)` → `dashboard-actions.ts` (`"use server"`,
    `defineAction`) → oRPC to `apps/api`. That is a POST with a per-build `Next-Action` id
    returning an RSC stream; the Cache API cannot store POST responses.
  - **Precedent to imitate**: `apps/web/src/lib/llm/attest-db.ts` (story 6-6) — memoised
    connection promise released on `blocking`/`terminated`, `idb` as the wrapper. Same
    discipline in `cache-db.ts`. That store is deliberately *not* encrypted (it holds only
    hashed attestations); this one must be.
  - **CSP**: `worker-src` is absent today and inherits `default-src 'self'`, so registration
    works — T13 makes it explicit so a future tightening cannot break the PWA silently.
    `/sw.js` reaches the middleware but `isStatic` (`pathname.includes(".")`) short-circuits the
    auth redirect, so the worker is served without a session. That is required: the worker must
    load before anything else can.

- **Files** (single-responsibility map):
  - `apps/web/src/lib/offline/cache-db.ts` — **NEW.** Sole job: own the per-user IndexedDB
    databases and the remembered-user pointer. Imports `idb`; exports `openCacheDb`,
    `closeCacheDb`, `purgeCacheDb`, `purgeOfflineCache`, the pointer helpers and the store
    constants.
  - `apps/web/src/lib/offline/cache-crypto.ts` — **NEW.** Sole job: mint/read the
    non-extractable AES-GCM key and wrap JSON in an encrypted envelope. Imports the `idb`
    types only; exports `getCacheKey`, `getOrCreateCacheKey`, `encryptJson`, `decryptJson`.
  - `apps/web/src/lib/offline/query-persister.ts` — **NEW.** Sole job: satisfy the
    `Persister` interface over the encrypted store and enforce the 60-minute ceiling.
    Imports the two modules above; exports `createEncryptedPersister`,
    `isOfflineEligibleQuery`, `OFFLINE_MAX_AGE_MS`, `SNAPSHOT_ID`.
  - `apps/web/src/lib/offline/use-offline-persistence.ts` — **NEW.** Sole job: reconcile the
    identity and boot the persister against the query client. Imports the persister + the
    identity action; exports `useOfflinePersistence` and `resolveOfflineUserId`.
  - `apps/web/src/app/(cap)/_actions/offline-identity.ts` — **NEW.** Sole job: hand the
    browser the `userId` behind the httpOnly cookie. Imports the Supabase server client;
    exports `getOfflineIdentity`.
  - `apps/web/public/sw.js` — **NEW.** Sole job: cache and serve the app shell. No imports,
    no exports — a standalone worker script.
  - `apps/web/src/components/service-worker-registrar.tsx` — **NEW.** Sole job: register
    `/sw.js` in production. Imports `react`; exports `ServiceWorkerRegistrar`.
  - `apps/web/src/components/offline-banner.tsx` — **NEW.** Sole job: tell the user the data
    is cached and how old it is. Imports `next-intl`, `@tanstack/react-query`, `lucide-react`,
    `dashboardKeys`; exports `OfflineBanner`.
  - `apps/web/src/components/providers.tsx` — **MODIFY.** Boots the persister, mounts the banner.
  - `apps/web/src/app/layout.tsx` — **MODIFY.** Mounts `<ServiceWorkerRegistrar/>`.
  - `apps/web/src/lib/security/headers.ts` — **MODIFY.** Adds `worker-src 'self'`.
  - `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx` — **MODIFY.**
    Purges the cache on sign-out success.
  - `apps/web/next.config.ts` — **MODIFY.** Adds the `/sw.js` no-cache header.
  - `apps/web/messages/{fr,en}.json` — **MODIFY.** Add the `offline` namespace.
  - `apps/web/package.json` — **MODIFY.** Adds `@tanstack/react-query-persist-client` (and
    `@testing-library/user-event` if absent).

- **Existing code at write time** (Step-0 verbatim quotes — edit against these, do not paraphrase):

  `apps/web/src/components/providers.tsx` (current, complete):
  ```tsx
  // apps/web/src/components/providers.tsx
  "use client";

  import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
  import { useState, type ErrorInfo, type ReactNode } from "react";
  import { PekuloErrorBoundary, PekuloRootProvider } from "@pekulo/ui";
  import "@/lib/zapaction/keys";

  // V1 (a) personal-use phase — log to the console; epic 11 wires GlitchTip
  // via OTel (NFR-26) and turns this into a real reporter.
  function reportClientError(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[pekulo] client error", error, info);
  }

  export function Providers({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
      () =>
        new QueryClient({
          defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
        }),
    );
    return (
      <PekuloRootProvider>
        <PekuloErrorBoundary onError={reportClientError} fullScreen>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </PekuloErrorBoundary>
      </PekuloRootProvider>
    );
  }
  ```

  `apps/web/src/app/layout.tsx:76-88` (current — the body T12 edits):
  ```tsx
      <body>
        <ReactGrabDev />
        {/* next-intl v4: provider auto-inherits locale + messages from
            i18n/request.ts when rendered in a Server Component — no props. */}
        <NextIntlClientProvider>
          <NuqsAdapter>
            <Providers>{children}</Providers>
          </NuqsAdapter>
          {/* Fixed-position install banner — inside the intl provider for
              useTranslations; DOM order is irrelevant (position: fixed). */}
          <InstallPrompt />
        </NextIntlClientProvider>
      </body>
  ```

  `apps/web/src/lib/security/headers.ts:53-66` (current — the directive map T13 edits):
  ```ts
    const directives: Record<string, string[]> = {
      "default-src": ["'self'"],
      "script-src": scriptSrc,
      // style-src keeps 'unsafe-inline' — Tamagui injects <style> dynamically and
      // cannot carry a nonce; style injection is not script execution (AC-3 scope).
      "style-src": ["'self'", "'unsafe-inline'", ...styleExtra],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "font-src": ["'self'", "data:", ...fontExtra],
      "connect-src": ["'self'", ...supabase, ...connectExtra],
      "frame-ancestors": ["'none'"],
      "base-uri": ["'self'"],
      "form-action": ["'self'"],
      "object-src": ["'none'"],
    };
  ```

  `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx:17-31` (current — the handler T9 edits):
  ```tsx
    async function handleSignOut() {
      if (loading) return;
      setLoading(true);
      try {
        const result = await signOut();
        if (!result.ok) {
          toast.danger(t("title"), result.message);
          return;
        }
        router.push("/login");
        router.refresh();
      } finally {
        setLoading(false);
      }
    }
  ```

  `apps/web/next.config.ts:47-52` (current — the block T10 edits):
  ```ts
    allowedDevOrigins: ["*.trycloudflare.com", "*.trafijs.com"],
    turbopack: {
      resolveAlias: {
        "react-native": "react-native-web",
      },
  ```

  `apps/web/messages/fr.json:1-2` and `apps/web/messages/en.json:1-2` (current — T14 inserts before `"install"`):
  ```json
  {
    "install": {
  ```

  `apps/web/package.json` and the root `bun.lock` are modified only by the `bun add` commands
  in T2 and T9 — there is no hand-edit to make, so no verbatim quote is needed. Note that
  **there is no `apps/web/bun.lock`**: this monorepo hoists a single root lockfile (story 9-1
  staged the wrong path and had to correct it).

  `apps/web/src/app/(cap)/dashboard/_hooks/use-dashboard-overview.ts:11-18` (current — the read path this story caches; NOT modified):
  ```ts
  export function useDashboardOverview() {
    return useActionQuery(getDashboardOverview, {
      input: undefined,
      queryKey: dashboardKeys.overview(),
      readPolicy: "read-only",
      staleTime: 30_000,
    });
  }
  ```

- **Testing:**
  - Framework = Vitest (`environment: happy-dom`, `globals: true`, setup `./test/setup.tsx`).
    Per-file run pattern is `cd apps/web && bun run test <path>` — never
    `bun --filter=web` (the workspace name is `@pekulo/web`, lesson 2026-05-19).
  - **`import "fake-indexeddb/auto"` is required at the top of every test that touches
    IndexedDB** — happy-dom ships none. This is the same pattern as
    `src/lib/llm/attest-queue.test.ts`. `fake-indexeddb@6.2.5` is already a devDependency.
  - **Verified before writing this story** (throwaway probes, run and deleted): happy-dom
    exposes a working `crypto.subtle`; a non-extractable `CryptoKey` survives a
    `fake-indexeddb` round-trip with `extractable === false` intact and stays usable for
    encrypt/decrypt; `Uint8Array`/`ArrayBuffer` round-trip intact; `indexedDB.databases()` is
    implemented by fake-indexeddb; vitest's cwd is `apps/web`, so
    `resolve(process.cwd(), "public/sw.js")` is the correct path in T11.
  - `vi.mock` factories are hoisted — take every mock function from `vi.hoisted(...)`
    (lesson 2026-05-20), as T7, T9 and T11's tests do.
  - a11y via `vitest-axe` (`toHaveNoViolations`), mirroring the `_appearance/…a11y.test.tsx`
    suites. `renderWithTamagui` wraps `NextIntlClientProvider locale="fr"` — the banner test
    renders its own providers instead because it must assert the **en** catalog too (AC-6).
  - **Mandatory manual gate before every commit:** `cd apps/web && bun run typecheck` — the
    pre-commit hooks do NOT run `tsc` (lesson 2026-06-01).
  - `oxlint`'s `restriction` and `pedantic` categories are `off` in `.oxlintrc.json`, so the
    `new Function` in T11's worker loader will not trip `no-new-func`. The
    `eslint-disable-next-line` comment above it documents intent for the reviewer.

- **Dependencies:**
  - New runtime dep in `apps/web`: `@tanstack/react-query-persist-client@5.101.4` (matches the
    installed `@tanstack/react-query` 5.x line). Its `Persister` interface is exactly
    `{ persistClient, restoreClient, removeClient }` and `persistQueryClient(props)` returns
    `[unsubscribe, restorePromise]` — verified against the published `.d.ts`.
  - New devDep if absent: `@testing-library/user-event` (T9's click test).
  - Already present and reused: `idb@8.0.3`, `fake-indexeddb@6.2.5`, `next-intl`,
    `lucide-react`, `@tanstack/react-query`.
  - No new API, no Prisma migration, no `apps/api` change.

- **Commit prefix:** `feat(#45): …` (or `test(#45):` / `chore(#45):` / `docs(#45):` per task).
  Final PR body carries `Closes #45`.

- **Known limitations (documented, not bugs):**
  - The cached shell is the SSR HTML captured on the last online visit. Offline, React Query
    rehydrates it with the decrypted snapshot; a brand-new route never visited online has
    nothing to serve and will fail to navigate. That matches AC-1's precondition ("I have
    visited the dashboard once online").
  - `indexedDB.databases()` is unimplemented on Firefox; `purgeOfflineCache` there falls back
    to deleting the remembered user's database, which is the one holding data.
  - A non-extractable key does not defend against JavaScript already running in the origin.
    No browser-side scheme does; the enforced nonce-strict CSP (story 11-7) is that layer.
  - The banner reports the age of `dashboard.overview` specifically. On the portefeuille and
    immobilier screens that is a proxy for the snapshot's age, not a per-screen measurement.

## File List

_Expected files created/modified by this story (final list confirmed by aped-dev):_

- `docs/adr/0018-pwa-offline-cache-revised-for-httponly-sessions.md` (new)
- `docs/adr/0003-pwa-offline-cache-encrypted-indexeddb.md` (modified — superseded)
- `docs/architecture.md` (modified — D7, two tree diagrams, FR-54 traceability row)
- `docs/epics.md` (modified — story 9-2 summary)
- `apps/web/src/lib/offline/cache-db.ts` (new)
- `apps/web/src/lib/offline/cache-db.test.ts` (new)
- `apps/web/src/lib/offline/cache-crypto.ts` (new)
- `apps/web/src/lib/offline/cache-crypto.test.ts` (new)
- `apps/web/src/lib/offline/query-persister.ts` (new)
- `apps/web/src/lib/offline/query-persister.test.ts` (new)
- `apps/web/src/lib/offline/use-offline-persistence.ts` (new)
- `apps/web/src/lib/offline/use-offline-persistence.test.ts` (new)
- `apps/web/src/lib/offline/routes.ts` (new — added at T16, shared offline-route list)
- `apps/web/src/lib/offline/routes.test.ts` (new — added at T16, keeps sw.js in sync)
- `apps/web/src/lib/offline/sw.test.ts` (new)
- `apps/web/src/app/(cap)/_actions/offline-identity.ts` (new)
- `apps/web/public/sw.js` (new)
- `apps/web/src/components/service-worker-registrar.tsx` (new)
- `apps/web/src/components/service-worker-registrar.test.tsx` (new)
- `apps/web/src/components/offline-banner.tsx` (new)
- `apps/web/src/components/offline-banner.test.tsx` (new)
- `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.test.tsx` (new)
- `apps/web/src/components/providers.tsx` (modified)
- `apps/web/src/app/layout.tsx` (modified)
- `apps/web/src/lib/security/headers.ts` (modified)
- `apps/web/src/lib/security/headers.test.ts` (new or modified)
- `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.tsx` (modified)
- `apps/web/next.config.ts` (modified)
- `apps/web/messages/fr.json` (modified)
- `apps/web/messages/en.json` (modified)
- `apps/web/package.json` (modified)
- `bun.lock` (modified — root monorepo lockfile; there is no `apps/web/bun.lock`)
- `docs/epics-context/epic-9-context.md` (modified — lessons refresh by aped-story)
- `docs/state.yaml` (sprint status `pending` → `in-progress`; `active_epic` 8 → 9)
- `.gitignore` (modified at T16 — `*.nosync` iCloud-eviction guard, see the T16 record)
- `scripts/dev-tunnel.sh` (untracked dev tooling — the cloudflared named tunnel the T16
  live pass runs against. Predates 9-2; declared here because the branch carries it)
- `apps/web/src/app/(cap)/_actions/offline-actions.ts` (new at aped-review — renamed from
  `offline-identity.ts` for the `<feature>-actions.ts` convention, and reworked to answer
  three states so a Supabase outage can no longer read as a sign-out)

## Dev Agent Record

- **Model:** claude-opus-5[1m]
- **Started:** 2026-07-25T15:38:55Z
- **Completed:** 2026-07-25T20:45:00Z

### Summary

Shipped both ADR-0018 layers. **Shell:** hand-written `public/sw.js` (runtime caching
only — network-first on the three `(cap)` routes, cache-first on `/_next/static/*`,
non-GET and cross-origin passed through), registered from the root layout in production
only, served no-cache via `next.config.ts` headers, and allowed explicitly by
`worker-src 'self'` in the enforced CSP. **Data:** a React Query `Persister` over a
per-user `pekulo-cache-<userId>` IndexedDB, AES-GCM under a **non-extractable**
`CryptoKey`, 60-minute ceiling enforced both in `restoreClient` and via
`persistQueryClient`'s `maxAge`, dehydrating only the `dashboard` / `holdings` /
`realestate` key prefixes. **Identity:** a `"use server"` action reads the httpOnly
cookie; the id is mirrored to `localStorage` so a cold offline start opens the right
database; a confirmed-online "no session" purges everything, an identity change purges
the previous user first, and an unreachable server never purges. The offline banner
carries `font_body` (lesson 2026-07-13) and reports the snapshot age in fr + en.

All 15 implementation tasks are committed. **The T16 verification gate is NOT satisfied**
— see Deviations: three tools (`tsc`, oxlint's `import` plugin, the Tamagui test setup)
hang in the dev-agent sandbox, and the mandatory live visual pass could not be run.

### Files changed

- `docs/adr/0018-pwa-offline-cache-revised-for-httponly-sessions.md` (new)
- `docs/adr/0003-pwa-offline-cache-encrypted-indexeddb.md` (superseded)
- `docs/architecture.md` (D7 block, two tree diagrams, FR-54 traceability row)
- `docs/epics.md` (story 9-2 summary)
- `apps/web/src/lib/offline/{cache-db,cache-crypto,query-persister,use-offline-persistence}.ts` + their `.test.ts` (new)
- `apps/web/src/lib/offline/sw.test.ts` (new)
- `apps/web/src/app/(cap)/_actions/offline-identity.ts` (new)
- `apps/web/public/sw.js` (new)
- `apps/web/src/components/{offline-banner,service-worker-registrar}.tsx` + their `.test.tsx` (new)
- `apps/web/src/app/(cap)/dashboard/_account/_components/sign-out-button.{tsx,test.tsx}` (modified / new)
- `apps/web/src/components/providers.tsx`, `apps/web/src/app/layout.tsx`, `apps/web/src/lib/security/headers.{ts,test.ts}`, `apps/web/next.config.ts` (modified)
- `apps/web/messages/{fr,en}.json` (offline namespace)
- `apps/web/package.json`, root `bun.lock` (modified)

### Deviations

**Environment — three tools hang in the dev-agent sandbox (0 % CPU, no output, indefinitely).
None is caused by this story's code; each was isolated by bisection.**

1. **`bun add` / `bun install`** hang after `Resolved, downloaded and extracted`. Cause:
   postinstall scripts (`trustedDependencies: ["unrs-resolver"]`, `sharp`, `supabase`).
   `bun install --ignore-scripts` completes in 470 ms. Both dependencies were installed
   that way. **Network and sandbox were ruled out by direct test.**
2. **`tsc --noEmit`** hangs at startup (28 min, RSS 4 MB — it never begins reading files),
   both via `bun run typecheck` and via `bunx tsc`. **The mandatory pre-commit typecheck
   gate (lesson 2026-06-01) could NOT be run for any task.** This is the most serious
   unverified gate in this story.
3. **oxlint's `import` plugin** hangs on `.tsx` files — reproduced on `install-prompt.tsx`,
   a file untouched by this story. `react`, `jsx-a11y`, `nextjs` and the `pekulo/*` jsPlugins
   all complete in < 1 s. Lint was therefore run with the full project config **minus the
   `import` plugin**: 151 rules over 333 files, **0 errors**, 6 warnings (only one touches
   this story — `no-await-in-loop` in `cache-db.test.ts`'s verbatim cleanup loop).
4. **The Tamagui test setup (`test/setup.tsx`) hangs on module load**, which blocks the
   whole project suite. Vitest itself is fine: with the setup removed it runs in 565 ms.
   Tests were run under a throwaway config (`pool: forks`, `singleFork`, and for component
   tests a reduced setup providing jest-dom + vitest-axe matchers + the `matchMedia` stub,
   without the Tamagui provider stack). **All diagnostic files were deleted afterwards.**
   Consequence: `sign-out-button.test.tsx` (T9), the only test importing
   `renderWithTamagui`, **was never executed**. Its AC-4 behaviour is covered indirectly by
   `cache-db.test.ts` (`purgeOfflineCache`) and `use-offline-persistence.test.ts`.
5. **Commits of `.tsx` files used `LEFTHOOK=0`** (user-authorised) because the pre-commit
   oxlint hook inherits the hanging `import` plugin. For each, lint (minus that plugin) and
   `oxfmt` were run manually first. Affected: T15, T8, T12, T9.

**Story-spec corrections (the story text was wrong, not the codebase):**

6. **Dependency version.** T2 pins `@tanstack/react-query-persist-client@5.101.4`, claiming
   it "matches the installed `@tanstack/react-query` 5.x line". It does not: 5.101.4 requires
   peer `react-query@^5.101.4` while the app has `5.100.5` (bun emitted
   `warn: incorrect peer dependency`). Installed **5.100.5** instead — exactly aligned,
   and it avoids bumping react-query app-wide (out of scope, and a regression risk for the
   existing suite). The story's *intent* is honoured; only its version number changed.
7. **T1's grep gate expects `:1` for ADR-0018 itself**, but the ADR body prescribed verbatim
   never contains the string "ADR-0018" — and **no ADR in this repo cites its own id**
   (verified on 0013/0014/0015/0017). Satisfying the gate would have violated the repo
   convention. Actual result: `3 / 1 / 1 / 0`; the three counts that verify the doc-sync
   are correct.
8. **T5's test tripped `no-unsafe-optional-chaining`.** The verbatim line
   `(restored?.…state.data as {netWorth:number}).netWorth` throws if the chain
   short-circuits. Rewritten via an intermediate `const query` — same assertion, same value.
9. **T12's test used an incomplete property descriptor.** `Object.defineProperty(process.env,
   "NODE_ENV", { value, configurable: true })` throws `TypeError: 'process.env' only accepts a
   configurable, writable, and enumerable data descriptor`. Added `writable` + `enumerable`
   to all five occurrences.

**Process deviations:**

10. **The upstream-doc write guard blocked `docs/architecture.md`** (it arms as soon as a story
    is `in-progress` — i.e. this story's own state transition armed it). On the user's explicit
    instruction, the story status was temporarily flipped back to `ready-for-dev`, the four
    edits applied, and the status restored — rather than running `aped-course` (which would
    have posted ticket comments with no active worktree to notify) or deferring to review
    (the 7-1 precedent). Recorded here because it bypassed a project control.
11. **T6 has no commit of its own** — `offline-identity.ts` landed inside T5's commit
    (`9e51105`) after an intermediate oxlint failure left it staged. Content is intact.
12. **Step 04's two context-gathering subagents were not spawned** (session instructions
    forbid subagents unless requested); that context was gathered directly in steps 02–03.
13. **`detect-package-runner.sh` reports `npm`**, which is wrong for this repo (root `bun.lock`,
    `bun --bun next dev` scripts). Used `bun` throughout.

### Test output

Run under the throwaway config described above (project config's setup hangs):

```
 ✓ src/lib/offline/cache-db.test.ts                 (6 tests)
 ✓ src/lib/offline/cache-crypto.test.ts             (6 tests)
 ✓ src/lib/offline/query-persister.test.ts          (8 tests)
 ✓ src/lib/offline/use-offline-persistence.test.ts  (5 tests)
 ✓ src/lib/offline/sw.test.ts                       (10 tests)
 ✓ src/components/offline-banner.test.tsx           (7 tests)
 ✓ src/components/service-worker-registrar.test.tsx (4 tests)
 ✓ src/lib/security/headers.test.ts                 (10 tests)

 Test Files  8 passed (8)
      Tests  56 passed (56)
```

46 new tests + the 10 in `headers.test.ts` (9 pre-existing + 1 added). Every task witnessed a
RED before its GREEN; T11's ten tests passed on first run, so RED was witnessed by mutating
`sw.js`'s `method !== "GET"` guard (AC-5 went red, then the file was restored byte-identical
to its commit).

**NOT run — outstanding gates for `aped-review`:**

- `bun run test` (full suite, expected 109 files / 338 tests) — the Tamagui setup hangs.
- `bun run typecheck` — hangs (deviation 2). **No task in this story has a verified typecheck.**
- `bun run lint` with the `import` plugin — hangs (deviation 3).
- `sign-out-button.test.tsx` (2 tests) — never executed (deviation 4).
- **The mandatory live visual pass (lesson 2026-07-13) was NOT performed.** The react-grab MCP
  disconnected mid-session and the dev server was killed. This is exactly the pass whose
  deferral shipped story 9-1's banner in serif. `aped-review` MUST force it: `bun run build &&
  bun run start`, sign in, DevTools → Network → Offline, reload `/dashboard`, and confirm the
  banner renders in Geist (not serif), clears the install prompt, that the dashboard still
  shows values, that `/sw.js` is **activated** under Application → Service Workers, and that
  `pekulo-cache-<userId>` → `snapshots` holds unreadable ciphertext.

---

## T16 record — gate closed 2026-07-25 (second session)

### The three "hangs" were one environment fault, not three tooling faults

Deviations 1–4 above blamed `bun install`, `tsc`, oxlint's `import` plugin and the Tamagui
test setup for freezing "in the dev-agent sandbox". All four had a single cause, and it was
neither the sandbox nor this story's code: **the repository lives under an iCloud-synced
`~/Documents`, and iCloud had evicted 85 files from `node_modules`.** An evicted file is
`dataless` (`stat -f %Sf` → `hidden,compressed,dataless`, `blocks=0`); reading one blocks in
`read()` until iCloud rematerialises it, with no error and no CPU. Evidence chain:

| Check | Result |
|---|---|
| `node -e` / `tsc --version` | 27 ms / 54 ms — node itself is fine |
| `sample <pid>` on the frozen `tsc` | main thread in `read` for 100 % of the sample |
| `lsof -p <pid>` | stuck 18 s on the *same* happy-dom `.d.ts` |
| `stat -f %Sf` on that file | `hidden,compressed,dataless`, `blocks=0` |
| Re-run outside the sandbox | identical freeze — the sandbox was never involved |

Disk was 92 % full with `com.apple.bird optimize-storage = 1`, so iCloud re-evicted files as
fast as they were fetched. Fixed by moving the two hot directories out of iCloud's reach:
`node_modules` → `node_modules.nosync` and `apps/web/.next` → `.next.nosync`, each with a
symlink at the real name (iCloud skips any path ending in `.nosync`), plus `*.nosync` in
`.gitignore`. `bun install` then completed in **7.7 s** with postinstall scripts — against
28 minutes of hanging before.

### Gates — all green

| Gate | Result |
|---|---|
| `bun run typecheck` | exit 0 |
| `bun run lint` | 0 errors, 2 warnings (both pre-existing, outside this story) |
| `bun run test` | **110 files / 349 tests** passed |
| `oxfmt --check` | clean |

`sign-out-button.test.tsx` (deviation 4) now runs and passes under the project's real config —
the Tamagui setup never had a defect.

**The typecheck caught a real error the whole story had shipped blind** —
`cache-crypto.ts:56`, `TS2322`: under TypeScript 6 a bare `Uint8Array` widens to
`Uint8Array<ArrayBufferLike>`, which admits `SharedArrayBuffer` and is therefore not a valid
WebCrypto `BufferSource`. `encryptJson` escaped it only because its `iv` comes from
`getRandomValues`. Fixed by pinning the backing buffer in `cache-crypto.ts` and
`EncryptedSnapshot`.

### Live pass — run against the cloudflared tunnel

`https://pekulo-dev.trafijs.com` (real HTTPS origin), signed in, Chrome DevTools.

| Criterion | Evidence |
|---|---|
| AC-2 | key `AES-GCM/256`, `extractable: false`, `crypto.subtle.exportKey('raw', key)` → `InvalidAccessError`; 3 426 B of ciphertext; no `"dashboard"`, no amount in the payload |
| AC-6 typography | `Geist` — **not** the serif fallback that shipped in 9-1 |
| AC-6 cycle | appears offline, clears on reconnect with no reload |
| AC-6 a11y | `role=status`, `aria-live=polite`, localised `aria-label`; axe clean |
| SW | `activated`, scope `/`, cache `pekulo-shell-v1` (production run) |
| T10 / T13 | `/sw.js` served `no-cache, no-store, must-revalidate`; `worker-src 'self'` present in the **enforced** CSP |

### T16's own instructions are self-contradictory

T16 demands `bun run build && bun run start` **and** verification through
`mcp__react-grab-mcp__get_element_context`. These are mutually exclusive in this codebase:
`ServiceWorkerRegistrar` returns early unless `NODE_ENV === "production"`
(`service-worker-registrar.tsx:11`), while `ReactGrabDev` returns early unless
`NODE_ENV === "development"` and the CSP only allows unpkg in dev
(`react-grab-dev.tsx:24`, `headers.ts:35`). The pass was therefore split: Service Worker
checks in a production run, banner/typography/geometry checks in a dev run. A future story
should reword T16.

### Three defects found by the live pass, and fixed

1. **The cache never initialised on sign-in (AC-1).** `Providers` mounts in the ROOT layout,
   so `useOfflinePersistence` first ran on `/login` while signed out, concluded "confirmed
   signed out", and — keyed on mount alone — never re-ran. Measured after signing in:
   `pekulo:offline-user` `null` and **no `pekulo-cache-*` database**; both appeared only after
   a full page reload. A user who signed in and then lost connectivity had no snapshot at all.
   Reproduced on `localhost` and on the tunnel. Fixed: the install effect is now keyed on
   `usePathname()` and retries until an identity is known, guarded by an `installedRef` so it
   installs exactly once, with teardown moved to an unmount-only effect.
2. **The banner covered the whole app header on mobile (AC-6).** The cap-shell header is a
   normal flow element (`bento.module.css .header`) and the banner is `position: fixed`. At
   390×844 the banner covered the Cap / Patrimoine tabs and all five header buttons. Fixed
   with a `pekulo-offline-banner-open` class on `<html>` that offsets the page by 62 px.
   Measured after the fix: header `62 → 138`, banner `12 → 50`, **0 buttons covered**.
3. **The banner claimed cached data on uncached routes.** Mounted in the root layout, it
   rendered on `/login`, `/dashboard/transactions`, `/dashboard/mensuel`… where there is
   neither a snapshot nor a cached shell. Fixed with `lib/offline/routes.ts` as the single
   client-side source of truth, gated by `isOfflineRoute(pathname)`; `routes.test.ts` reads
   `public/sw.js` and fails if the two copies of the route list ever drift.

Eleven tests were added for these three fixes (RED witnessed before each GREEN).

### Still outstanding for `aped-review`

- **AC-1 offline reload and AC-5** were not exercised end-to-end: both need the Service Worker,
  hence a production build, and the session ended in the dev run used for the banner work.
- **The react-grab `get_element_context` step could not be automated** — the MCP tool returns
  "the latest context that was *submitted*", which requires a human selection in the overlay.
  Banner typography and geometry were instead verified through computed styles and
  `getBoundingClientRect`, which is strictly more precise than a visual read.

### Out of scope, found in passing (story 8-1, not fixed here)

`recover-form.tsx:35-68` awaits `requestPasswordReset` / `updatePassword` inside
`try { } finally { }` with **no `catch`**. React does not catch async rejections from event
handlers, so a failing Server Action becomes an unhandled rejection: no toast, no message, the
button simply re-arms and the user sees nothing happen. Observed live as a 500 from
`resolveOrigin()` when `NEXT_PUBLIC_SITE_URL` was unset in a production run. Worth an
`aped-triage` entry.

## Review Record

**Date:** 2026-07-25
**Auditors:** Spec, Code, Edge & Hallucination, Aria
**Verdict:** done

> **Override:** AC gap accepted — reason: "Écarts AC acceptés en review : chaque défaut est localisé au file:line avec
> reproduction, et le gate T16 est vert (typecheck, lint, 349 tests, build). Corriger dans le cycle de review coûte
> moins qu'un aller-retour en dev qui re-dériverait le même diagnostic."

All four auditors returned CHANGES_REQUESTED. Spec and Code converged independently on the same cross-account defect; Aria's live pass then found a visible dark-theme defect that no code read or unit test could have surfaced — the story was briefly closed before her report arrived and was reopened for it. The Lead
reproduced it with a throwaway test before accepting it, and re-ran every gate the committed Dev Agent Record had
declared impossible — they all pass. The iCloud `dataless` diagnosis in the T16 addendum is correct; the *committed*
`### Deviations` section above it (which blames postinstall scripts and "the dev-agent sandbox") is superseded by it.

### Findings

#### Resolved

- [BLOCKER] An in-tab account switch wrote user B's data into user A's database, and let B read A's figures from
  memory [apps/web/src/lib/offline/use-offline-persistence.ts:59]
  - Source: Spec + Code (independent convergence), reproduced by the Lead
  - Evidence: `Providers` mounts in the root layout (`layout.tsx:83`) and both sign-in (`auth-form.tsx:73`) and
    sign-out are client-side `router.push`es, so it never unmounts. The mount-only `installedRef` guard meant identity
    was resolved ONCE per tab. A throwaway test over A → sign-out → B measured `getOfflineIdentity` calls: 1,
    `persistQueryClient` installs: 1, `localStorage` last user: null. Compounded by query keys carrying no userId
    (`dashboardKeys.overview()` → `["dashboard","overview"]`) and no `queryClient.clear()` anywhere in the app.
  - Resolution: `fee4444` — keyed on the resolved identity, with `queryClient.clear()` on change. Two regression tests.

- [MAJOR] The cached `/dashboard` document carries the signed-in email, and sign-out never dropped it
  [apps/web/src/lib/offline/cache-db.ts:123]
  - Source: Edge
  - Evidence: `(cap)/dashboard/layout.tsx:35` passes `email` to `CapShell`, which is `"use client"`, so the address is
    serialised into the flight payload. Confirmed live: `containsEmail: true` on the 96 KB cached document. No figures
    leak — all three cap screens are client-rendered shells.
  - Resolution: `117577c` — `purgeOfflineCache` now drops `pekulo-shell-*` too.

- [MAJOR] `.env.bak-t16` sat untracked and un-gitignored with the service-role key, DB password and four API keys
  - Source: Spec + Code
  - Evidence: `git check-ignore -v .env.bak-t16` exited 1 — `.gitignore` covered `.env`, `.env.local`, `.env.*.local`,
    none of which match. One `git add .` from the history.
  - Resolution: `0d7b0cc` — `.env*` deny-by-default with explicit example negations. **The file itself is left on disk
    for its owner; anything it held should be treated as exposed.**

- [MAJOR] `?tab=patrimoine` and trailing slashes defeated the shell cache
  [apps/web/public/sw.js:48, apps/web/src/lib/offline/routes.ts:18]
  - Source: Edge
  - Evidence: the Cache API keys on the full URL; `cap-shell.tsx:180` pushes `/dashboard?tab=patrimoine`. Offline, a
    user who had only loaded `/dashboard` got a network-error page on tapping Patrimoine. The sw test's fake cache
    keyed on the full URL unconditionally, reproducing the bug instead of exposing it.
  - Resolution: `615fe0d` — normalised key + `ignoreSearch`, path normalisation in both copies of the route list, and
    the test fake now honours `ignoreSearch`. Confirmed live: `patrimoineTabResolvesToSameEntry: true`.

- [MAJOR] A purge failure stranded the user on an authenticated page after the session was already destroyed
  [sign-out-button.tsx:30, cache-db.ts:115]
  - Source: Code + Edge
  - Evidence: `try`/`finally` with no `catch`; `purgeCacheDb` was the only function in its module without a try/catch,
    and `deleteDB` had no `blocked` callback, so a second tab could stall it.
  - Resolution: `117577c` — exception-safe purge with a `blocked` handler, plus a `catch` at the call site.

- [MAJOR] A Supabase outage was indistinguishable from a sign-out, and purged a legitimate snapshot
  [offline-actions.ts:11]
  - Source: Lead + Code
  - Evidence: `getUser()` resolves `{ user: null }` with an `error` on a 5xx/rate-limit/network failure; the action
    discarded `error` and the caller treated `null` as "confirmed signed out". The "unreachable" test mocked a
    `reject()`, which is not the library's real contract (anti-pattern #3).
  - Resolution: `fee4444` — three states. The cookie decides sign-out (no network), `getClaims` verifies identity
    locally (lesson 2026-06-01), anything else throws and keeps the snapshot.

- [MINOR] The 60-minute ceiling was bypassed by a NaN, missing or future `savedAt` [query-persister.ts:53]
  - Source: Edge · Resolution: `e5f0e62` — the age is validated before it is compared.

- [MINOR] The banner froze its minute count and never applied the ceiling while a tab stayed open
  [offline-banner.tsx:67]
  - Source: Edge · Resolution: `e5f0e62` — ticks every 30 s, and past 60 minutes says the data is too old
    (`offline.expired`, fr + en). Confirmed live: the count advanced 0 min → 1 min in the browser.

- [MINOR] Paused mutations from every feature were dehydrated, contradicting the module's documented scope
  [use-offline-persistence.ts:73] — Source: Edge · Resolution: `fee4444` — `shouldDehydrateMutation: () => false`.

- [MINOR] `persistQueryClient`'s restore promise was discarded, leaving a latent unhandled rejection
  [use-offline-persistence.ts:69] — Source: Edge · Resolution: `fee4444`.

- [MINOR] A `cache.put` rejection discarded a good response, and the shell cache grew without bound
  [sw.js:45, sw.js:15] — Source: Edge · Resolution: `615fe0d` — put failures are absorbed; `activate` caps
  `/_next/static` entries. The cache name is a constant, so its sweep had never evicted anything.

- [MINOR] `crypto.subtle` absence failed silently, so the app behaved as if persistence worked
  [cache-crypto.ts:33] — Source: Edge · Resolution: `e5f0e62` — guarded, with a dev-only warning.

- [MINOR] Doc-sync gaps: `architecture.md:225` still pointed at the superseded ADR-0003; the epic-9 cache still
  described the ADR-0003 design verbatim; the File List omitted `scripts/dev-tunnel.sh` and misdescribed the
  `state.yaml` transition; `apps/web/CLAUDE.md` carried unrelated tool noise.
  - Source: Spec + Edge · Resolution: this commit; CLAUDE.md reverted.

- [MINOR] `offline-identity.ts` broke the `<feature>-actions.ts` convention (architecture.md §361-367)
  - Source: Code · Resolution: `fee4444` — renamed to `offline-actions.ts`.

- [HIGH] Opening the banner exposed a full-width WHITE band across the top of a dark app
  [apps/web/src/components/offline-banner.tsx:27]
  - Source: Aria (live pass). Found after the code findings were closed — no unit test or code read would have
    caught it, which is the whole argument for the live pass this story's lesson demands.
  - Evidence: `html` and `body` both compute to `rgba(0, 0, 0, 0)`; the only opaque surface is bento's `.shell`
    (`rgb(0,0,0)`). `body { padding-top: 62px }` slid it to `top: 62` and uncovered the browser's default canvas.
    Confirmed by the Lead: probing (720, 56) returned `BODY` with a fully transparent chain, and the band is plainly
    visible in a before screenshot. Seam contrast 21:1. Invisible in the light theme only because the canvas white
    happens to match.
  - Resolution: `ac6c786` — the injected stylesheet now paints `html`/`body` with `var(--background)` while the
    banner is open. Verified live: `htmlBg` and `bodyBg` both `rgb(0, 0, 0)`, band gone in the after screenshot.

- [MEDIUM] The 62px page offset was a constant measured against the one-line ENGLISH copy
  [apps/web/src/components/offline-banner.tsx:34]
  - Source: Aria (live pass)
  - Evidence: at 375 in **fr — the default locale** — the copy wraps to two lines, `{top: 12, height: 52, bottom: 64}`,
    crossing the header's top at 62. T16 measured in English and hardcoded for it.
  - Resolution: `ac6c786` — the offset is measured from the banner via a ref + `ResizeObserver`. Verified live with a
    forced wrap: banner 38 → 52px, offset 62 → 76px, header top 62 → 76, `overlap: false`.

- [LOW] In the light theme the banner's `--backgroundElevated` equals the page background, leaving a 12 %-alpha border
  (~1.3:1) as the only surface separation [apps/web/src/components/offline-banner.tsx:154]
  - Source: Aria · Resolution: `ac6c786` — border raised to 22 %, shadow softened (it was tuned for dark and vanished
    in light). Text contrast was never at risk: 16:1 dark, 19.8:1 light.

#### Dismissed

- [MEDIUM] Hypothesis (Lead): `cache.put` on the 307 redirect a signed-out visitor gets would poison the cache and
  serve them the previous user's `/dashboard` shell.
  - Rationale: investigated by the Edge auditor and it does **not** reproduce. Navigation requests carry redirect mode
    `manual`, so the redirect arrives as an opaque-redirect filtered response — `status 0`, `ok === false` — and the
    `response.ok` guard at `sw.js:45` short-circuits before `cache.put`. Confirmed live: the cached document has
    `redirected: false`, `status: 200`. The guard is load-bearing and now carries a comment saying so.

- [LOW] `Math.round` renders anything under 30 s as "0 min" (Aria).
  - Rationale: "data from 0 min ago" is an accurate statement about data seconds old, and the alternative — a
    "just now" special case — adds a fourth copy string per locale for no gain in truthfulness.

- [MEDIUM] Aria also reported that the age never ticks and that a long-lived tab renders "1500 min" unbounded.
  - Rationale: both were real against the code she audited, and both were already fixed in `e5f0e62` before her
    report landed — the banner now ticks every 30 s and switches to `offline.expired` past the 60-minute ceiling.
    Re-verified live: the count advanced 0 min → 1 min in the browser.

- **Out of scope, recorded for triage:** `bento-module__headerRight` overflows horizontally at 375px
  (`scrollWidth` 417 vs `clientWidth` 375), which stretches every `left:0/right:0` fixed element past the visible
  edge — the mobile bottom nav, 9-1's install banner and this banner alike. Pre-existing in the cap shell, not
  caused by 9-2. Deserves its own ticket.

### Verification

- Typecheck: `bun --filter='@pekulo/web' run typecheck` → **exit 0**
- Lint: `bunx oxlint src` → **0 errors**, 2 warnings, both pre-existing and outside this story
- Test command: `bun run test` (apps/web) → **110 files / 362 tests passed** (349 before review; 13 regression tests added)
- Build: `bun run build` → **exit 0**
- Visual verification: **performed live and independently twice** — by Aria and, after her findings landed, by the
  Lead re-verifying each fix. Both against `https://pekulo-dev.trafijs.com` (real HTTPS origin), signed in, via
  Chrome DevTools MCP. **React Grab MCP was unavailable**: `get_element_context` replays a selection a *human* makes
  in the overlay, so an agent cannot drive it. Computed styles and `getBoundingClientRect` were used instead —
  strictly more precise than a visual read.
  - **AC-6 typography — the 9-1 defect class did NOT recur.** Banner, both text children and the app's own
    `is_Text` spans all resolve `font-family: Geist, ui-sans-serif, …`; `--f-family` resolves non-empty on the
    banner. The negative controls make it meaningful: `--f-family` is **empty** at `:root` and
    `getComputedStyle(document.body).fontFamily` computes to **`"Times"`** — the serif fallback is live on the page,
    and `font_body` is the only thing standing between this banner and a repeat of 9-1.
  - Contrast: dark 16:1, light 19.8:1. a11y: `role=status`, `aria-live=polite`, localised `aria-label`, icon
    `aria-hidden`. Interpolation real in fr and en at 0/1/2/7/59/65/1500 min; `dataUpdatedAt === 0` falls back to
    `offline.title`. Stacking clean with 9-1's install prompt — both rendered simultaneously, no overlap.
  - Geometry re-verified after the fixes at 1440 and 400: banner 12→50, header 62→138, gap exactly 12px,
    **0 of 6 header controls covered**, no horizontal overflow.
  - Service Worker (production run): registered, **activated**, scope `/`, controlling the page; cached the
    `/dashboard` document (96 KB, complete, `redirected: false`) under the normalised key plus 22 static chunks, all
    22 referenced by that document. `?tab=patrimoine` resolves to the same entry. `/sw.js` served
    `no-cache, no-store, must-revalidate`. The cached document **does contain the signed-in email**, confirming the
    shell-purge finding on evidence.
- **Residual verification gap — AC-1 offline reload and AC-5 end-to-end.** CDP network emulation is reset by every
  navigation the MCP driver performs, so the browser could not be held offline across a reload; an in-page
  `location.reload()` under emulation hit the same reset. Offline blocking itself was confirmed (`navigator.onLine`
  false, `fetch` rejected). The SW routing these ACs depend on is covered by 13 unit tests driving the real `sw.js`,
  including the offline-fallback and non-GET-passthrough paths, but neither AC has been observed end-to-end in a
  browser. **Worth one manual pass before this ships beyond personal use.**
- Also not verified live, and deliberately not forced: the **fr** banner catalogue and the **light** theme. Both are
  pinned by a server-side user preference (story 8-2) that rewrites the `NEXT_LOCALE` cookie and holds
  `data-theme="pekulo-dark"`; changing them means writing to the account's settings. Both are covered by unit tests
  rendering the real `fr.json`/`en.json`, and the Edge auditor confirmed all three `offline.*` keys exist in both
  catalogues with the `{minutes}` placeholder intact.

### Ticket sync

- Ticket comment posted: see below
- PR opened/updated: see below
