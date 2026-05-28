// T14 — bank-aggregator.repository unit tests (story 5-6 + post-review).
//
// Scope note: the heavy "real Postgres + Vault + RLS round-trip" path lives in
// the integration test layer (bank-aggregator.integration.test.ts uses an
// in-memory fake against the SERVICE — the real-DB harness is a separate
// follow-up under aped-qa). This file covers the DTO-stripping invariant and
// the findOwnersByProviderItemId cross-user shape that the webhook handler
// depends on (ADR-0013 defense-in-depth). The PrismaClient is mocked at the
// model level — we assert on the Prisma calls the repository makes.

import { test, expect, mock } from "bun:test";
import type { PrismaService } from "../../database";
import { createBankAggregatorRepository } from "./bank-aggregator.repository";

interface BankConnectionRow {
  id: string;
  userId: string;
  provider: string;
  providerItemId: string;
  accessTokenSecretId: string | null;
  refreshTokenSecretId: string | null;
  status: string;
  displayName: string | null;
  lastRefreshedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeRow(over: Partial<BankConnectionRow> = {}): BankConnectionRow {
  return {
    id: "bnk_1",
    userId: "u_a",
    provider: "bridge",
    providerItemId: "item-42",
    // Bridge v3 stateful-widget: Vault secret IDs stay NULL — the columns are
    // vestigial until the V1.5 DROP COLUMN migration. Asserting the DTO mapper
    // strips them protects against a future surface that re-introduces tokens.
    accessTokenSecretId: null,
    refreshTokenSecretId: null,
    status: "active",
    displayName: "Société Générale",
    lastRefreshedAt: new Date("2026-05-27T10:00:00Z"),
    createdAt: new Date("2026-05-27T09:00:00Z"),
    updatedAt: new Date("2026-05-27T10:00:00Z"),
    ...over,
  };
}

function makeFakePrisma(client: Partial<PrismaService["client"]> = {}): PrismaService {
  return { client } as unknown as PrismaService;
}

test("createConnection persists row and toDto strips secret-bearing columns (AC-4)", async () => {
  const created = makeRow({ id: "bnk_created", userId: "u_a" });
  const create = mock(async () => created);
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: { create } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const dto = await repo.createConnection({
    userId: "u_a",
    provider: "bridge",
    providerItemId: "item-42",
    displayName: "Société Générale",
  });
  expect(dto.id).toBe("bnk_created");
  expect(dto.userId).toBe("u_a");
  expect(dto.provider).toBe("bridge");
  expect(dto.providerItemId).toBe("item-42");
  expect(dto.status).toBe("active");
  expect(dto.displayName).toBe("Société Générale");
  // The 8-key DTO contract — adding a key here means a key landed on the wire
  // that AC-4 forbids. Type-level guard in security.test.ts is the compile-time
  // sibling; this is the runtime sibling.
  expect(Object.keys(dto).sort()).toEqual(
    [
      "createdAt",
      "displayName",
      "id",
      "lastRefreshedAt",
      "provider",
      "providerItemId",
      "status",
      "userId",
    ].sort(),
  );
});

test("listByUser sorts desc by createdAt and strips secret columns from every row", async () => {
  const olderFirst = [
    makeRow({ id: "bnk_old", createdAt: new Date("2026-05-26T08:00:00Z") }),
    makeRow({ id: "bnk_new", createdAt: new Date("2026-05-27T08:00:00Z") }),
  ];
  const findMany = mock(
    async (args: { where: { userId: string }; orderBy: { createdAt: string } }) => {
      const ordered =
        args.orderBy.createdAt === "desc" ? [olderFirst[1], olderFirst[0]] : olderFirst;
      return ordered;
    },
  );
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: { findMany } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const rows = await repo.listByUser("u_a");
  expect(rows).toHaveLength(2);
  for (const r of rows) {
    expect(Object.keys(r)).not.toContain("accessTokenSecretId");
    expect(Object.keys(r)).not.toContain("refreshTokenSecretId");
  }
});

test("findOwnersByProviderItemId scopes by (provider, providerItemId) and returns userId+connectionId tuples (webhook lookup)", async () => {
  const findMany = mock(async (args: { where: { provider: string; providerItemId: string } }) => {
    if (args.where.provider === "bridge" && args.where.providerItemId === "item-42") {
      return [
        { id: "bnk_a", userId: "u_a" },
        { id: "bnk_b", userId: "u_b" },
      ];
    }
    return [];
  });
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: { findMany } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const owners = await repo.findOwnersByProviderItemId("bridge", "item-42");
  expect(owners).toEqual([
    { userId: "u_a", connectionId: "bnk_a" },
    { userId: "u_b", connectionId: "bnk_b" },
  ]);
  const empty = await repo.findOwnersByProviderItemId("bridge", "unknown");
  expect(empty).toEqual([]);
});

test("setStatus + setLastRefreshedAt both scope updateMany on { id, userId } (ADR-0013 defense-in-depth)", async () => {
  const captured: Array<{ where: unknown; data: unknown }> = [];
  const updateMany = mock(async (args: { where: unknown; data: unknown }) => {
    captured.push(args);
    return { count: 1 };
  });
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: { updateMany } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  await repo.setStatus("u_a", "bnk_1", "sca_required");
  await repo.setLastRefreshedAt("u_a", "bnk_1", new Date("2026-05-27T10:00:00Z"));
  expect(captured).toHaveLength(2);
  expect(captured[0]?.where).toEqual({ id: "bnk_1", userId: "u_a" });
  expect(captured[0]?.data).toEqual({ status: "sca_required" });
  expect(captured[1]?.where).toEqual({ id: "bnk_1", userId: "u_a" });
});

test("findProviderUserUuid + persistProviderUserUuid round-trip through bridge_users table", async () => {
  let stored: { userId: string; bridgeUserUuid: string } | null = null;
  const findUnique = mock(async () => (stored ? { bridgeUserUuid: stored.bridgeUserUuid } : null));
  const create = mock(async ({ data }: { data: { userId: string; bridgeUserUuid: string } }) => {
    stored = data;
    return data;
  });
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bridgeUser: { findUnique, create } as unknown as PrismaService["client"]["bridgeUser"],
    }),
  });
  expect(await repo.findProviderUserUuid("u_a", "bridge")).toBeNull();
  await repo.persistProviderUserUuid("u_a", "bridge", "bridge-uuid-1");
  expect(await repo.findProviderUserUuid("u_a", "bridge")).toBe("bridge-uuid-1");
});

