// AC-1 / AC-2 / AC-3 (story 5-4):
//   findByMonth scopes by userId (RLS belt-and-braces); upsertByMonth is
//   idempotent (single round-trip via unique constraint) and preserves
//   signedOffAt set elsewhere; findByMonth for user B never sees user A's row.

import { beforeEach, describe, expect, it } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { createMonthlyRepository, type MonthlyRepository } from "./monthly.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

interface FakeMonthlyRow {
  id: string;
  userId: string;
  year: number;
  monthNum: number;
  incomeEur: Prisma.Decimal;
  spendingEur: Prisma.Decimal;
  transfersEur: Prisma.Decimal;
  netChangeEur: Prisma.Decimal;
  signedOffAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakeClient() {
  const rows: FakeMonthlyRow[] = [];
  let nextId = 1;
  return {
    rows,
    monthlyRecord: {
      findFirst: async (args: { where: { userId: string; year: number; monthNum: number } }) => {
        return (
          rows.find(
            (r) =>
              r.userId === args.where.userId &&
              r.year === args.where.year &&
              r.monthNum === args.where.monthNum,
          ) ?? null
        );
      },
      upsert: async (args: {
        where: {
          userId: string;
          userId_year_monthNum: {
            userId: string;
            year: number;
            monthNum: number;
          };
        };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = args.where.userId_year_monthNum;
        const existing = rows.find(
          (r) => r.userId === key.userId && r.year === key.year && r.monthNum === key.monthNum,
        );
        if (existing) {
          Object.assign(existing, {
            incomeEur: new Prisma.Decimal(args.update.incomeEur as number),
            spendingEur: new Prisma.Decimal(args.update.spendingEur as number),
            transfersEur: new Prisma.Decimal(args.update.transfersEur as number),
            netChangeEur: new Prisma.Decimal(args.update.netChangeEur as number),
            updatedAt: new Date(),
          });
          return existing;
        }
        const created: FakeMonthlyRow = {
          id: `mr_test${String(nextId++).padStart(17, "0")}`,
          userId: args.create.userId as string,
          year: args.create.year as number,
          monthNum: args.create.monthNum as number,
          incomeEur: new Prisma.Decimal(args.create.incomeEur as number),
          spendingEur: new Prisma.Decimal(args.create.spendingEur as number),
          transfersEur: new Prisma.Decimal(args.create.transfersEur as number),
          netChangeEur: new Prisma.Decimal(args.create.netChangeEur as number),
          signedOffAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        rows.push(created);
        return created;
      },
    },
    transaction: { findMany: async () => [] as unknown[] },
  };
}

describe("monthly.repository", () => {
  let client: ReturnType<typeof makeFakeClient>;
  let repository: MonthlyRepository;

  beforeEach(() => {
    client = makeFakeClient();
    repository = createMonthlyRepository({ client: client as never });
  });

  it("findByMonth — miss returns null", async () => {
    expect(await repository.findByMonth(USER_A, 2026, 5)).toBeNull();
  });

  it("findByMonth — hit returns DTO scoped to the user (AC-3 RLS belt)", async () => {
    client.rows.push({
      id: "mr_hit0000000000000000000",
      userId: USER_A,
      year: 2026,
      monthNum: 5,
      incomeEur: new Prisma.Decimal(3943),
      spendingEur: new Prisma.Decimal(2100),
      transfersEur: new Prisma.Decimal(500),
      netChangeEur: new Prisma.Decimal(1843),
      signedOffAt: null,
      createdAt: new Date("2026-05-25T10:00:00.000Z"),
      updatedAt: new Date("2026-05-25T10:00:00.000Z"),
    });
    const row = await repository.findByMonth(USER_A, 2026, 5);
    expect(row).toMatchObject({
      id: "mr_hit0000000000000000000",
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2100,
      transfersEur: 500,
      netChangeEur: 1843,
      signedOffAt: null,
    });
    // RLS belt — user B never sees user A's row.
    expect(await repository.findByMonth(USER_B, 2026, 5)).toBeNull();
  });

  it("upsertByMonth — insert when missing", async () => {
    const out = await repository.upsertByMonth(USER_A, {
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2100,
      transfersEur: 500,
      netChangeEur: 1843,
    });
    expect(out.id).toMatch(/^mr_/);
    expect(out.year).toBe(2026);
    expect(out.signedOffAt).toBeNull();
    expect(client.rows).toHaveLength(1);
  });

  it("upsertByMonth — update preserves signedOffAt set elsewhere", async () => {
    client.rows.push({
      id: "mr_sig0000000000000000000",
      userId: USER_A,
      year: 2026,
      monthNum: 5,
      incomeEur: new Prisma.Decimal(3943),
      spendingEur: new Prisma.Decimal(2100),
      transfersEur: new Prisma.Decimal(500),
      netChangeEur: new Prisma.Decimal(1843),
      signedOffAt: new Date("2026-06-01T12:00:00.000Z"),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const out = await repository.upsertByMonth(USER_A, {
      year: 2026,
      monthNum: 5,
      incomeEur: 3943,
      spendingEur: 2500,
      transfersEur: 500,
      netChangeEur: 1443,
    });
    expect(out.spendingEur).toBe(2500);
    expect(out.signedOffAt).toBe("2026-06-01T12:00:00.000Z");
    expect(client.rows).toHaveLength(1);
  });
});
