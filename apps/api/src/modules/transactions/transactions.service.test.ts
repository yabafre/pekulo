// apps/api/src/modules/transactions/transactions.service.test.ts
// bun:test — TDD RED for the transactions service (story 5-1).
// Asserts: ACCOUNT_NOT_FOUND on cross-aggregate, TRANSACTION_NOT_FOUND on
// stale id, delete non-idempotent, update partial.

import { beforeEach, describe, expect, mock, test } from "bun:test";
import { PekuloError } from "../../common/errors";
import type { TransactionsRepository, UpdateOutcome } from "./transactions.repository";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
} from "./transactions.service";

const sampleTx = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Courses",
  amount: 87.5,
  type: "outflow" as const,
  category: "courses" as const,
  isImprevu: false,
  notes: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

const makeRepoMock = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => sampleTx),
    findByIdForUser: mock(async () => sampleTx),
    update: mock(async () => ({ outcome: "ok", transaction: sampleTx }) as UpdateOutcome),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [sampleTx], nextCursor: null })),
    bulkCreate: mock(async (_u: string, rows: unknown[]) => ({ persisted: rows.length })),
    ...over,
  }) as TransactionsRepository;

const makeProbe = (exists: boolean): AccountOwnershipProbe => ({
  exists: mock(async () => exists),
});

// Default resolver — story 5-1 tests don't exercise CSV paths, so a stub
// that always returns "no match" is safe. Story 5-2 tests below pass their
// own resolver fixtures.
const makeResolver = (): AccountResolver => ({
  resolve: mock(async () => ({ id: null, matchCount: 0 })),
});