// ───── Story 5-7 (T3) — setDisplayName + revoked exclusion ────────────────

test("setDisplayName scopes updateMany on { id, userId } and returns the refreshed DTO (AC-3, ADR-0013)", async () => {
  const captured: Array<{ where: unknown; data: unknown }> = [];
  const updateMany = mock(async (args: { where: unknown; data: unknown }) => {
    captured.push(args);
    return { count: 1 };
  });
  const findFirst = mock(async () =>
    makeRow({ id: "bnk_1", userId: "u_a", displayName: "New Name" }),
  );
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: {
        updateMany,
        findFirst,
      } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const updated = await repo.setDisplayName("u_a", "bnk_1", "New Name");
  expect(updated?.connection.displayName).toBe("New Name");
  // ADR-0013 — the write is scoped by the owning userId, never id alone.
  expect(captured[0]?.where).toEqual({ id: "bnk_1", userId: "u_a" });
  expect(captured[0]?.data).toEqual({ displayName: "New Name" });
  // DTO mapper still strips the secret-id columns.
  expect(Object.keys(updated!.connection)).not.toContain("accessTokenSecretId");
  expect(Object.keys(updated!.connection)).not.toContain("refreshTokenSecretId");
});

test("setDisplayName returns null when no row matched (unknown / cross-user id)", async () => {
  const updateMany = mock(async () => ({ count: 0 }));
  const findFirst = mock(async () => null);
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: {
        updateMany,
        findFirst,
      } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const res = await repo.setDisplayName("u_a", "bnk_does_not_exist", "X");
  expect(res).toBeNull();
  // No second query when nothing matched — count===0 short-circuits.
  expect(findFirst).not.toHaveBeenCalled();
});

test("listByUser filters out revoked connections (AC-4 soft-delete)", async () => {
  const captured: Array<{ where: { userId: string; status?: unknown } }> = [];
  const findMany = mock(async (args: { where: { userId: string; status?: unknown } }) => {
    captured.push(args);
    return [makeRow({ id: "bnk_active", status: "active" })];
  });
  const repo = createBankAggregatorRepository({
    prismaService: makeFakePrisma({
      bankConnection: { findMany } as unknown as PrismaService["client"]["bankConnection"],
    }),
  });
  const list = await repo.listByUser("u_a");
  // The query MUST exclude revoked rows at the DB layer, not in JS.
  expect(captured[0]?.where).toEqual({ userId: "u_a", status: { not: "revoked" } });
  expect(list.every((c) => c.status !== "revoked")).toBe(true);
});
