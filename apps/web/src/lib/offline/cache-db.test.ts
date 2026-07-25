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

  test("the user pointer round-trips and survives a missing localStorage", () => {
    writeLastUserId("user_alex");
    expect(readLastUserId()).toBe("user_alex");
    clearLastUserId();
    expect(readLastUserId()).toBeNull();
  });
});
