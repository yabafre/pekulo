// Story 11-2 (FR-50). The port contract, proved against a fake admin API.
// The real @supabase/supabase-js client is never constructed here — the
// factory takes the deleteUser callable, so the test drives the branch
// logic without a network or a key.
//
// AC-2 (verbatim from story 11-2-account-deletion:15):
//   Given the deletion completed, When the user attempts to sign in with the
//   same credentials, Then Supabase rejects the attempt.
import { describe, expect, test } from "bun:test";
import { createAuthAdmin } from "./supabase-admin";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("createAuthAdmin", () => {
  test("resolves when the admin API reports no error", async () => {
    const calls: string[] = [];
    const admin = createAuthAdmin({
      deleteUser: async (userId) => {
        calls.push(userId);
        return { error: null };
      },
    });
    await admin.deleteUser(USER_A);
    expect(calls).toEqual([USER_A]);
  });

  test("throws when the admin API reports an error", async () => {
    const admin = createAuthAdmin({
      deleteUser: async () => ({ error: { message: "user not allowed" } }),
    });
    expect(admin.deleteUser(USER_A)).rejects.toThrow("user not allowed");
  });

  // aped-review 11-2: a second confirmation from another tab (JWT still valid,
  // data already gone) reaches the identity step for a user Supabase no longer
  // has. "Already gone" is the end state, not a failure — same posture as the
  // Bridge client admitting a 404 on deleteUser.
  test("treats a 404 / user_not_found answer as success (idempotent)", async () => {
    const byStatus = createAuthAdmin({
      deleteUser: async () => ({ error: { message: "User not found", status: 404 } }),
    });
    await expect(byStatus.deleteUser(USER_A)).resolves.toBeUndefined();
    const byCode = createAuthAdmin({
      deleteUser: async () => ({ error: { message: "User not found", code: "user_not_found" } }),
    });
    await expect(byCode.deleteUser(USER_A)).resolves.toBeUndefined();
  });

  test("still throws on any other error status", async () => {
    const admin = createAuthAdmin({
      deleteUser: async () => ({ error: { message: "service unavailable", status: 503 } }),
    });
    expect(admin.deleteUser(USER_A)).rejects.toThrow("service unavailable");
  });

  test("never puts the user id in the thrown message", async () => {
    // The message travels into logs and, via the error mapper, toward the
    // client. The id is already in the structured log line the service
    // writes; repeating it in free text is retention with no purpose.
    const admin = createAuthAdmin({
      deleteUser: async () => ({ error: { message: "boom" } }),
    });
    expect(admin.deleteUser(USER_A)).rejects.not.toThrow(USER_A);
  });
});
