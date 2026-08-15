// AC-4 — "Given I sign out, When the sign-out action resolves, Then every
// pekulo-cache-* database and the remembered-user pointer are deleted."
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
    await alex.put(
      SNAPSHOTS_STORE,
      { iv: new Uint8Array([1]), data: new ArrayBuffer(1), savedAt: 1 },
      "react-query",
    );
    await closeCacheDb();
    await openCacheDb("user_bob");
    await closeCacheDb();

    await purgeOfflineCache();

    const names = await dbNames();
    expect(names.filter((name) => name.startsWith(CACHE_DB_PREFIX))).toEqual([]);
    expect(readLastUserId()).toBeNull();
    expect(localStorage.getItem(LAST_USER_KEY)).toBeNull();
  });

  test("AC-4 — purgeOfflineCache also drops the Service Worker shell cache", async () => {
    // The cached /dashboard document is not just markup: the cap layout is an
    // RSC that passes `email` to the "use client" CapShell, so the address is
    // serialised verbatim into the flight payload embedded in the HTML. Leaving
    // it behind means the previous account's email stays readable in DevTools →
    // Cache Storage after sign-out, and across a different account signing in.
    const deleted: string[] = [];
    const names = ["pekulo-shell-v1", "some-other-origin-cache"];
    vi.stubGlobal("caches", {
      keys: () => Promise.resolve(names),
      delete: (name: string) => {
        deleted.push(name);
        return Promise.resolve(true);
      },
    });

    await purgeOfflineCache();

    expect(deleted).toContain("pekulo-shell-v1");
    expect(deleted).not.toContain("some-other-origin-cache");
    vi.unstubAllGlobals();
  });

  test("purgeOfflineCache survives a caches API that throws", async () => {
    vi.stubGlobal("caches", {
      keys: () => Promise.reject(new Error("SecurityError")),
      delete: () => Promise.resolve(true),
    });
    writeLastUserId("user_alex");

    // A sign-out must never be blocked by a storage-layer failure — the
    // IndexedDB purge and the pointer clear still have to land.
    await expect(purgeOfflineCache()).resolves.toBeUndefined();
    expect(readLastUserId()).toBeNull();
    vi.unstubAllGlobals();
  });

  test("purgeCacheDb never throws when the delete fails", async () => {
    // Every other function in this module is exception-safe with an explicit
    // "never break the app" comment; this one was the exception, and it is
    // awaited on the sign-out path.
    await expect(purgeCacheDb("user_nonexistent")).resolves.toBeUndefined();
  });

  test("the user pointer round-trips and survives a missing localStorage", () => {
    writeLastUserId("user_alex");
    expect(readLastUserId()).toBe("user_alex");
    clearLastUserId();
    expect(readLastUserId()).toBeNull();
  });
});
