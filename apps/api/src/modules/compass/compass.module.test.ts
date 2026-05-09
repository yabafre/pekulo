// Whole-module wired flow on a fake Prisma client. Asserts AC-1 / AC-2 /
// AC-4 end-to-end through the service surface (without Elysia/HTTP — the
// integration test covers that). Mirrors the hypothesis tests' fake-client
// style (no live DB harness in this story).

import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createCompassModule } from "./compass.module";
import type { PrismaService } from "../../database";
import type { WealthHistoryProvider, WealthSnapshot } from "@pekulo/types";

function fakeWealth(snapshots: WealthSnapshot[]): WealthHistoryProvider {
  return { read: async () => snapshots };
}

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
      findFirst: (args: {
        where: { userId: string };
        orderBy?: { valuedOn?: "asc" | "desc" };
        select?: { valuedOn?: boolean };
      }) => Promise<{ valuedOn: Date } | null>;
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
      findFirst: async (args) => {
        const filtered = history.filter((r) => r.userId === args.where.userId);
        const sorted =
          args.orderBy?.valuedOn === "asc"
            ? [...filtered].sort((a, b) => a.valuedOn.getTime() - b.valuedOn.getTime())
            : args.orderBy?.valuedOn === "desc"
              ? [...filtered].sort((a, b) => b.valuedOn.getTime() - a.valuedOn.getTime())
              : filtered;
        const row = sorted[0];
        if (!row) return null;
        return args.select?.valuedOn ? { valuedOn: row.valuedOn } : { valuedOn: row.valuedOn };
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
      wealthHistoryProvider: fakeWealth([]),
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

  test("AC-11 (story 1-2): getSetupState flips to 'complete' once probe sees a milestone", async () => {
    // End-to-end proof of the runtime-dependencies.ts:76 wiring: the compass
    // module's getSetupState handler returns 'complete' when the injected
    // MilestonePresenceProbe says there's at least one milestone, after the
    // compass row exists. Story 1-2 swaps the stub probe for a real
    // Prisma-backed one — this test verifies the integration point.
    const prismaService = fakePrismaService();
    let presence = false;
    const mod = createCompassModule({
      prismaService,
      milestonePresenceProbe: {
        async hasAny() {
          return presence;
        },
      },
      wealthHistoryProvider: fakeWealth([]),
    });
    await mod.service.updateCompass(USER_A, { objectif: 800_000, horizonYears: 25 });
    expect(await mod.service.getSetupState(USER_A)).toBe("incomplete");
    presence = true;
    expect(await mod.service.getSetupState(USER_A)).toBe("complete");
  });

  // Story 1-3 T8: wired AC-1 + AC-2 flow on fake Prisma + fake wealth provider.
  // Pins that createCompassModule threads wealthHistoryProvider all the way
  // through to compass-curve.ts — a regression here means the runtime adapter
  // (T9) is silently disconnected. Plan-length assertions live at the service
  // layer (compass.service.test.ts) where the clock is injected; here we use
  // the real wall clock so length-equality would be flaky against startDate ≈
  // today collapse via dedup.
  test("AC-1 (curve): wired flow with 3 snapshots forwards them as actual", async () => {
    const prismaService = fakePrismaService();
    const snapshots = [
      { at: new Date("2024-12-28T00:00:00Z"), totalEur: 10_000 },
      { at: new Date("2025-06-28T00:00:00Z"), totalEur: 20_000 },
      { at: new Date("2026-04-28T00:00:00Z"), totalEur: 35_000 },
    ];
    const mod = createCompassModule({
      prismaService,
      milestonePresenceProbe: {
        async hasAny() {
          return false;
        },
      },
      wealthHistoryProvider: fakeWealth(snapshots),
    });
    await mod.service.updateCompass(USER_A, { objectif: 800_000, horizonYears: 25 });

    const curve = await mod.service.getCompassCurve(USER_A);
    expect(curve.actual).toHaveLength(3);
    expect(curve.actual.map((a) => a.eur)).toEqual([10_000, 20_000, 35_000]);
    // Each actual date is mirrored in plan (alignment invariant from AC-1).
    for (const a of curve.actual) {
      expect(curve.plan.some((p) => p.at.getTime() === a.at.getTime())).toBe(true);
    }
  });

  test("AC-2 (curve): wired flow with 0 snapshots returns actual=[] + plan with anchors", async () => {
    const prismaService = fakePrismaService();
    const mod = createCompassModule({
      prismaService,
      milestonePresenceProbe: {
        async hasAny() {
          return false;
        },
      },
      wealthHistoryProvider: fakeWealth([]),
    });
    await mod.service.updateCompass(USER_A, { objectif: 800_000, horizonYears: 25 });

    const curve = await mod.service.getCompassCurve(USER_A);
    expect(curve.actual).toEqual([]);
    // First plan point is startDate with eur=0; last is endDate with eur=objectif.
    expect(curve.plan[0]!.eur).toBe(0);
    expect(curve.plan[curve.plan.length - 1]!.eur).toBe(800_000);
  });
});
