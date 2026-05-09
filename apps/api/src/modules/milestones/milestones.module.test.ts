// Whole-module wired flow on a fake Prisma client. Asserts AC-1, AC-6, AC-7,
// AC-11 end-to-end through the service surface (without Elysia/HTTP — the
// integration test covers that). Mirrors compass.module.test.ts.

import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import type { CompassReader } from "@pekulo/types";
import { createMilestonesModule } from "./milestones.module";
import type { PrismaService } from "../../database";

const USER_A = "44444444-4444-4444-4444-444444444444";

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

function fakePrismaService() {
  const rows: Row[] = [];
  let nextId = 0;
  let now = Date.now();
  const ts = () => new Date(now++);
  const mintId = () => `mst_${String(nextId++).padStart(21, "0")}`;

  type FakeClient = {
    milestone: {
      create: (args: {
        data: {
          userId: string;
          targetCapital: number;
          targetYear: number;
          label: string | null;
        };
      }) => Promise<Row>;
      updateMany: (args: {
        where: { id: string; userId: string };
        data: {
          targetCapital?: number;
          targetYear?: number;
          label?: string | null;
          updatedAt: Date;
        };
      }) => Promise<{ count: number }>;
      deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
      findMany: (args: {
        where: { userId: string };
        orderBy: Array<{ targetYear?: "asc"; position?: "asc"; createdAt?: "asc" }>;
      }) => Promise<Row[]>;
      findFirst: (args: {
        where: { userId: string; id?: string };
        select?: unknown;
      }) => Promise<Row | null>;
      count: (args: { where: { userId: string } }) => Promise<number>;
    };
    $transaction: <T>(callback: (tx: FakeClient) => Promise<T>) => Promise<T>;
  };

  const client: FakeClient = {
    milestone: {
      async create(args) {
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
      async updateMany(args) {
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
      async deleteMany(args) {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          const r = rows[i]!;
          if (r.id === args.where.id && r.userId === args.where.userId) rows.splice(i, 1);
        }
        return { count: before - rows.length };
      },
      async findMany(args) {
        return rows
          .filter((r) => r.userId === args.where.userId)
          .sort(
            (a, b) =>
              a.targetYear - b.targetYear ||
              a.position - b.position ||
              a.createdAt.getTime() - b.createdAt.getTime(),
          );
      },
      async findFirst(args) {
        return (
          rows.find(
            (r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id),
          ) ?? null
        );
      },
      async count(args) {
        return rows.filter((r) => r.userId === args.where.userId).length;
      },
    },
    // Fake $transaction: same shape as compass.repository.test.ts — invokes
    // the callback synchronously with the same client (no rollback). The
    // service's addEnforcingCap relies on this seam to atomically count+create.
    $transaction: async (callback) => callback(client),
  };

  return { client: client as unknown as PrismaService["client"], rows };
}

const fixedCompass: CompassReader = {
  async read() {
    return { objectif: 800_000, horizonYears: 25 };
  },
};

describe("milestones.module — wired flow", () => {
  test("add → list → update → delete keeps year-asc order (AC-1, AC-6, AC-7)", async () => {
    const { client } = fakePrismaService();
    const { service } = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    const a = await service.add(USER_A, { targetCapital: 200_000, targetYear: 2034 });
    const b = await service.add(USER_A, { targetCapital: 80_000, targetYear: 2030 });
    const c = await service.add(USER_A, { targetCapital: 120_000, targetYear: 2032 });
    expect((await service.list(USER_A)).map((m) => m.targetYear)).toEqual([2030, 2032, 2034]);
    await service.delete(USER_A, c.id);
    expect((await service.list(USER_A)).map((m) => m.id)).toEqual([b.id, a.id]);
    await service.update(USER_A, { id: b.id, targetYear: 2036 });
    expect((await service.list(USER_A)).map((m) => m.targetYear)).toEqual([2034, 2036]);
  });

  test("presenceProbe flips after first add (AC-11)", async () => {
    const { client } = fakePrismaService();
    const m = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    expect(await m.presenceProbe.hasAny(USER_A)).toBe(false);
    await m.service.add(USER_A, { targetCapital: 100_000, targetYear: 2030 });
    expect(await m.presenceProbe.hasAny(USER_A)).toBe(true);
  });

  test("rejects 21st add (AC-2)", async () => {
    const { client } = fakePrismaService();
    const { service } = createMilestonesModule({
      prismaService: { client } as unknown as PrismaService,
      compassReader: fixedCompass,
    });
    for (let i = 0; i < 20; i++) {
      // oxlint-disable-next-line no-await-in-loop -- cap test must observe sequential count
      await service.add(USER_A, { targetCapital: 100_000 + i * 1000, targetYear: 2027 + i });
    }
    await expect(service.add(USER_A, { targetCapital: 999_000, targetYear: 2049 })).rejects.toThrow(
      /milestones cap is 20/,
    );
  });
});
