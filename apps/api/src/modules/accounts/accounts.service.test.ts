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
    async accountExistsForUser(userId, accountId) {
      return accounts.some((a) => a.id === accountId && a.userId === userId);
    },
    async accountsExistForUser(userId, accountIds) {
      return new Set(
        accounts.filter((a) => a.userId === userId && accountIds.includes(a.id)).map((a) => a.id),
      );
    },
    async findAccountIdByLabelForUser(userId, label) {
      const matches = accounts.filter((a) => a.userId === userId && a.label === label);
      if (matches.length === 0) return { id: null, matchCount: 0 };
      if (matches.length > 1) return { id: null, matchCount: matches.length };
      return { id: matches[0]!.id, matchCount: 1 };
    },
    async recordBalanceChange() {
      // Not exercised through stubRepo's in-memory path — the dedicated
      // describe block below uses stubAccountRepository() + spread override
      // instead. Throw loudly if a future test reaches this branch.
      throw new Error("stubRepo.recordBalanceChange not implemented — use stubAccountRepository()");
    },
    async findByProviderKey() {
      throw new Error("stubRepo.findByProviderKey not implemented — use stubAccountRepository()");
    },
    async createAuto() {
      throw new Error("stubRepo.createAuto not implemented — use stubAccountRepository()");
    },
  };
}

