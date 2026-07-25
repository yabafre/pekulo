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

import {
  SNAPSHOTS_STORE,
  closeCacheDb,
  openCacheDb,
  readLastUserId,
  writeLastUserId,
} from "@/lib/offline/cache-db";
import { SignOutButton } from "./sign-out-button";

beforeEach(async () => {
  vi.clearAllMocks();
  writeLastUserId("user_alex");
  const db = await openCacheDb("user_alex");
  await db.put(
    SNAPSHOTS_STORE,
    { iv: new Uint8Array([1]), data: new ArrayBuffer(2), savedAt: 1 },
    "react-query",
  );
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

  test("a purge failure still lands the user on /login", async () => {
    // The server session is already destroyed by the time the purge runs, so an
    // exception here left the user sitting on the authenticated page — signed
    // out without knowing it, with no navigation and no toast (React does not
    // catch async rejections from event handlers).
    signOut.mockResolvedValue({ ok: true });
    const boom = vi
      .spyOn(indexedDB, "databases")
      .mockRejectedValue(new Error("SecurityError: private mode"));

    renderWithTamagui(<SignOutButton />);
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/login");
    });
    boom.mockRestore();
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
