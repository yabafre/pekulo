// AC-4 — identity reconciliation: purge on sign-out, purge the previous user on
// identity change, and NEVER purge merely because the server was unreachable.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock factories are hoisted — the mock fn must come from vi.hoisted
// (lesson 2026-05-20), otherwise the reference is not yet initialised.
const { getOfflineIdentity } = vi.hoisted(() => ({ getOfflineIdentity: vi.fn() }));
vi.mock("@/app/(cap)/_actions/offline-identity", () => ({ getOfflineIdentity }));

import {
  SNAPSHOTS_STORE,
  closeCacheDb,
  openCacheDb,
  purgeOfflineCache,
  readLastUserId,
  writeLastUserId,
} from "./cache-db";
import { resolveOfflineUserId } from "./use-offline-persistence";

async function seed(userId: string): Promise<void> {
  const db = await openCacheDb(userId);
  await db.put(
    SNAPSHOTS_STORE,
    { iv: new Uint8Array([1]), data: new ArrayBuffer(2), savedAt: 1 },
    "react-query",
  );
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
