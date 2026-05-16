// Whole-module wired flow on a fake Prisma client. Asserts AC-1 (create + list),
// AC-2 (FK guard 409), AC-3 (delete happy path), AC-4 (cross-user not-found)
// end-to-end through the service surface (without Elysia/HTTP — the integration
// test covers that). Mirrors milestones.module.test.ts.

import { describe, expect, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { AccountError } from "./accounts.errors";
import { createAccountsModule } from "./accounts.module";
import type { PrismaService } from "../../database";

const USER_A = "44444444-4444-4444-4444-444444444444";
const USER_B = "55555555-5555-5555-5555-555555555555";

interface AccountRow {
  id: string;
  userId: string;
  label: string;
  type: "livret" | "pea" | "cto" | "av" | "autre";
  currency: string;
  cashBalance: Prisma.Decimal;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface HoldingRow {
  id: string;
  userId: string;
  accountId: string;
}

function fakePrismaService(seed?: { holdings?: HoldingRow[] }) {
  const accounts: AccountRow[] = [];
  const holdings: HoldingRow[] = [...(seed?.holdings ?? [])];
  let nextId = 0;
  let now = Date.now();
  const ts = () => new Date(now++);
  const mintId = () => `acc_${String(nextId++).padStart(21, "0")}`;

  type FakeClient = {
    account: {
      create: (args: {
        data: {
          userId: string;
          label: string;
          type: AccountRow["type"];
          currency: string;
          cashBalance: number;
          notes: string | null;
        };
      }) => Promise<AccountRow>;
      updateMany: (args: {
        where: { id: string; userId: string };
        data: Partial<{
          label: string;
          type: AccountRow["type"];
          currency: string;
          cashBalance: number;
          notes: string | null;
          updatedAt: Date;
        }>;
      }) => Promise<{ count: number }>;
      deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
      findMany: (args: {
        where: { userId: string };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) => Promise<AccountRow[]>;
      findFirst: (args: { where: { userId: string; id?: string } }) => Promise<AccountRow | null>;
    };
    holding: {
      count: (args: { where: { accountId: string; userId: string } }) => Promise<number>;
    };
    $transaction: <T>(callback: (tx: FakeClient) => Promise<T>) => Promise<T>;
  };

  const client: FakeClient = {
    account: {
      async create(args) {
        const row: AccountRow = {
          id: mintId(),
          userId: args.data.userId,
          label: args.data.label,
          type: args.data.type,
          currency: args.data.currency,
          cashBalance: new Prisma.Decimal(args.data.cashBalance),
          notes: args.data.notes,
          createdAt: ts(),
          updatedAt: ts(),
        };
        accounts.push(row);
        return row;
      },
      async updateMany(args) {
        const row = accounts.find((r) => r.id === args.where.id && r.userId === args.where.userId);
        if (!row) return { count: 0 };
        if (args.data.label !== undefined) row.label = args.data.label;
        if (args.data.type !== undefined) row.type = args.data.type;
        if (args.data.currency !== undefined) row.currency = args.data.currency;
        if (args.data.cashBalance !== undefined)
          row.cashBalance = new Prisma.Decimal(args.data.cashBalance);
        if (args.data.notes !== undefined) row.notes = args.data.notes;
        row.updatedAt = args.data.updatedAt ?? ts();
        return { count: 1 };
      },
      async deleteMany(args) {
        const before = accounts.length;
        for (let i = accounts.length - 1; i >= 0; i--) {
          const r = accounts[i]!;
          if (r.id === args.where.id && r.userId === args.where.userId) accounts.splice(i, 1);
        }
        return { count: before - accounts.length };
      },
      async findMany(args) {
        return accounts
          .filter((r) => r.userId === args.where.userId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      async findFirst(args) {
        return (
          accounts.find(
            (r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id),
          ) ?? null
        );
      },
    },
    holding: {
      async count(args) {
        return holdings.filter(
          (h) => h.accountId === args.where.accountId && h.userId === args.where.userId,
        ).length;
      },
    },
    // Fake $transaction: invoke the callback synchronously with the same
    // client (no rollback). The service's delete relies on this seam to
    // atomically run the FK probe + delete.
    $transaction: async (callback) => callback(client),
  };

  return {
    prismaService: { client } as unknown as PrismaService,
    accounts,
    holdings,
  };
}

describe("accounts.module — wired flow", () => {
  test("create → list → update → delete happy path (AC-1, AC-3)", async () => {
    const { prismaService } = fakePrismaService();
    const { service } = createAccountsModule({ prismaService });
    const created = await service.create(USER_A, {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(created.id).toMatch(/^acc_/);
    let list = await service.list(USER_A);
    expect(list).toHaveLength(1);
    const updated = await service.update(USER_A, { id: created.id, label: "Livret renamed" });
    expect(updated.label).toBe("Livret renamed");
    const out = await service.delete(USER_A, { id: created.id });
    expect(out).toEqual({ ok: true });
    list = await service.list(USER_A);
    expect(list).toHaveLength(0);
  });

  test("FK guard blocks delete with referencing holdings (AC-2)", async () => {
    const { prismaService, holdings } = fakePrismaService();
    const { service } = createAccountsModule({ prismaService });
    const created = await service.create(USER_A, {
      label: "Brokerage",
      type: "cto",
      currency: "EUR",
      cashBalance: 1000,
      notes: null,
    });
    // Seed two holdings referencing the new account.
    holdings.push(
      { id: "hld_1", userId: USER_A, accountId: created.id },
      { id: "hld_2", userId: USER_A, accountId: created.id },
    );
    let err: unknown;
    try {
      await service.delete(USER_A, { id: created.id });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AccountError);
    expect((err as AccountError).code).toBe("ACCOUNT_REFERENCED_FK");
    expect((err as AccountError).message).toMatch(/referenced by 2 holdings/);
    // Row remains.
    expect(await service.list(USER_A)).toHaveLength(1);
  });

  test("cross-user update returns ACCOUNT_NOT_FOUND (AC-4)", async () => {
    const { prismaService } = fakePrismaService();
    const { service } = createAccountsModule({ prismaService });
    const aOwned = await service.create(USER_B, {
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
    });
    let err: unknown;
    try {
      await service.update(USER_A, { id: aOwned.id, label: "stolen" });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(AccountError);
    expect((err as AccountError).code).toBe("ACCOUNT_NOT_FOUND");
  });
});
