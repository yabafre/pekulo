// Repository unit tests against a fake Prisma client (no live DB) — same
// fake-client style as compass.repository.test.ts. AC coverage:
//   - AC-1 (add + list happy path)
//   - AC-6 (auto-sort by year asc + delete middle)
//   - AC-7 (update changes year + re-sort)
//   - AC-8 (cross-user delete returns false; row remains)
//   - AC-11 (hasAny returns true after add, false on empty)
//   - AC-14 (lint rule asserted statically by oxlint, not here)
//
// Live-DB integration harness still deferred (carry-over from story 1-1).

import { describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createMilestoneRepository } from "./milestones.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

interface Row {
  id: string;
  userId: string;
  targetCapital: Prisma.Decimal;
  targetYear: number;
  label: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

function fakeClient() {
  const rows: Row[] = [];
  let now = Date.now();
  let nextId = 0;
  const ts = () => new Date(now++);
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;

  const create = mock(
    async (args: {
      data: {
        userId: string;
        targetCapital: number;
        targetYear: number;
        label: string | null;
      };
    }) => {
      const row: Row = {
        id: mintId(),
        userId: args.data.userId,
        targetCapital: new Prisma.Decimal(args.data.targetCapital),
        targetYear: args.data.targetYear,
        label: args.data.label,
        position: 0,
        createdAt: ts(),
        updatedAt: ts(),
      };
      rows.push(row);
      return row;
    },
  );

  const updateMany = mock(
    async (args: {
      where: { id: string; userId: string };
      data: {
        targetCapital?: number;
        targetYear?: number;
        label?: string | null;
        updatedAt: Date;
      };
    }) => {
      const idx = rows.findIndex((r) => r.id === args.where.id && r.userId === args.where.userId);
      if (idx < 0) return { count: 0 };
      const row = rows[idx]!;
      if (args.data.targetCapital !== undefined)
        row.targetCapital = new Prisma.Decimal(args.data.targetCapital);
      if (args.data.targetYear !== undefined) row.targetYear = args.data.targetYear;
      if (args.data.label !== undefined) row.label = args.data.label;
      row.updatedAt = args.data.updatedAt;
      return { count: 1 };
    },
  );

  const deleteMany = mock(async (args: { where: { id: string; userId: string } }) => {
    const before = rows.length;
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i]!;
      if (r.id === args.where.id && r.userId === args.where.userId) rows.splice(i, 1);
    }
    return { count: before - rows.length };
  });

  const findMany = mock(
    async (args: {
      where: { userId: string };
      orderBy: Array<{
        targetYear?: "asc" | "desc";
        position?: "asc";
        createdAt?: "asc";
      }>;
    }) => {
      return rows
        .filter((r) => r.userId === args.where.userId)
        .sort(
          (a, b) =>
            a.targetYear - b.targetYear ||
            a.position - b.position ||
            a.createdAt.getTime() - b.createdAt.getTime(),
        );
    },
  );

  const findFirst = mock(
    async (args: { where: { id?: string; userId: string }; select?: unknown }) => {
      return (
        rows.find(
          (r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id),
        ) ?? null
      );
    },
  );

  const count = mock(async (args: { where: { userId: string } }) => {
    return rows.filter((r) => r.userId === args.where.userId).length;
  });

  type FakeClient = {
    milestone: {
      create: typeof create;
      updateMany: typeof updateMany;
      deleteMany: typeof deleteMany;
      findMany: typeof findMany;
      findFirst: typeof findFirst;
      count: typeof count;
    };
  };

  const client: FakeClient = {
    milestone: { create, updateMany, deleteMany, findMany, findFirst, count },
  };
  return { client, rows };
}

describe("milestones.repository", () => {
  test("add + listByUser returns the row (AC-1)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const m = await repo.add(USER_A, {
      targetCapital: 100_000,
      targetYear: 2030,
      label: "First flat",
    });
    expect(m.id).toMatch(/^mst_/);
    expect(m.targetCapital).toBe(100_000);
    expect(m.label).toBe("First flat");
    const list = await repo.listByUser(USER_A);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(m.id);
  });

  test("listByUser sorts by year asc + delete middle re-sorts (AC-6)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const a = await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const b = await repo.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    const c = await repo.add(USER_A, { targetCapital: 120_000, targetYear: 2032 });
    const sorted = await repo.listByUser(USER_A);
    expect(sorted.map((m) => m.targetYear)).toEqual([2030, 2032, 2034]);
    const ok = await repo.delete(USER_A, c.id);
    expect(ok).toBe(true);
    const after = await repo.listByUser(USER_A);
    expect(after.map((m) => m.targetYear)).toEqual([2030, 2034]);
    expect(after.map((m) => m.id)).toEqual([b.id, a.id]);
  });

  test("update changes year and list re-sorts (AC-7)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const early = await repo.add(USER_A, { targetCapital: 80_000, targetYear: 2029 });
    await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const updated = await repo.update(USER_A, early.id, { targetYear: 2036 });
    expect(updated).not.toBeNull();
    expect(updated!.targetYear).toBe(2036);
    const list = await repo.listByUser(USER_A);
    expect(list.map((m) => m.targetYear)).toEqual([2034, 2036]);
  });

  test("delete with wrong userId returns false; row remains (AC-8)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    const m = await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    const ok = await repo.delete(USER_B, m.id);
    expect(ok).toBe(false);
    const list = await repo.listByUser(USER_A);
    expect(list.length).toBe(1);
    expect(list[0]!.id).toBe(m.id);
  });

  test("hasAny is false on empty, true after add (AC-11)", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    expect(await repo.hasAny(USER_A)).toBe(false);
    await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await repo.hasAny(USER_A)).toBe(true);
    expect(await repo.hasAny(USER_B)).toBe(false);
  });

  test("countByUser counts only own rows", async () => {
    const { client } = fakeClient();
    const repo = createMilestoneRepository({
      client: client as unknown as Parameters<typeof createMilestoneRepository>[0]["client"],
    });
    await repo.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    await repo.add(USER_A, { targetCapital: 200_000, targetYear: 2035 });
    await repo.add(USER_B, { targetCapital: 50_000, targetYear: 2028 });
    expect(await repo.countByUser(USER_A)).toBe(2);
    expect(await repo.countByUser(USER_B)).toBe(1);
  });
});
