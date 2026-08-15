// AC-4 — identity reconciliation: purge on sign-out, purge the previous user on
// identity change, and NEVER purge merely because the server was unreachable.
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test, vi } from "vitest";

// vi.mock factories are hoisted — the mock fn must come from vi.hoisted
// (lesson 2026-05-20), otherwise the reference is not yet initialised.
const { getOfflineIdentity } = vi.hoisted(() => ({ getOfflineIdentity: vi.fn() }));
vi.mock("@/app/(cap)/_actions/offline-actions", () => ({ getOfflineIdentity }));

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn(() => "/dashboard") }));
vi.mock("next/navigation", () => ({ usePathname }));

const { persistQueryClient } = vi.hoisted(() => ({ persistQueryClient: vi.fn() }));
vi.mock("@tanstack/react-query-persist-client", () => ({ persistQueryClient }));

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import {
  SNAPSHOTS_STORE,
  closeCacheDb,
  openCacheDb,
  purgeOfflineCache,
  readLastUserId,
  writeLastUserId,
} from "./cache-db";
import { resolveOfflineUserId, useOfflinePersistence } from "./use-offline-persistence";

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
  usePathname.mockReturnValue("/dashboard");
  persistQueryClient.mockReturnValue([vi.fn(), Promise.resolve()]);
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

describe("useOfflinePersistence (story 9-2)", () => {
  test("installs the persister when an identity is known at mount", async () => {
    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    const client = new QueryClient();

    renderHook(() => useOfflinePersistence(client));

    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));
  });

  test("AC-1 — signing in installs the persister without a full page reload", async () => {
    // The provider mounts in the ROOT layout, so its first run happens on
    // /login while signed out. Sign-in is a client-side router.push: nothing
    // remounts. Before this retry existed the cache stayed empty for the whole
    // session, and a user who then lost connectivity had no snapshot at all.
    getOfflineIdentity.mockResolvedValue(null);
    usePathname.mockReturnValue("/login");
    const client = new QueryClient();

    const { rerender } = renderHook(() => useOfflinePersistence(client));
    await waitFor(() => expect(getOfflineIdentity).toHaveBeenCalledTimes(1));
    expect(persistQueryClient).not.toHaveBeenCalled();

    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    usePathname.mockReturnValue("/dashboard");
    rerender();

    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));
  });

  test("navigating again never re-installs (a second restore would clobber fresh data)", async () => {
    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    const client = new QueryClient();

    const { rerender } = renderHook(() => useOfflinePersistence(client));
    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));

    usePathname.mockReturnValue("/dashboard/portefeuille");
    rerender();
    usePathname.mockReturnValue("/dashboard/immobilier");
    rerender();

    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));
  });

  test("AC-4 — a different account signing in on the same tab rebinds the persister", async () => {
    // The regression this guards: `Providers` lives in the ROOT layout and both
    // sign-out and sign-in are client-side `router.push`es, so it never
    // unmounts. Keyed on a mount-only ref, identity was resolved exactly ONCE
    // per tab — so after Alex signed out and Bob signed in, the persister was
    // still bound to `pekulo-cache-<alex>` and Bob's balances were encrypted
    // into Alex's database (AC-4, NFR-8).
    const unsubscribeAlex = vi.fn();
    persistQueryClient.mockReturnValueOnce([unsubscribeAlex, Promise.resolve()]);
    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    const client = new QueryClient();

    const { rerender } = renderHook(() => useOfflinePersistence(client));
    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));

    // Alex signs out: SignOutButton purges, then router.push("/login").
    await purgeOfflineCache();
    getOfflineIdentity.mockResolvedValue(null);
    usePathname.mockReturnValue("/login");
    rerender();
    await waitFor(() => expect(unsubscribeAlex).toHaveBeenCalledTimes(1));

    // Bob signs in on the same tab: router.push("/dashboard").
    persistQueryClient.mockReturnValue([vi.fn(), Promise.resolve()]);
    getOfflineIdentity.mockResolvedValue({ userId: "user_bob" });
    usePathname.mockReturnValue("/dashboard");
    rerender();

    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(2));
    expect(readLastUserId()).toBe("user_bob");
  });

  test("AC-4 — switching identity drops the previous account's in-memory cache", async () => {
    // The query keys carry no userId (`dashboardKeys.overview()` is just
    // ["dashboard","overview"]) and nothing else in the app clears the client,
    // so without this the incoming user reads the previous one's figures
    // straight off the shared QueryClient until a refetch lands.
    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    const client = new QueryClient();
    client.setQueryData(["dashboard", "overview"], { totalWealthEur: 123_456 });

    const { rerender } = renderHook(() => useOfflinePersistence(client));
    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));
    expect(client.getQueryData(["dashboard", "overview"])).toBeDefined();

    getOfflineIdentity.mockResolvedValue({ userId: "user_bob" });
    usePathname.mockReturnValue("/dashboard/portefeuille");
    rerender();

    await waitFor(() => expect(client.getQueryData(["dashboard", "overview"])).toBeUndefined());
  });

  test("unmounting releases the subscription", async () => {
    const unsubscribe = vi.fn();
    persistQueryClient.mockReturnValue([unsubscribe, Promise.resolve()]);
    getOfflineIdentity.mockResolvedValue({ userId: "user_alex" });
    const client = new QueryClient();

    const { unmount } = renderHook(() => useOfflinePersistence(client));
    await waitFor(() => expect(persistQueryClient).toHaveBeenCalledTimes(1));

    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
