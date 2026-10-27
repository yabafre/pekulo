// AC-2, AC-3, AC-4, AC-8 (verbatim from story 12-1-advisory-access-gate):
//   AC-2 (active allowlisted caller proceeds) — Given a signed-in user whose
//   advisory_access row is active, When they call a gated advisory procedure,
//   Then the gate resolves and the handler runs with the userId taken from the
//   verified JWT.
//   AC-3 (ban is effective on the next request) — Given an allowlisted active user,
//   When the owner bans them, Then that user's next request — same token, no
//   re-login — is rejected with 403, because the gate re-reads the row on every
//   request and nothing caches the decision.
//   AC-4 (re-grant restores access) — Given a user whose row is banned, When the
//   owner calls grant for that user, Then the row becomes active, banned_at is
//   cleared, and the user's next request succeeds.
//   AC-8 (owner operations) — Given an owner configured in the environment, When
//   they call status, list, grant or ban, Then the calls succeed; an active non-owner
//   calling list, grant or ban gets 403; granting or banning an owner returns 400
//   BAD_REQUEST; the owner is implicitly allowed without a record; and granted_by is
//   the owner from the JWT, never a client-supplied value.

import { describe, expect, test } from "bun:test";
import type { AdvisoryAccessEntry } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import type { AdvisoryAccessRepository } from "./advisory.repository";
import { createAdvisoryService } from "./advisory.service";

const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MEMBER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BANNED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function entry(userId: string, status: "active" | "banned"): AdvisoryAccessEntry {
  return {
    userId,
    status,
    grantedBy: OWNER,
    grantedAt: "2026-10-27T10:00:00.000Z",
    bannedAt: status === "banned" ? "2026-10-27T11:00:00.000Z" : null,
    updatedAt: "2026-10-27T11:00:00.000Z",
  };
}

function fakeRepository(rows: Map<string, AdvisoryAccessEntry>) {
  const calls: string[] = [];
  const repository: AdvisoryAccessRepository = {
    async getAccessStatus(userId) {
      calls.push(`status:${userId}`);
      return rows.get(userId)?.status ?? null;
    },
    async getEntry(userId) {
      calls.push(`entry:${userId}`);
      return rows.get(userId) ?? null;
    },
    async list() {
      calls.push("list");
      return [...rows.values()];
    },
    async grant(userId, grantedBy) {
      calls.push(`grant:${userId}:${grantedBy}`);
      const next = entry(userId, "active");
      rows.set(userId, next);
      return next;
    },
    async ban(userId) {
      calls.push(`ban:${userId}`);
      const next = entry(userId, "banned");
      rows.set(userId, next);
      return next;
    },
  };
  return { repository, calls };
}

function serviceWith(rows: Map<string, AdvisoryAccessEntry>) {
  const { repository, calls } = fakeRepository(rows);
  const service = createAdvisoryService({
    repository,
    ownerUserIds: new Set([OWNER]),
  });
  return { service, calls };
}

describe("createAdvisoryService", () => {
  test("AC-1 — a non-owner with no row is FORBIDDEN", async () => {
    const { service } = serviceWith(new Map());
    const error = await service.assertAllowed(MEMBER).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(PekuloError);
    expect((error as PekuloError).code).toBe("FORBIDDEN");
  });

  test("AC-2 — an active non-owner is allowed", async () => {
    const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
    await expect(service.assertAllowed(MEMBER)).resolves.toBeUndefined();
  });

  test("AC-3 — a banned non-owner is FORBIDDEN", async () => {
    const { service } = serviceWith(new Map([[BANNED, entry(BANNED, "banned")]]));
    const error = await service.assertAllowed(BANNED).catch((reason: unknown) => reason);
    expect((error as PekuloError).code).toBe("FORBIDDEN");
  });

  test("AC-8 — an owner is allowed without a row and never read", async () => {
    const { service, calls } = serviceWith(new Map());
    await expect(service.assertAllowed(OWNER)).resolves.toBeUndefined();
    expect(calls).toEqual([]);
    expect(await service.getStatus(OWNER)).toEqual({ access: "active", owner: true });
  });

  test("AC-8 — status reports the stored state, and none when no row exists", async () => {
    const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
    expect(await service.getStatus(MEMBER)).toEqual({ access: "active", owner: false });
    expect(await service.getStatus("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toEqual({
      access: "none",
      owner: false,
    });
  });

  test("AC-8 — a non-owner cannot list, grant or ban", async () => {
    const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
    for (const action of [
      () => service.list(MEMBER),
      () => service.grant(MEMBER, BANNED),
      () => service.ban(MEMBER, BANNED),
    ]) {
      const error = await action().catch((reason: unknown) => reason);
      expect((error as PekuloError).code).toBe("FORBIDDEN");
    }
  });

  test("AC-8 — the owner grants with their own id as granted_by", async () => {
    const { service, calls } = serviceWith(new Map());
    const result = await service.grant(OWNER, MEMBER);
    expect(result.userId).toBe(MEMBER);
    expect(result.status).toBe("active");
    expect(calls).toContain(`grant:${MEMBER}:${OWNER}`);
  });

  test("AC-8 — an owner cannot be granted or banned", async () => {
    const { service } = serviceWith(new Map());
    const grant = await service.grant(OWNER, OWNER).catch((reason: unknown) => reason);
    const ban = await service.ban(OWNER, OWNER).catch((reason: unknown) => reason);
    expect((grant as PekuloError).code).toBe("BAD_REQUEST");
    expect((ban as PekuloError).code).toBe("BAD_REQUEST");
  });

  test("AC-4 — a grant clears the ban state", async () => {
    const rows = new Map([[BANNED, entry(BANNED, "banned")]]);
    const { service } = serviceWith(rows);
    const result = await service.grant(OWNER, BANNED);
    expect(result.status).toBe("active");
    expect(rows.get(BANNED)?.status).toBe("active");
  });
});
