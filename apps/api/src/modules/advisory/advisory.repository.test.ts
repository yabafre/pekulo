// AC-3 + AC-4 (verbatim from story 12-1-advisory-access-gate):
//   AC-3 (ban is effective on the next request) — Given an allowlisted active user,
//   When the owner bans them, Then that user's next request — same token, no
//   re-login — is rejected with 403, because the gate re-reads the row on every
//   request and nothing caches the decision.
//   AC-4 (re-grant restores access) — Given a user whose row is banned, When the
//   owner calls grant for that user, Then the row becomes active, banned_at is
//   cleared, and the user's next request succeeds.
//
// bun:test — advisory repository. Uses a mock Prisma client to assert the
// query shapes and the upsert payloads. There is no Postgres test harness in
// this repo; RLS coverage is asserted by the live db:rls-audit probe.
import { describe, expect, mock, test } from "bun:test";
import type { ExtendedPrismaClient } from "../../database";
import { createAdvisoryRepository } from "./advisory.repository";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROW = {
  userId: USER,
  status: "active" as const,
  grantedBy: OWNER,
  grantedAt: new Date("2026-10-27T10:00:00.000Z"),
  bannedAt: null,
  updatedAt: new Date("2026-10-27T10:00:00.000Z"),
};

function makeClient() {
  const findUnique = mock(async (_args: unknown) => ROW);
  const findMany = mock(async (_args: unknown) => [ROW]);
  const upsert = mock(async (_args: unknown) => ROW);
  const client = {
    advisoryAccess: { findUnique, findMany, upsert },
  } as unknown as ExtendedPrismaClient;
  return { client, findUnique, findMany, upsert };
}

describe("createAdvisoryRepository", () => {
  test("getAccessStatus reads the row with where: { userId }", async () => {
    const { client, findUnique } = makeClient();
    const repo = createAdvisoryRepository({ client });
    expect(await repo.getAccessStatus(USER)).toBe("active");
    const args = findUnique.mock.calls[0]![0] as { where: { userId: string } };
    expect(args.where.userId).toBe(USER);
  });

  test("getEntry maps every Date to an ISO string", async () => {
    const { client } = makeClient();
    const repo = createAdvisoryRepository({ client });
    expect(await repo.getEntry(USER)).toEqual({
      userId: USER,
      status: "active",
      grantedBy: OWNER,
      grantedAt: "2026-10-27T10:00:00.000Z",
      bannedAt: null,
      updatedAt: "2026-10-27T10:00:00.000Z",
    });
  });

  test("list maps every row (owner-only caller is asserted upstream)", async () => {
    const { client } = makeClient();
    const repo = createAdvisoryRepository({ client });
    const rows = await repo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(USER);
  });

  test("grant upserts active and clears banned_at", async () => {
    const { client, upsert } = makeClient();
    const repo = createAdvisoryRepository({ client });
    await repo.grant(USER, OWNER);
    const args = upsert.mock.calls[0]![0] as {
      update: { status: string; grantedBy: string; grantedAt: Date; bannedAt: null };
      create: { userId: string; status: string; grantedBy: string; grantedAt: Date };
    };
    expect(args.update.status).toBe("active");
    expect(args.update.grantedBy).toBe(OWNER);
    expect(args.update.bannedAt).toBeNull();
    expect(args.update.grantedAt).toBeInstanceOf(Date);
    expect(args.create.userId).toBe(USER);
    expect(args.create.status).toBe("active");
  });

  test("ban upserts banned and stamps banned_at", async () => {
    const { client, upsert } = makeClient();
    const repo = createAdvisoryRepository({ client });
    await repo.ban(USER);
    const args = upsert.mock.calls[0]![0] as {
      update: { status: string; bannedAt: Date };
      create: { userId: string; status: string; bannedAt: Date };
    };
    expect(args.update.status).toBe("banned");
    expect(args.update.bannedAt).toBeInstanceOf(Date);
    expect(args.create.userId).toBe(USER);
    expect(args.create.status).toBe("banned");
  });
});
