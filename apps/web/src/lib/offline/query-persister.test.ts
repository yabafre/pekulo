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
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms;
    },
  };
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
    const query = restored?.clientState.queries[0];
    expect(query?.queryKey).toEqual(["dashboard", "overview"]);
    expect((query?.state.data as { netWorth: number } | undefined)?.netWorth).toBe(128_400.5);
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

  test("AC-3 — a snapshot with an unusable savedAt is discarded, not served", async () => {
    // `now() - NaN > MAX` is false, and so is a negative difference, so both a
    // corrupt stamp and a clock that moved backwards (NTP correction, manual
    // change, DST-adjacent) slipped straight past the ceiling and served
    // arbitrarily old figures with no limit at all.
    for (const savedAt of [Number.NaN, 5_000_000_000_000]) {
      const c = clock(1_000_000);
      const persister = createEncryptedPersister(USER, c.now);
      await persister.persistClient(snapshot(c.now()));

      const db = await openCacheDb(USER);
      const row = await db.get(SNAPSHOTS_STORE, SNAPSHOT_ID);
      if (!row) throw new Error("the snapshot under test was not written");
      await db.put(SNAPSHOTS_STORE, { ...row, savedAt }, SNAPSHOT_ID);

      expect(await persister.restoreClient()).toBeUndefined();
    }
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