describe("transactionsService", () => {
  let service: ReturnType<typeof createTransactionsService>;
  beforeEach(() => {
    service = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
  });

  // AC-2 (verbatim from story 5-1:18):
  //   Given user A owns acc_aaa… and user B owns acc_bbb…, When A calls
  //   createTransaction({ accountId: "acc_bbb…", … }), Then the service
  //   rejects with ACCOUNT_NOT_FOUND → HTTP 404. The guard pre-flights
  //   accountOwnershipProbe.exists(userId, accountId) BEFORE any Prisma write.
  test("AC-2 — create with cross-account → ACCOUNT_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: makeProbe(false),
      accountResolver: makeResolver(),
    });
    await expect(
      svc.createTransaction("u_a", {
        accountId: "acc_bbb222222222222222222",
        occurredOn: "2026-05-15",
        label: "x",
        amount: 1,
        type: "outflow",
        category: "courses",
        isImprevu: false,
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
  });

  test("AC-1 — create happy path returns DTO", async () => {
    const out = await service.createTransaction("u_a", {
      accountId: "acc_aaa111111111111111111",
      occurredOn: "2026-05-15",
      label: "x",
      amount: 1,
      type: "outflow",
      category: "courses",
      isImprevu: false,
      notes: null,
    });
    expect(out.id).toBe(sampleTx.id);
  });

  // AC-3 partial (verbatim from story 5-1:19):
  //   And When A calls updateTransaction({ id: "tx_aaa…" }) with no field
  //   beyond id, Then the validator rejects with ZodError → HTTP 400.
  // (validator-level — exercised in repository.test AC-12 via the refine).
  // Here we exercise the service translation when the repository returns
  // not-found (e.g. stale id on partial update).
  test("AC-3 — update with stale id → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({
        update: mock(async () => ({ outcome: "not-found" }) as UpdateOutcome),
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await expect(
      svc.updateTransaction("u_a", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", amount: 5 }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  // AC-2 update branch — switching accountId mid-update re-pre-flights the probe.
  test("AC-2 — update with switched accountId pre-flights probe", async () => {
    const probe = makeProbe(false);
    const svc = createTransactionsService({
      repository: makeRepoMock(),
      accountOwnershipProbe: probe,
      accountResolver: makeResolver(),
    });
    await expect(
      svc.updateTransaction("u_a", {
        id: "tx_aaaaaaaaaaaaaaaaaaaaa",
        accountId: "acc_bbb222222222222222222",
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    expect(probe.exists).toHaveBeenCalled();
  });

  // AC-4 (verbatim from story 5-1:20):
  //   And When A calls it again on the now-gone id, Then the service rejects
  //   with TRANSACTION_NOT_FOUND → HTTP 404 (per D4 — NOT idempotent like
  //   detachMortgage; a stale id should fail loudly).
  test("AC-4 — delete non-idempotent: gone id → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({
        delete: mock(async () => ({ deleted: false })),
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await expect(
      svc.deleteTransaction("u_a", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  // AC-6 (verbatim from story 5-1:22):
  //   Given A's tx_aaa…, When B calls getTransaction({ id }), Then the service
  //   rejects with TRANSACTION_NOT_FOUND → HTTP 404.
  test("AC-6 — get on cross-user (null from repo) → TRANSACTION_NOT_FOUND", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({ findByIdForUser: mock(async () => null) }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await expect(
      svc.getTransaction("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });

  test("AC-6/AC-10 — error is a PekuloError instance (typed surface)", async () => {
    const svc = createTransactionsService({
      repository: makeRepoMock({ findByIdForUser: mock(async () => null) }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    try {
      await svc.getTransaction("u_b", { id: "tx_aaaaaaaaaaaaaaaaaaaaa" });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(PekuloError);
    }
  });

  // Story 5-2 T7 — previewImportCsv delegates to csv-parser; service
  // surface is intentionally thin (parses + returns row breakdown unchanged).
  describe("previewImportCsv", () => {
    test("delegates to parseCsvForPreview and returns its output", async () => {
      const resolver: AccountResolver = {
        resolve: mock(async (_u: string, label: string) =>
          label === "Compte courant"
            ? { id: "acc_aaa111111111111111111", matchCount: 1 }
            : { id: null, matchCount: 0 },
        ),
      };
      const svc = createTransactionsService({
        repository: makeRepoMock(),
        accountOwnershipProbe: makeProbe(true),
        accountResolver: resolver,
      });
      const out = await svc.previewImportCsv("u_a", {
        csvText: "2026-05-01,42.50,Test,Compte courant",
      });
      expect(out.summary).toEqual({ total: 1, valid: 1, invalid: 0 });
    });
  });

  // Story 5-2 T7 — importCsv: AC-8 re-check (defense in depth) + AC-6
  // happy-path delegation + bulk-insert rollback surfaces as
  // TRANSACTION_FAILED.
  describe("importCsv", () => {
    const sampleCsvRow = {
      occurredOn: "2026-05-01",
      amount: 1,
      type: "inflow" as const,
      category: "autre" as const,
      label: "X",
      accountId: "acc_owned1111111111111",
      isImprevu: false,
      notes: null,
    };

    test("AC-8 — re-checks ownership for every row before bulk-insert", async () => {
      const probe: AccountOwnershipProbe = {
        exists: mock(
          async (_u: string, accountId: string) => accountId === "acc_owned1111111111111",
        ),
      };
      const svc = createTransactionsService({
        repository: makeRepoMock(),
        accountOwnershipProbe: probe,
        accountResolver: makeResolver(),
      });
      await expect(
        svc.importCsv("u_a", {
          rows: [{ ...sampleCsvRow, accountId: "acc_other1111111111111" }],
        }),
      ).rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND" });
    });

    test("returns { ok: true, persisted: N } on success", async () => {
      const svc = createTransactionsService({
        repository: makeRepoMock(),
        accountOwnershipProbe: makeProbe(true),
        accountResolver: makeResolver(),
      });
      const out = await svc.importCsv("u_a", {
        rows: [
          { ...sampleCsvRow, label: "X" },
          { ...sampleCsvRow, label: "Y", type: "outflow", amount: 2 },
        ],
      });
      expect(out).toEqual({ ok: true, persisted: 2 });
    });

    test("wraps bulk-insert failure as TRANSACTION_FAILED", async () => {
      const bulkCreateFail = mock(async () => {
        throw new Error("simulated bulk failure");
      });
      const svc = createTransactionsService({
        repository: makeRepoMock({ bulkCreate: bulkCreateFail }),
        accountOwnershipProbe: makeProbe(true),
        accountResolver: makeResolver(),
      });
      await expect(svc.importCsv("u_a", { rows: [sampleCsvRow] })).rejects.toMatchObject({
        code: "TRANSACTION_FAILED",
      });
    });
  });
});
