// Repository unit tests against a fake Prisma client (no live DB) — same
// fake-client style as milestones.repository.test.ts. AC coverage:
//   - AC-1 (create happy path, prefixed id returned + listed)
//   - AC-4 (cross-user attempts return null / false / empty list)
//   - AC-5 (Decimal cashBalance coerced to JS number at row → DTO boundary)
//   - AC-8 (where: { userId } guard asserted by call shape — lint enforces statically)
//
// Live-DB integration harness still deferred (carry-over from story 1-1).

import { describe, expect, mock, test } from "bun:test";
import { Prisma } from "@generated/prisma/client";
import { deriveMonthlyAggregates } from "../../common/derive/monthly-aggregates";
import { createAccountRepository } from "./accounts.repository";

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

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

interface BalanceLogRow {
  id: string;
  userId: string;
  accountId: string;
  cashBalance: Prisma.Decimal;
  valuedOn: Date;
  createdAt: Date;
}

interface TransactionRow {
  id: string;
  userId: string;
  accountId: string;
  category: string;
  transferPairId: string | null;
  type: "inflow" | "outflow";
  amount: Prisma.Decimal;
  updatedAt: Date;
}

function fakeClient(seed?: {
  accounts?: AccountRow[];
  holdings?: HoldingRow[];
  transactions?: TransactionRow[];
}) {
  const accounts: AccountRow[] = [...(seed?.accounts ?? [])];
  const holdings: HoldingRow[] = [...(seed?.holdings ?? [])];
  const transactions: TransactionRow[] = [...(seed?.transactions ?? [])];
  const balanceLog: BalanceLogRow[] = [];
  let now = Date.now();
  let nextId = 0;
  let nextLogId = 0;
  const ts = () => new Date(now++);
  const mintLogId = () => `abl_${String(nextLogId++).padStart(21, "0")}`;
  // Fake-Prisma mints zero-padded acc_ ids; the strict
  // /^acc_[0-9A-Za-z]{21}$/ pattern is enforced by the prefixedIds extension
  // at the live-DB layer (re-asserted by accountIdSchema in @pekulo/validators).
  const mintId = () => `acc_${String(nextId++).padStart(21, "0")}`;

  const create = mock(
    async (args: {
      data: {
        userId: string;
        label: string;
        type: AccountRow["type"];
        currency?: string;
        cashBalance?: number | Prisma.Decimal;
        notes?: string | null;
      };
    }) => {
      const row: AccountRow = {
        id: mintId(),
        userId: args.data.userId,
        label: args.data.label,
        type: args.data.type,
        currency: args.data.currency ?? "EUR",
        cashBalance:
          args.data.cashBalance === undefined
            ? new Prisma.Decimal(0)
            : args.data.cashBalance instanceof Prisma.Decimal
              ? args.data.cashBalance
              : new Prisma.Decimal(args.data.cashBalance),
        notes: args.data.notes ?? null,
        createdAt: ts(),
        updatedAt: ts(),
      };
      accounts.push(row);
      return row;
    },
  );

  const updateMany = mock(
    async (args: {
      where: { id: string; userId: string };
      data: Partial<{
        label: string;
        type: AccountRow["type"];
        currency: string;
        cashBalance: number;
        notes: string | null;
        updatedAt: Date;
      }>;
    }) => {
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
  );

  const deleteMany = mock(async (args: { where: { id: string; userId: string } }) => {
    const before = accounts.length;
    for (let i = accounts.length - 1; i >= 0; i--) {
      const r = accounts[i]!;
      if (r.id === args.where.id && r.userId === args.where.userId) {
        accounts.splice(i, 1);
        // Simulate the ON DELETE CASCADE: account_id FK on transactions drops
        // every transaction belonging to the deleted account (transactions.prisma
        // — account relation onDelete: Cascade).
        for (let j = transactions.length - 1; j >= 0; j--) {
          if (transactions[j]!.accountId === r.id) transactions.splice(j, 1);
        }
      }
    }
    return { count: before - accounts.length };
  });

  // Transaction store mocks — only the surface deleteWithFkProbe touches:
  // findMany (distinct transfer_pair_id on the deleted account) + updateMany
  // (unpair surviving siblings). Mirrors the real Prisma callshape.
  const txFindMany = mock(
    async (args: {
      where: {
        userId: string;
        accountId?: string;
        transferPairId?: { not: null } | { in: string[] } | null;
      };
      select?: { transferPairId?: boolean };
      distinct?: Array<"transferPairId">;
    }) => {
      const filtered = transactions.filter((t) => {
        if (t.userId !== args.where.userId) return false;
        if (args.where.accountId !== undefined && t.accountId !== args.where.accountId)
          return false;
        const pairFilter = args.where.transferPairId;
        if (pairFilter && typeof pairFilter === "object" && "not" in pairFilter) {
          if (t.transferPairId === null) return false;
        }
        return true;
      });
      const rows = filtered.map((t) => ({ transferPairId: t.transferPairId }));
      if (args.distinct?.includes("transferPairId")) {
        const seen = new Set<string | null>();
        const out: Array<{ transferPairId: string | null }> = [];
        for (const r of rows) {
          if (seen.has(r.transferPairId)) continue;
          seen.add(r.transferPairId);
          out.push(r);
        }
        return out;
      }
      return rows;
    },
  );

  const txUpdateMany = mock(
    async (args: {
      where: {
        userId: string;
        transferPairId?: { in: string[] };
        accountId?: { not: string };
      };
      data: { category?: string; transferPairId?: string | null; updatedAt?: Date };
    }) => {
      let count = 0;
      for (const t of transactions) {
        if (t.userId !== args.where.userId) continue;
        const pairIn = args.where.transferPairId?.in;
        if (pairIn && (t.transferPairId === null || !pairIn.includes(t.transferPairId))) continue;
        const notAccount = args.where.accountId?.not;
        if (notAccount !== undefined && t.accountId === notAccount) continue;
        if (args.data.category !== undefined) t.category = args.data.category;
        if (args.data.transferPairId !== undefined) t.transferPairId = args.data.transferPairId;
        if (args.data.updatedAt !== undefined) t.updatedAt = args.data.updatedAt;
        count++;
      }
      return { count };
    },
  );

  const findFirst = mock(async (args: { where: { id?: string; userId: string } }) => {
    return (
      accounts.find(
        (r) => r.userId === args.where.userId && (!args.where.id || r.id === args.where.id),
      ) ?? null
    );
  });

  const findMany = mock(
    async (args: {
      where: { userId: string; label?: string; id?: { in: string[] } };
      orderBy?: { createdAt?: "asc" | "desc" };
      // story 5-2 — findAccountIdByLabelForUser uses { select: { id: true } }
      // and an optional `where.label` filter. Story 5-2 review M2 — bulk
      // ownership probe adds `where.id.in: string[]`. The fake honours all
      // three so the new tests don't need a parallel fake.
      select?: { id?: boolean };
    }) => {
      const filtered = accounts.filter(
        (r) =>
          r.userId === args.where.userId &&
          (args.where.label === undefined || r.label === args.where.label) &&
          (args.where.id?.in === undefined || args.where.id.in.includes(r.id)),
      );
      const dir = args.orderBy?.createdAt ?? "asc";
      return filtered.sort((a, b) =>
        dir === "asc"
          ? a.createdAt.getTime() - b.createdAt.getTime()
          : b.createdAt.getTime() - a.createdAt.getTime(),
      );
    },
  );

  const holdingCount = mock(async (args: { where: { accountId: string; userId: string } }) => {
    return holdings.filter(
      (h) => h.accountId === args.where.accountId && h.userId === args.where.userId,
    ).length;
  });

  const accountBalanceLogCreate = mock(
    async (args: {
      data: { userId: string; accountId: string; cashBalance: number; valuedOn: Date };
    }) => {
      const row: BalanceLogRow = {
        id: mintLogId(),
        userId: args.data.userId,
        accountId: args.data.accountId,
        cashBalance: new Prisma.Decimal(args.data.cashBalance),
        valuedOn: args.data.valuedOn,
        createdAt: ts(),
      };
      balanceLog.push(row);
      return row;
    },
  );

  type FakeClient = {
    account: {
      create: typeof create;
      updateMany: typeof updateMany;
      deleteMany: typeof deleteMany;
      findFirst: typeof findFirst;
      findMany: typeof findMany;
    };
    holding: { count: typeof holdingCount };
    accountBalanceLog: { create: typeof accountBalanceLogCreate };
    transaction: { findMany: typeof txFindMany; updateMany: typeof txUpdateMany };
    $transaction: <T>(callback: (tx: FakeClient) => Promise<T>) => Promise<T>;
  };

  const client: FakeClient = {
    account: { create, updateMany, deleteMany, findFirst, findMany },
    holding: { count: holdingCount },
    accountBalanceLog: { create: accountBalanceLogCreate },
    transaction: { findMany: txFindMany, updateMany: txUpdateMany },
    // Mirrors Prisma's interactive-tx rollback: snapshot the mutable stores
    // before the callback, restore on throw. Without this the happy-path
    // tests pass but a mid-flight failure (T8 below) would silently retain
    // partial writes.
    $transaction: async (callback) => {
      const accountsSnap = accounts.map((r) => ({ ...r }));
      const holdingsSnap = holdings.map((r) => ({ ...r }));
      const transactionsSnap = transactions.map((r) => ({ ...r }));
      const balanceLogSnap = balanceLog.map((r) => ({ ...r }));
      try {
        return await callback(client);
      } catch (err) {
        accounts.length = 0;
        accounts.push(...accountsSnap);
        holdings.length = 0;
        holdings.push(...holdingsSnap);
        transactions.length = 0;
        transactions.push(...transactionsSnap);
        balanceLog.length = 0;
        balanceLog.push(...balanceLogSnap);
        throw err;
      }
    },
  };
  return { client, accounts, holdings, transactions, balanceLog };
}

describe("accounts.repository", () => {
  test("create returns a row with prefixed id and coerced cashBalance (AC-1, AC-5)", async () => {
    const { client } = fakeClient();
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const account = await repo.create(USER_A, {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(account.id).toMatch(/^acc_/);
    expect(account.userId).toBe(USER_A);
    expect(account.label).toBe("Livret A");
    expect(account.cashBalance).toBe(5000);
  });

  test("listByUser surfaces cashBalance as JS number for large decimals (AC-5)", async () => {
    const seed: AccountRow = {
      id: "acc_aaaaaaaaaaaaaaaaaaaaa",
      userId: USER_A,
      label: "A1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal("1500000.50"),
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    const { client } = fakeClient({ accounts: [seed] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const list = await repo.listByUser(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(seed.id);
    expect(list[0]!.cashBalance).toBe(1_500_000.5);
  });

  test("findByIdForUser returns null on cross-user attempt (AC-4)", async () => {
    const seed: AccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { client } = fakeClient({ accounts: [seed] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const found = await repo.findByIdForUser(USER_A, seed.id);
    expect(found).toBeNull();
  });

  test("update returns null on cross-user attempt (AC-4)", async () => {
    const seed: AccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { client } = fakeClient({ accounts: [seed] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const updated = await repo.update(USER_A, seed.id, { label: "stolen" });
    expect(updated).toBeNull();
  });

  test("delete returns false on cross-user attempt; row remains (AC-4)", async () => {
    const seed: AccountRow = {
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { client, accounts } = fakeClient({ accounts: [seed] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const ok = await repo.delete(USER_A, seed.id);
    expect(ok).toBe(false);
    expect(accounts).toHaveLength(1);
  });

  test("listByUser returns only the user's rows (AC-4)", async () => {
    const a: AccountRow = {
      id: "acc_aaaaaaaaaaaaaaaaaaaaa",
      userId: USER_A,
      label: "A1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(100),
      notes: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    const b: AccountRow = { ...a, id: "acc_bbbbbbbbbbbbbbbbbbbbb", userId: USER_B };
    const { client } = fakeClient({ accounts: [a, b] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const list = await repo.listByUser(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(a.id);
  });

  test("countHoldingsReferencing scopes by BOTH accountId AND userId (AC-2, AC-8)", async () => {
    const accountId = "acc_aaaaaaaaaaaaaaaaaaaaa";
    const holdingsSeed: HoldingRow[] = [
      { id: "hld_1", userId: USER_A, accountId },
      { id: "hld_2", userId: USER_A, accountId },
      // Different user — must not count (RLS defense in depth).
      { id: "hld_3", userId: USER_B, accountId },
      // Different account — must not count.
      { id: "hld_4", userId: USER_A, accountId: "acc_bbbbbbbbbbbbbbbbbbbbb" },
    ];
    const { client } = fakeClient({ holdings: holdingsSeed });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const count = await repo.countHoldingsReferencing(USER_A, accountId);
    expect(count).toBe(2);
  });

  test("deleteWithFkProbe returns fk-blocked when holdings reference the account (AC-2)", async () => {
    const accountId = "acc_blocked0000000000";
    const seedAccount: AccountRow = {
      id: accountId,
      userId: USER_A,
      label: "A-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(0),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const holdingsSeed: HoldingRow[] = [
      { id: "hld_1", userId: USER_A, accountId },
      { id: "hld_2", userId: USER_A, accountId },
    ];
    const { client, accounts } = fakeClient({
      accounts: [seedAccount],
      holdings: holdingsSeed,
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const out = await repo.deleteWithFkProbe(USER_A, accountId);
    expect(out).toEqual({ outcome: "fk-blocked", holdingCount: 2 });
    // Row remains — the FK guard short-circuited before deleteMany.
    expect(accounts).toHaveLength(1);
  });

  test("deleteWithFkProbe returns deleted when no referencing holdings (AC-3)", async () => {
    const accountId = "acc_deletable000000000";
    const seedAccount: AccountRow = {
      id: accountId,
      userId: USER_A,
      label: "A-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(0),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { client, accounts } = fakeClient({ accounts: [seedAccount] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const out = await repo.deleteWithFkProbe(USER_A, accountId);
    expect(out).toEqual({ outcome: "deleted" });
    expect(accounts).toHaveLength(0);
  });

  // Audit 2026-06-12 — deleting one half of a transfer pair must unpair the
  // SURVIVING half so the monthly aggregates stay coherent. transfer_pair_id is
  // a grouping column, not a FK, so the ON DELETE CASCADE leaves the sibling on
  // the other account dangling at category='transfer' otherwise.
  test("deleteWithFkProbe unpairs the surviving transfer sibling on the other account", async () => {
    const accountA = "acc_transferA00000000";
    const accountB = "acc_transferB00000000";
    const seedAccounts: AccountRow[] = [
      {
        id: accountA,
        userId: USER_A,
        label: "Compte A",
        type: "autre",
        currency: "EUR",
        cashBalance: new Prisma.Decimal(0),
        notes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: accountB,
        userId: USER_A,
        label: "Compte B",
        type: "autre",
        currency: "EUR",
        cashBalance: new Prisma.Decimal(0),
        notes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ];
    // A transfer pair: the outflow leg on A, the inflow leg on B, both sharing
    // tp_pair1. Plus an unrelated income row on B that must stay untouched.
    const seedTransactions: TransactionRow[] = [
      {
        id: "tx_outflow_on_A",
        userId: USER_A,
        accountId: accountA,
        category: "transfer",
        transferPairId: "tp_pair1",
        type: "outflow",
        amount: new Prisma.Decimal(200),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "tx_inflow_on_B",
        userId: USER_A,
        accountId: accountB,
        category: "transfer",
        transferPairId: "tp_pair1",
        type: "inflow",
        amount: new Prisma.Decimal(200),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "tx_salary_on_B",
        userId: USER_A,
        accountId: accountB,
        category: "salaire",
        transferPairId: null,
        type: "inflow",
        amount: new Prisma.Decimal(1000),
        updatedAt: new Date("2026-01-01"),
      },
    ];
    const { client, accounts, transactions } = fakeClient({
      accounts: seedAccounts,
      transactions: seedTransactions,
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });

    const out = await repo.deleteWithFkProbe(USER_A, accountA);
    expect(out).toEqual({ outcome: "deleted" });
    // Account A and its outflow leg are cascade-gone.
    expect(accounts.map((a) => a.id)).toEqual([accountB]);
    expect(transactions.some((t) => t.id === "tx_outflow_on_A")).toBe(false);
    // The surviving inflow leg on B is unpaired: category reverts to 'autre',
    // transfer_pair_id cleared. No longer a dangling half of a vanished pair.
    const survivingInflow = transactions.find((t) => t.id === "tx_inflow_on_B")!;
    expect(survivingInflow.category).toBe("autre");
    expect(survivingInflow.transferPairId).toBeNull();
    // The unrelated salary row is untouched.
    const salary = transactions.find((t) => t.id === "tx_salary_on_B")!;
    expect(salary.category).toBe("salaire");
    expect(salary.transferPairId).toBeNull();
  });

  // Same scenario, asserted through the pure monthly-aggregates derive: BEFORE
  // the delete the surviving inflow is wrongly classified as a transfer (income
  // undercounted); AFTER the unpair it counts as income and netChange is right.
  test("deleteWithFkProbe keeps monthly aggregates coherent after a transfer half is deleted", async () => {
    const accountA = "acc_aggA0000000000000";
    const accountB = "acc_aggB0000000000000";
    const seedAccounts: AccountRow[] = [
      {
        id: accountA,
        userId: USER_A,
        label: "A",
        type: "autre",
        currency: "EUR",
        cashBalance: new Prisma.Decimal(0),
        notes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: accountB,
        userId: USER_A,
        label: "B",
        type: "autre",
        currency: "EUR",
        cashBalance: new Prisma.Decimal(0),
        notes: null,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ];
    const seedTransactions: TransactionRow[] = [
      {
        id: "tx_out_A",
        userId: USER_A,
        accountId: accountA,
        category: "transfer",
        transferPairId: "tp_agg",
        type: "outflow",
        amount: new Prisma.Decimal(300),
        updatedAt: new Date("2026-01-01"),
      },
      {
        id: "tx_in_B",
        userId: USER_A,
        accountId: accountB,
        category: "transfer",
        transferPairId: "tp_agg",
        type: "inflow",
        amount: new Prisma.Decimal(300),
        updatedAt: new Date("2026-01-01"),
      },
    ];
    const { client, transactions } = fakeClient({
      accounts: seedAccounts,
      transactions: seedTransactions,
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });

    await repo.deleteWithFkProbe(USER_A, accountA);

    // Build the DTO shape deriveMonthlyAggregates consumes from the surviving
    // rows (only the type / category / amount fields matter for the derive).
    const survivors = transactions.map((t) => ({
      type: t.type,
      category: t.category,
      amount: Number(t.amount),
    })) as unknown as Parameters<typeof deriveMonthlyAggregates>[0]["transactions"];
    const agg = deriveMonthlyAggregates({ transactions: survivors });
    // The surviving 300€ inflow on B now reads as income (not a transfer),
    // transfers drop to 0 (the only outflow leg was on the deleted account), and
    // netChange reflects the real +300 the user kept.
    expect(agg.incomeEur).toBe(300);
    expect(agg.transfersEur).toBe(0);
    expect(agg.spendingEur).toBe(0);
    expect(agg.netChangeEur).toBe(300);
  });

  test("deleteWithFkProbe returns not-found on cross-user attempt (AC-4)", async () => {
    const accountId = "acc_otheruser000000000";
    const seedAccount: AccountRow = {
      id: accountId,
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: new Prisma.Decimal(0),
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { client, accounts } = fakeClient({ accounts: [seedAccount] });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const out = await repo.deleteWithFkProbe(USER_A, accountId);
    expect(out).toEqual({ outcome: "not-found" });
    // Row remains (belongs to USER_B).
    expect(accounts).toHaveLength(1);
  });
});

// AC-1 (verbatim from story 2-2-account-balance-history:17):
//   Given an account acc_<base62-21> owned by user A with cashBalance = 1_000,
//   When accounts.recordBalanceChange({ id, valuedOn: "2026-05-01T00:00:00Z",
//   cashBalance: 1_500 }) is called for user A, Then the response
//   Account.cashBalance equals 1500, the accounts row's cash_balance column
//   is 1500, and a new account_balance_log row exists with (user_id=userA,
//   account_id=acc_…, cash_balance=1500, valued_on=2026-05-01T00:00:00Z).
//   Both writes happen inside a single Prisma $transaction.
// AC-3 (verbatim from story 2-2-account-balance-history:19):
//   Given user B owns account acc_xyz…, When user A calls recordBalanceChange,
//   Then the service throws AccountError("ACCOUNT_NOT_FOUND", …) → HTTP 404,
//   no account_balance_log row is created, and user B's accounts.cash_balance
//   is unchanged.
// AC-5 (verbatim from story 2-2-account-balance-history:21):
//   Given the migration writes cash_balance as NUMERIC and Prisma surfaces it
//   as Decimal, When recordBalanceChange returns the updated Account DTO,
//   Then the surfaced Account.cashBalance is a JS number — never a
//   Prisma.Decimal.
describe("recordBalanceChange", () => {
  test("happy path — account.cashBalance updated AND log row inserted in one $transaction", async () => {
    const { client, balanceLog } = fakeClient({
      accounts: [
        {
          id: "acc_seed00000000000000000",
          userId: USER_A,
          label: "Livret A",
          type: "livret",
          currency: "EUR",
          cashBalance: new Prisma.Decimal(1000),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const outcome = await repo.recordBalanceChange(USER_A, {
      id: "acc_seed00000000000000000",
      valuedOn: new Date("2026-05-01T00:00:00Z"),
      cashBalance: 1500,
    });
    expect(outcome.outcome).toBe("updated");
    if (outcome.outcome !== "updated") throw new Error("type narrowing");
    expect(outcome.account.cashBalance).toBe(1500);
    expect(balanceLog).toHaveLength(1);
    expect(balanceLog[0]?.userId).toBe(USER_A);
    expect(balanceLog[0]?.accountId).toBe("acc_seed00000000000000000");
    expect(balanceLog[0]?.valuedOn.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(Number(balanceLog[0]?.cashBalance)).toBe(1500);
  });

  test("cross-user attempt returns outcome:'not-found' and writes nothing (AC-3)", async () => {
    const { client, accounts, balanceLog } = fakeClient({
      accounts: [
        {
          id: "acc_seed00000000000000001",
          userId: USER_B,
          label: "PEA",
          type: "pea",
          currency: "EUR",
          cashBalance: new Prisma.Decimal(2000),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const outcome = await repo.recordBalanceChange(USER_A, {
      id: "acc_seed00000000000000001",
      valuedOn: new Date("2026-05-01T00:00:00Z"),
      cashBalance: 9999,
    });
    expect(outcome.outcome).toBe("not-found");
    expect(balanceLog).toHaveLength(0);
    expect(Number(accounts[0]?.cashBalance)).toBe(2000);
  });

  test("Decimal cashBalance returned on the parent DTO is a JS number (AC-5)", async () => {
    const { client } = fakeClient({
      accounts: [
        {
          id: "acc_seed00000000000000002",
          userId: USER_A,
          label: "CTO",
          type: "cto",
          currency: "EUR",
          cashBalance: new Prisma.Decimal("1500000.5"),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    const outcome = await repo.recordBalanceChange(USER_A, {
      id: "acc_seed00000000000000002",
      valuedOn: new Date("2026-05-01T00:00:00Z"),
      cashBalance: 1_500_000.5,
    });
    if (outcome.outcome !== "updated") throw new Error("expected updated");
    expect(typeof outcome.account.cashBalance).toBe("number");
    expect(outcome.account.cashBalance).toBe(1_500_000.5);
  });

  test("$transaction rolls back parent update if audit insert throws (AC-1 failure branch)", async () => {
    const { client, accounts, balanceLog } = fakeClient({
      accounts: [
        {
          id: "acc_seed00000000000000003",
          userId: USER_A,
          label: "Livret A",
          type: "livret",
          currency: "EUR",
          cashBalance: new Prisma.Decimal(1000),
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    // Force the audit insert to throw mid-tx — simulates a NUMERIC overflow,
    // a NOT-NULL constraint hit, or a transient DB error landing on the
    // second statement inside the callback. The atomic-write claim of AC-1
    // holds only if the prior account.updateMany is rolled back too.
    client.accountBalanceLog.create = (async () => {
      throw new Error("simulated audit-insert failure");
    }) as unknown as typeof client.accountBalanceLog.create;
    const repo = createAccountRepository({
      client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
    });
    await expect(
      repo.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000003",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 1500,
      }),
    ).rejects.toThrow("simulated audit-insert failure");
    expect(Number(accounts[0]?.cashBalance)).toBe(1000);
    expect(balanceLog).toHaveLength(0);
  });

  // Story 5-2 — findAccountIdByLabelForUser. Backs csv-parser's resolver
  // contract (AC-4 unknown label / AC-5 ambiguous label / 1-match happy).
  describe("findAccountIdByLabelForUser", () => {
    test("returns matchCount 0 when no account matches", async () => {
      const { client } = fakeClient({ accounts: [] });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.findAccountIdByLabelForUser(USER_A, "Inconnu");
      expect(out).toEqual({ id: null, matchCount: 0 });
    });

    test("returns id + matchCount 1 when exactly one account matches", async () => {
      const { client } = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000010",
            userId: USER_A,
            label: "Compte courant",
            type: "autre",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(0),
            notes: null,
            createdAt: new Date("2026-05-01T00:00:00Z"),
            updatedAt: new Date("2026-05-01T00:00:00Z"),
          },
        ],
      });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.findAccountIdByLabelForUser(USER_A, "Compte courant");
      expect(out).toEqual({ id: "acc_seed00000000000000010", matchCount: 1 });
    });

    test("returns null + matchCount N when multiple accounts share the label", async () => {
      const { client } = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000011",
            userId: USER_A,
            label: "Compte courant",
            type: "autre",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(0),
            notes: null,
            createdAt: new Date("2026-05-01T00:00:00Z"),
            updatedAt: new Date("2026-05-01T00:00:00Z"),
          },
          {
            id: "acc_seed00000000000000012",
            userId: USER_A,
            label: "Compte courant",
            type: "autre",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(0),
            notes: null,
            createdAt: new Date("2026-05-02T00:00:00Z"),
            updatedAt: new Date("2026-05-02T00:00:00Z"),
          },
        ],
      });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.findAccountIdByLabelForUser(USER_A, "Compte courant");
      expect(out).toEqual({ id: null, matchCount: 2 });
    });

    test("does not leak across users — cross-user label match returns 0", async () => {
      const { client } = fakeClient({
        accounts: [
          {
            id: "acc_seed00000000000000020",
            userId: USER_B,
            label: "Compte courant",
            type: "autre",
            currency: "EUR",
            cashBalance: new Prisma.Decimal(0),
            notes: null,
            createdAt: new Date("2026-05-01T00:00:00Z"),
            updatedAt: new Date("2026-05-01T00:00:00Z"),
          },
        ],
      });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.findAccountIdByLabelForUser(USER_A, "Compte courant");
      expect(out).toEqual({ id: null, matchCount: 0 });
    });
  });

  // Story 5-2 aped-review N2 — accountsExistForUser. Bulk ownership probe used
  // by transactions.service.importCsv to collapse N row-level ownership checks
  // into a single findMany with `id: { in: [...] }`.
  describe("accountsExistForUser", () => {
    const baseAccount = (id: string, userId: string) => ({
      id,
      userId,
      label: `acc-${id}`,
      type: "autre" as const,
      currency: "EUR",
      cashBalance: new Prisma.Decimal(0),
      notes: null,
      createdAt: new Date("2026-05-01T00:00:00Z"),
      updatedAt: new Date("2026-05-01T00:00:00Z"),
    });

    test("returns empty set when accountIds is empty (no round-trip)", async () => {
      const { client } = fakeClient({
        accounts: [baseAccount("acc_seed00000000000000031", USER_A)],
      });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.accountsExistForUser(USER_A, []);
      expect(out.size).toBe(0);
    });

    test("returns the subset of ids owned by the user, never leaking cross-user", async () => {
      const { client } = fakeClient({
        accounts: [
          baseAccount("acc_seed00000000000000041", USER_A),
          baseAccount("acc_seed00000000000000042", USER_A),
          baseAccount("acc_seed00000000000000043", USER_B),
        ],
      });
      const repo = createAccountRepository({
        client: client as unknown as Parameters<typeof createAccountRepository>[0]["client"],
      });
      const out = await repo.accountsExistForUser(USER_A, [
        "acc_seed00000000000000041",
        "acc_seed00000000000000042",
        "acc_seed00000000000000043",
        "acc_seed00000000000000099",
      ]);
      expect(out).toEqual(new Set(["acc_seed00000000000000041", "acc_seed00000000000000042"]));
    });
  });
});