// Throw-everywhere stub for per-method override via spread. Mirrors
// milestones.service.test.ts's stubMilestonesRepository pattern.
function stubAccountRepository(): AccountRepository {
  const fail = (name: string) => async (): Promise<never> => {
    throw new Error(`stubAccountRepository.${name} not overridden`);
  };
  return {
    create: fail("create") as unknown as AccountRepository["create"],
    update: fail("update") as unknown as AccountRepository["update"],
    delete: fail("delete") as unknown as AccountRepository["delete"],
    deleteWithFkProbe: fail(
      "deleteWithFkProbe",
    ) as unknown as AccountRepository["deleteWithFkProbe"],
    listByUser: fail("listByUser") as unknown as AccountRepository["listByUser"],
    findByIdForUser: fail("findByIdForUser") as unknown as AccountRepository["findByIdForUser"],
    countHoldingsReferencing: fail(
      "countHoldingsReferencing",
    ) as unknown as AccountRepository["countHoldingsReferencing"],
    accountExistsForUser: fail(
      "accountExistsForUser",
    ) as unknown as AccountRepository["accountExistsForUser"],
    accountsExistForUser: fail(
      "accountsExistForUser",
    ) as unknown as AccountRepository["accountsExistForUser"],
    findAccountIdByLabelForUser: fail(
      "findAccountIdByLabelForUser",
    ) as unknown as AccountRepository["findAccountIdByLabelForUser"],
    recordBalanceChange: fail(
      "recordBalanceChange",
    ) as unknown as AccountRepository["recordBalanceChange"],
    findByProviderKey: fail(
      "findByProviderKey",
    ) as unknown as AccountRepository["findByProviderKey"],
    createAuto: fail("createAuto") as unknown as AccountRepository["createAuto"],
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

  // T9 / story 5-1 — cross-aggregate ownership probe for the transactions
  // module. The service delegates to repo.accountExistsForUser, but the
  // boolean shape is part of the public service contract — assert directly
  // so a future refactor that inverts the where clause is caught here, not
  // only via the transactions module's mocked probe seam.
  test("accountExists returns true for owned same-user accounts", async () => {
    accounts.push({
      id: "acc_owned",
      userId: USER_A,
      label: "Owned",
      type: "livret",
      currency: "EUR",
      cashBalance: 100,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await service.accountExists(USER_A, "acc_owned")).toBe(true);
  });

  test("accountExists returns false for cross-user accounts", async () => {
    accounts.push({
      id: "acc_b",
      userId: USER_B,
      label: "B1",
      type: "livret",
      currency: "EUR",
      cashBalance: 0,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await service.accountExists(USER_A, "acc_b")).toBe(false);
  });

  test("accountExists returns false for missing accountId", async () => {
    expect(await service.accountExists(USER_A, "acc_missing")).toBe(false);
  });
});

// AC-1 (verbatim from story 2-2-account-balance-history:17):
//   the response Account.cashBalance equals 1500, both writes happen
//   inside a single Prisma $transaction.
// AC-3 (verbatim from story 2-2-account-balance-history:19):
//   the service throws AccountError("ACCOUNT_NOT_FOUND", "account not
//   found") → HTTP 404.
describe("recordBalanceChange", () => {
  test("delegates to repo on 'updated' outcome and returns the Account DTO", async () => {
    const fakeAccount: Account = {
      id: "acc_seed00000000000000000",
      userId: USER_A,
      label: "Livret A",
      type: "livret",
      currency: "EUR",
      cashBalance: 1500,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repo: AccountRepository = {
      ...stubAccountRepository(),
      recordBalanceChange: async () => ({ outcome: "updated", account: fakeAccount }),
    };
    const service = createAccountService({ repository: repo });
    const result = await service.recordBalanceChange(USER_A, {
      id: "acc_seed00000000000000000",
      valuedOn: new Date("2026-05-01T00:00:00Z"),
      cashBalance: 1500,
    });
    expect(result).toEqual(fakeAccount);
  });

  test("throws AccountError(ACCOUNT_NOT_FOUND) on 'not-found' outcome (AC-3)", async () => {
    const repo: AccountRepository = {
      ...stubAccountRepository(),
      recordBalanceChange: async () => ({ outcome: "not-found" }),
    };
    const service = createAccountService({ repository: repo });
    let caught: unknown = null;
    try {
      await service.recordBalanceChange(USER_A, {
        id: "acc_seed00000000000000001",
        valuedOn: new Date("2026-05-01T00:00:00Z"),
        cashBalance: 1500,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(AccountError);
    if (!(caught instanceof AccountError)) throw new Error("type narrowing");
    expect(caught.code).toBe("ACCOUNT_NOT_FOUND");
    expect(caught.message).toBe("account not found");
  });
});

// ─── T22 — findOrCreateAutoFromProvider (story 5-6 + post-review race fix) ────
describe("findOrCreateAutoFromProvider (T22 + post-review race fix)", () => {
  const PROVIDER = "bridge" as const;
  const KEY = "sg-courant-1";
  const BASE_ACCOUNT: Account = {
    id: "acc_existing0000000000",
    userId: USER_A,
    label: "Bridge — SG — Courant",
    type: "banque" as const,
    currency: "EUR",
    cashBalance: 1234,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  test("returns the existing row when findByProviderKey matches (idempotency)", async () => {
    let createAutoCalls = 0;
    const repo: AccountRepository = {
      ...stubAccountRepository(),
      findByProviderKey: async () => BASE_ACCOUNT,
      createAuto: async () => {
        createAutoCalls++;
        throw new Error("createAuto must not be called when findByProviderKey matches");
      },
    };
    const svc = createAccountService({ repository: repo });
    const r = await svc.findOrCreateAutoFromProvider(USER_A, PROVIDER, KEY, {
      label: "Bridge — SG — Courant",
      type: "banque",
      currency: "EUR",
      cashBalance: 1234,
    });
    expect(r.id).toBe(BASE_ACCOUNT.id);
    expect(createAutoCalls).toBe(0);
  });

  test("creates a new row when findByProviderKey returns null (first call)", async () => {
    const created: Account = { ...BASE_ACCOUNT, id: "acc_new00000000000000000" };
    const repo: AccountRepository = {
      ...stubAccountRepository(),
      findByProviderKey: async () => null,
      createAuto: async () => created,
    };
    const svc = createAccountService({ repository: repo });
    const r = await svc.findOrCreateAutoFromProvider(USER_A, PROVIDER, KEY, {
      label: BASE_ACCOUNT.label,
      type: "banque",
      currency: "EUR",
      cashBalance: 1234,
    });
    expect(r.id).toBe(created.id);
  });

  test("recovers from P2002 race via catch + re-read (winner row returned)", async () => {
    // Simulates two concurrent completeConnection calls:
    //   1. findByProviderKey → null on both
    //   2. First createAuto wins, persists acc_winner
    //   3. Second createAuto hits the partial UNIQUE → P2002
    //   4. Service catches, re-reads via findByProviderKey, returns winner
    const winner: Account = { ...BASE_ACCOUNT, id: "acc_winner0000000000000" };
    let firstReadDone = false;
    const repo: AccountRepository = {
      ...stubAccountRepository(),
      findByProviderKey: async () => {
        if (!firstReadDone) {
          firstReadDone = true;
          return null; // race-loser sees no row yet
        }
        return winner; // re-read after P2002 catches the winner
      },
      createAuto: async () => {
        const err = new Error("UNIQUE constraint failed") as Error & { code: string };
        err.code = "P2002";
        throw err;
      },
    };
    const svc = createAccountService({ repository: repo });
    const r = await svc.findOrCreateAutoFromProvider(USER_A, PROVIDER, KEY, {
      label: BASE_ACCOUNT.label,
      type: "banque",
      currency: "EUR",
      cashBalance: 1234,
    });
    expect(r.id).toBe(winner.id);
  });
});
