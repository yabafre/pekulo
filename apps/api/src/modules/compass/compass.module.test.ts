// Whole-module wired flow on a fake Prisma client. Asserts AC-1 / AC-2 /
// AC-4 end-to-end through the service surface (without Elysia/HTTP — the
// integration test covers that). Mirrors the hypothesis tests' fake-client
// style (no live DB harness in this story).

import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createCompassModule } from "./compass.module";
import type { PrismaService } from "../../database";

const USER_A = "44444444-4444-4444-4444-444444444444";

interface HistoryRow {
  id: string;
  userId: string;
  objectif: Prisma.Decimal;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}

function fakePrismaService() {
  const hypotheses = new Map<string, { objectif: Prisma.Decimal; horizonYears: number }>();
  const history: HistoryRow[] = [];
  let now = Date.now();
  const nextDate = () => new Date(now++);
  let nextHistoryId = 0;

  // Same shape-without-$transaction trick as compass.repository.test.ts to
  // avoid the TS7022 "client implicitly has type 'any'" circular reference.
  type FakeClient = {
    hypothesis: {
      upsert: (args: {
        where: { userId: string };
        update: { objectif: number; horizonYears: number };
        create: { userId: string; objectif: number; horizonYears: number };
      }) => Promise<{ objectif: Prisma.Decimal; horizonYears: number }>;
      findUnique: (args: {
        where: { userId: string };
      }) => Promise<{ objectif: Prisma.Decimal; horizonYears: number } | null>;
    };
    compassHistory: {
      create: (args: {
        data: { userId: string; objectif: number; horizonYears: number };
      }) => Promise<HistoryRow>;
      findMany: (args: {
        where: { userId: string };
        orderBy?: { valuedOn?: "asc" | "desc" };
        take?: number;
      }) => Promise<HistoryRow[]>;
    };
    $transaction: <T>(callback: (tx: FakeClient) => Promise<T>) => Promise<T>;
  };

  const client: FakeClient = {
    hypothesis: {
      upsert: async (args) => {
        const userId = args.where.userId;
        const next = hypotheses.has(userId)
          ? {
              objectif: new Prisma.Decimal(args.update.objectif),
              horizonYears: args.update.horizonYears,
            }
          : {
              objectif: new Prisma.Decimal(args.create.objectif),
              horizonYears: args.create.horizonYears,
            };
        hypotheses.set(userId, next);
        return next;
      },
      findUnique: async (args) => hypotheses.get(args.where.userId) ?? null,
    },
    compassHistory: {
      create: async (args) => {
        const row: HistoryRow = {
          id: `cph_${nextHistoryId++}`,
          userId: args.data.userId,
          objectif: new Prisma.Decimal(args.data.objectif),
          horizonYears: args.data.horizonYears,
          valuedOn: nextDate(),
          createdAt: nextDate(),
        };
        history.push(row);
        return row;
      },
      findMany: async (args) => {
        const filtered = history.filter((r) => r.userId === args.where.userId);
        const sorted =
          args.orderBy?.valuedOn === "desc"
            ? [...filtered].sort((a, b) => b.valuedOn.getTime() - a.valuedOn.getTime())
            : filtered;
        return args.take ? sorted.slice(0, args.take) : sorted;
      },
    },
    $transaction: async (callback) => callback(client),
  };

  return { client } as unknown as PrismaService;
}

describe("compass.module (wired)", () => {
  test("AC-1 + AC-2 + AC-4: end-to-end create → edit → setup state", async () => {
    const prismaService = fakePrismaService();
    const mod = createCompassModule({
      prismaService,
      milestonePresenceProbe: {
        async hasAny() {
          return false;
        },
      },
    });

    // Create.
    await mod.service.updateCompass(USER_A, { objectif: 500_000, horizonYears: 20 });
    let read = await mod.service.getCompass(USER_A);
    expect(read).toEqual({ objectif: 500_000, horizonYears: 20 });

    // Edit.
    await mod.service.updateCompass(USER_A, { objectif: 800_000, horizonYears: 25 });
    read = await mod.service.getCompass(USER_A);
    expect(read).toEqual({ objectif: 800_000, horizonYears: 25 });

    // FR-8 — stub probe returns false, so setup remains 'incomplete'.
    expect(await mod.service.getSetupState(USER_A)).toBe("incomplete");
  });
});
