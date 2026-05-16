// Service unit tests with a stubbed repository. AC coverage:
//   - AC-1 / AC-3 (create + delete happy paths)
//   - AC-2 (delete throws ACCOUNT_REFERENCED_FK when holdings count > 0)
//   - AC-4 (cross-user update / delete throws ACCOUNT_NOT_FOUND)
//   - AC-7 (service layer rejection paths)
//
// The FK-probe + delete atomicity is exercised at the repository test
// (deleteWithFkProbe wraps both in a single $transaction). The service stub
// just returns a discriminated outcome that the service translates to an
// AccountError or a `{ ok: true }` payload.

import { beforeEach, describe, expect, test } from "bun:test";
import type { Account } from "@pekulo/validators";
import { AccountError } from "./accounts.errors";
import type { AccountRepository } from "./accounts.repository";
import { createAccountService } from "./accounts.service";

async function expectRejection(promise: Promise<unknown>): Promise<AccountError> {
  let err: unknown;
  try {
    await promise;
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(AccountError);
  return err as AccountError;
}

const USER_A = "11111111-1111-1111-1111-111111111111";
const USER_B = "22222222-2222-2222-2222-222222222222";

function stubRepo(seed?: {
  accounts?: Account[];
  holdingCountByAccount?: Record<string, number>;
}): AccountRepository {
  // Hold the seeded arrays by reference so the test can `push` to them and
  // observe the change inside repository methods.
  const accounts: Account[] = seed?.accounts ?? [];
  const countMap = seed?.holdingCountByAccount ?? {};
  let nextId = accounts.length;
  return {
    async create(userId, input) {
      const created: Account = {
        id: `acc_${String(nextId++).padStart(21, "0")}`,
        userId,
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: input.notes ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      accounts.push(created);
      return created;
    },
    async update(userId, id, patch) {
      const idx = accounts.findIndex((a) => a.id === id && a.userId === userId);
      if (idx < 0) return null;
      const row = accounts[idx]!;
      const updated: Account = {
        ...row,
        label: patch.label ?? row.label,
        type: patch.type ?? row.type,
        currency: patch.currency ?? row.currency,
        cashBalance: patch.cashBalance ?? row.cashBalance,
        notes: patch.notes !== undefined ? patch.notes : row.notes,
        updatedAt: new Date(),
      };
      accounts[idx] = updated;
      return updated;
    },
    async delete(userId, id) {
      const before = accounts.length;
      for (let i = accounts.length - 1; i >= 0; i--) {
        const a = accounts[i]!;
        if (a.id === id && a.userId === userId) accounts.splice(i, 1);
      }
      return accounts.length < before;
    },
    async deleteWithFkProbe(userId, id) {
      const holdingCount = countMap[id] ?? 0;
      if (holdingCount > 0) {
        return { outcome: "fk-blocked", holdingCount };
      }
      const before = accounts.length;
      for (let i = accounts.length - 1; i >= 0; i--) {
        const a = accounts[i]!;
        if (a.id === id && a.userId === userId) accounts.splice(i, 1);
      }
      if (accounts.length === before) {
        return { outcome: "not-found" };
      }
      return { outcome: "deleted" };
    },
    async listByUser(userId) {
      return accounts.filter((a) => a.userId === userId);
    },
    async findByIdForUser(userId, id) {
      return accounts.find((a) => a.id === id && a.userId === userId) ?? null;
    },
    async countHoldingsReferencing(_userId, accountId) {
      return countMap[accountId] ?? 0;
    },
  };
}

describe("accounts.service", () => {
  let accounts: Account[];
  let countMap: Record<string, number>;
  let repo: AccountRepository;
  let service: ReturnType<typeof createAccountService>;

  beforeEach(() => {
    accounts = [];
    countMap = {};
    repo = stubRepo({ accounts, holdingCountByAccount: countMap });
    service = createAccountService({ repository: repo });
  });

  test("create delegates to repo and returns the new row (AC-1)", async () => {
    const account = await service.create(USER_A, {
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 5000,
      notes: null,
    });
    expect(account.id).toMatch(/^acc_/);
    expect(account.userId).toBe(USER_A);
    expect(account.label).toBe("Livret A");
  });

  test("update throws ACCOUNT_NOT_FOUND on cross-user attempt (AC-4)", async () => {
    accounts.push({
      id: "acc_xxxxxxxxxxxxxxxxxxxxx",
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const err = await expectRejection(
      service.update(USER_A, { id: "acc_xxxxxxxxxxxxxxxxxxxxx", label: "stolen" }),
    );
    expect(err.code).toBe("ACCOUNT_NOT_FOUND");
  });

  test("delete throws ACCOUNT_REFERENCED_FK when holdings count > 0 (AC-2)", async () => {
    accounts.push({
      id: "acc_yyyyyyyyyyyyyyyyyyyyy",
      userId: USER_A,
      label: "A-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    countMap["acc_yyyyyyyyyyyyyyyyyyyyy"] = 2;
    const err = await expectRejection(service.delete(USER_A, { id: "acc_yyyyyyyyyyyyyyyyyyyyy" }));
    expect(err.code).toBe("ACCOUNT_REFERENCED_FK");
    expect(err.message).toMatch(/referenced by 2 holdings/);
    // Row remains.
    expect(accounts).toHaveLength(1);
  });

  test("delete happy path returns { ok: true } when no holdings reference (AC-3)", async () => {
    accounts.push({
      id: "acc_zzzzzzzzzzzzzzzzzzzzz",
      userId: USER_A,
      label: "A-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const out = await service.delete(USER_A, { id: "acc_zzzzzzzzzzzzzzzzzzzzz" });
    expect(out).toEqual({ ok: true });
    expect(accounts).toHaveLength(0);
  });

  test("delete throws ACCOUNT_NOT_FOUND on cross-user attempt (AC-4)", async () => {
    accounts.push({
      id: "acc_xxxxxxxxxxxxxxxxxxxxx",
      userId: USER_B,
      label: "B-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    // Holdings count for user-a's namespace stays 0; delete returns false
    // because the row belongs to user-b → service translates to NOT_FOUND.
    const err = await expectRejection(service.delete(USER_A, { id: "acc_xxxxxxxxxxxxxxxxxxxxx" }));
    expect(err.code).toBe("ACCOUNT_NOT_FOUND");
  });

  test("delete singular message for count=1", async () => {
    accounts.push({
      id: "acc_singular0000000000",
      userId: USER_A,
      label: "A-1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    countMap["acc_singular0000000000"] = 1;
    const err = await expectRejection(service.delete(USER_A, { id: "acc_singular0000000000" }));
    expect(err.code).toBe("ACCOUNT_REFERENCED_FK");
    expect(err.message).toMatch(/referenced by 1 holding$/);
  });

  test("list returns only the user's accounts (AC-4)", async () => {
    accounts.push(
      {
        id: "acc_a",
        userId: USER_A,
        label: "A1",
        type: "livret",
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "acc_b",
        userId: USER_B,
        label: "B1",
        type: "livret",
        currency: "EUR",
        cashBalance: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );
    const list = await service.list(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe("acc_a");
  });
});
