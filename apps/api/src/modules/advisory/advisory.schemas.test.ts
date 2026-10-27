// AC-4 / AC-8 (verbatim from story 12-1-advisory-access-gate):
//   AC-4 (re-grant restores access) — Given a user whose row is banned, When the
//   owner calls grant for that user, Then the row becomes active, banned_at is
//   cleared, and the user's next request succeeds.
//   AC-8 (owner operations) — Given an owner configured in the environment, When
//   they call status, list, grant or ban, Then the calls succeed; an active non-owner
//   calling list, grant or ban gets 403; granting or banning an owner returns 400
//   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
//   the owner from the JWT, never a client-supplied value.
//
// Test runner: bun:test (apps/api convention per lesson 2026-05-07). The
// validators package itself does not ship a test runner — we consume the
// schemas here and assert their parse behaviour where bun:test is wired.

import { describe, expect, test } from "bun:test";
import {
  ADVISORY_ACCESS_STATES,
  advisoryAccessEntrySchema,
  advisoryAccessListSchema,
  advisoryAccessStateSchema,
  advisoryAccessStatusSchema,
  advisoryStatusSchema,
  advisoryTargetInputSchema,
} from "@pekulo/validators";

const VALID_UUID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("advisory schemas", () => {
  test("ADVISORY_ACCESS_STATES contains active, banned, none", () => {
    expect(ADVISORY_ACCESS_STATES).toEqual(["active", "banned", "none"]);
  });

  test("advisoryAccessStateSchema accepts valid states and rejects others", () => {
    expect(advisoryAccessStateSchema.safeParse("active").success).toBe(true);
    expect(advisoryAccessStateSchema.safeParse("banned").success).toBe(true);
    expect(advisoryAccessStateSchema.safeParse("none").success).toBe(true);
    expect(advisoryAccessStateSchema.safeParse("other").success).toBe(false);
  });

  test("advisoryAccessStatusSchema accepts active and banned only", () => {
    expect(advisoryAccessStatusSchema.safeParse("active").success).toBe(true);
    expect(advisoryAccessStatusSchema.safeParse("banned").success).toBe(true);
    expect(advisoryAccessStatusSchema.safeParse("none").success).toBe(false);
  });

  test("advisoryTargetInputSchema validates userId as UUID", () => {
    expect(advisoryTargetInputSchema.safeParse({ userId: VALID_UUID }).success).toBe(true);
    expect(advisoryTargetInputSchema.safeParse({ userId: "invalid-uuid" }).success).toBe(false);
  });

  test("advisoryAccessEntrySchema validates wire entry shape", () => {
    const validEntry = {
      userId: VALID_UUID,
      status: "active",
      grantedBy: VALID_UUID,
      grantedAt: "2026-10-27T10:00:00.000Z",
      bannedAt: null,
      updatedAt: "2026-10-27T10:00:00.000Z",
    };
    expect(advisoryAccessEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  test("advisoryStatusSchema validates status shape", () => {
    expect(advisoryStatusSchema.safeParse({ access: "active", owner: true }).success).toBe(true);
    expect(advisoryStatusSchema.safeParse({ access: "none", owner: false }).success).toBe(true);
  });

  test("advisoryAccessListSchema validates array of entries", () => {
    expect(advisoryAccessListSchema.safeParse([]).success).toBe(true);
  });
});
