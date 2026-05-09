// Repository unit tests against a fake Prisma client (no live DB) — same
// fake-client style as hypothesis.service.test.ts. Three coverage layers
// share the AC list:
//   - AC-1 (atomic upsert + history insert): asserted here against a fake $tx
//   - AC-2 (audit ordering): asserted here against an in-memory history store
//   - AC-5 (RLS isolation, where: { userId } guard): enforced statically by
//     pekulo/no-prisma-query-without-user-id (story 0-12), with prismaIdentifier
//     extended to ["prisma","tx"] in this story (T6 .oxlintrc override)
//   - AC-6 (SQL policy probe): enforced by the existing db:rls-audit CI script
//     extended in T1 with compass_history: 2
//
// A live-DB integration harness (apps/api/src/test/helpers/test-db.ts) was
// scoped out of this story per dev decision — to be picked up alongside
// 1-2 / 2-1's first need for it.

import { describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createCompassRepository } from "./compass.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

interface HistoryRow {
  id: string;
  userId: string;
  objectif: Prisma.Decimal;
  horizonYears: number;
  valuedOn: Date;
  createdAt: Date;
}

function fakeClient() {
  const hypotheses = new Map<string, { objectif: Prisma.Decimal; horizonYears: number }>();
  const history: HistoryRow[] = [];
  let now = Date.now();
  const nextDate = () => new Date(now++);

  const upsert = mock(
    async (args: {
      where: { userId: string };
      update: { objectif: number; horizonYears: number };
      create: { userId: string; objectif: number; horizonYears: number };
      select: unknown;
    }) => {
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
  );

  const findUnique = mock(
    async (args: { where: { userId: string } }) => hypotheses.get(args.where.userId) ?? null,
  );

  let nextHistoryId = 0;
  const create = mock(
    async (args: {
      data: { userId: string; objectif: number; horizonYears: number; valuedOn?: Date };
    }) => {
      // The fake assigns its own monotonic valuedOn / createdAt so the desc
      // sort below stays stable even when the repo writes two rows inside the
      // same millisecond (which the production DB would also resolve, but
      // here it'd collapse the ordering and break AC-2's assertion).
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
  );

  const findMany = mock(
    async (args: {
      where: { userId: string };
      orderBy?: { valuedOn?: "asc" | "desc" };
      take?: number;
    }) => {
      const filtered = history.filter((r) => r.userId === args.where.userId);
      const sorted =
        args.orderBy?.valuedOn === "desc"
          ? [...filtered].sort((a, b) => b.valuedOn.getTime() - a.valuedOn.getTime())
          : filtered;
      return args.take ? sorted.slice(0, args.take) : sorted;
    },
  );

  const $transaction = mock(
    async <T>(callback: (tx: typeof clientObj) => Promise<T>): Promise<T> => callback(clientObj),
  );

  const clientObj = {
    hypothesis: { upsert, findUnique },
    compassHistory: { create, findMany },
    $transaction,
  };

  return { client: clientObj, mocks: { upsert, findUnique, create, findMany, $transaction } };
}

describe("compass.repository", () => {
  // AC-1 (verbatim from story 1-1 L16): updateCompass({ objectif: 800_000,
  // horizonYears: 25 }) upserts Hypothesis AND inserts CompassHistory carrying
  // the same tuple — both within the same $transaction.
  test("AC-1: upsertCompassWithHistory writes both Hypothesis + CompassHistory atomically", async () => {
    const { client, mocks } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createCompassRepository({ client: client as any });

    const out = await repo.upsertCompassWithHistory(USER_A, {
      objectif: 800_000,
      horizonYears: 25,
    });

    expect(out).toEqual({ objectif: 800_000, horizonYears: 25 });
    expect(mocks.$transaction).toHaveBeenCalledTimes(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledTimes(1);

    const upsertCall = mocks.upsert.mock.calls[0]?.[0];
    expect(upsertCall?.where).toEqual({ userId: USER_A });
    expect(upsertCall?.create.userId).toBe(USER_A);
    expect(upsertCall?.create.objectif).toBe(800_000);
    expect(upsertCall?.update.objectif).toBe(800_000);

    const createCall = mocks.create.mock.calls[0]?.[0];
    expect(createCall?.data.userId).toBe(USER_A);
    expect(createCall?.data.objectif).toBe(800_000);
    expect(createCall?.data.horizonYears).toBe(25);
  });

  // AC-2 (verbatim): given a prior compass {500_000, 20}, calling updateCompass
  // with {800_000, 25} leaves CompassHistory with TWO rows ordered by valuedOn
  // desc — latest carries (800_000, 25), earlier (500_000, 20).
  test("AC-2: edit archives prior values — listHistory returns 2 rows ordered desc", async () => {
    const { client } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createCompassRepository({ client: client as any });

    await repo.upsertCompassWithHistory(USER_B, { objectif: 500_000, horizonYears: 20 });
    await repo.upsertCompassWithHistory(USER_B, { objectif: 800_000, horizonYears: 25 });

    const history = await repo.listHistory(USER_B);
    expect(history).toHaveLength(2);
    expect(history[0]?.objectif).toBe(800_000);
    expect(history[0]?.horizonYears).toBe(25);
    expect(history[1]?.objectif).toBe(500_000);
    expect(history[1]?.horizonYears).toBe(20);
  });

  test("findCompass returns null when no Hypothesis row exists for userId", async () => {
    const { client } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createCompassRepository({ client: client as any });
    expect(await repo.findCompass("99999999-9999-9999-9999-999999999999")).toBeNull();
  });

  // findCompass after upsert maps Prisma.Decimal columns through decimalToNumber.
  test("findCompass maps Prisma.Decimal -> JS number via decimalToNumber (L24)", async () => {
    const { client } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createCompassRepository({ client: client as any });
    await repo.upsertCompassWithHistory(USER_A, { objectif: 800_000, horizonYears: 25 });

    const out = await repo.findCompass(USER_A);
    expect(out).toEqual({ objectif: 800_000, horizonYears: 25 });
    expect(typeof out?.objectif).toBe("number");
  });

  test("listHistory respects limit and userId filter (no cross-user leakage)", async () => {
    const { client } = fakeClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const repo = createCompassRepository({ client: client as any });

    await repo.upsertCompassWithHistory(USER_A, { objectif: 100_000, horizonYears: 10 });
    await repo.upsertCompassWithHistory(USER_B, { objectif: 200_000, horizonYears: 15 });
    await repo.upsertCompassWithHistory(USER_A, { objectif: 300_000, horizonYears: 20 });

    const a = await repo.listHistory(USER_A);
    const b = await repo.listHistory(USER_B);
    expect(a.every((r) => r.userId === USER_A)).toBe(true);
    expect(b.every((r) => r.userId === USER_B)).toBe(true);
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(1);

    const limited = await repo.listHistory(USER_A, { limit: 1 });
    expect(limited).toHaveLength(1);
    expect(limited[0]?.objectif).toBe(300_000);
  });
});
