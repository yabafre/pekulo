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
  type LlmOverrideAuditPort,
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
  transferPairId: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

const makeRepoMock = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => sampleTx),
    findByIdForUser: mock(async () => sampleTx),
    update: mock(async () => ({ outcome: "ok", transaction: sampleTx }) as UpdateOutcome),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [sampleTx], nextCursor: null })),
    bulkCreate: mock(async (_u: string, rows: unknown[]) => ({
      persisted: rows.length,
      rows: rows.map((_, i) => ({ ...sampleTx, id: `tx_bulk${i}aaaaaaaaaaaaaaaa`.slice(0, 24) })),
    })),
    // 5-3 additions — default no-op stubs ; tests that need behaviour override.
    findTransferPairCandidates: mock(async () => []),
    pairAsTransfer: mock(async () => ({ paired: 2 })),
    unpairAfterDelete: mock(async () => undefined),
    ...over,
  }) as TransactionsRepository;

const makeProbe = (exists: boolean): AccountOwnershipProbe => ({
  exists: mock(async () => exists),
  existsMany: mock(async (_u: string, ids: string[]) =>
    exists ? new Set(ids) : new Set<string>(),
  ),
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
        existsMany: mock(
          async (_u: string, ids: string[]) =>
            new Set(ids.filter((id) => id === "acc_owned1111111111111")),
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

    // AC-3 (verbatim from story 5-3-transfer-rule.md:21):
    //   the 2 paired rows land with category=transfer, transferPairId=<same
    //   tp_… id>, the 2 non-paired rows keep category=autre, transferPairId=
    //   null. Categorisation runs AFTER the bulk insert commits, sequentially
    //   per row.
    test("AC-3 — importCsv runs categoriseAfterCreate per row after bulkCreate commits", async () => {
      const outflowRow = {
        ...sampleTx,
        id: "tx_bulkoutxxxxxxxxxxxxx",
        accountId: "acc_aaa111111111111111111",
        type: "outflow" as const,
        category: "autre" as const,
      };
      const inflowRow = {
        ...sampleTx,
        id: "tx_bulkinxxxxxxxxxxxxxx",
        accountId: "acc_bbb222222222222222222",
        type: "inflow" as const,
        category: "autre" as const,
      };
      const bulkMock = mock(async () => ({ persisted: 2, rows: [outflowRow, inflowRow] }));
      // findTransferPairCandidates: row 1 (outflow) sees no sibling yet —
      // its post-commit categorise finds the empty list. Row 2 (inflow) sees
      // row 1 as its sibling. Sequential per-row contract.
      const findPairMock = mock(async () => [outflowRow])
        .mockImplementationOnce(async () => [])
        .mockImplementationOnce(async () => [outflowRow]);
      const pairMock = mock(async () => ({ paired: 2 }));
      const svc = createTransactionsService({
        repository: makeRepoMock({
          bulkCreate: bulkMock,
          findTransferPairCandidates: findPairMock,
          pairAsTransfer: pairMock,
        }),
        accountOwnershipProbe: makeProbe(true),
        accountResolver: makeResolver(),
      });
      const out = await svc.importCsv("u_a", {
        rows: [
          { ...sampleCsvRow, label: "out", type: "outflow", amount: 120 },
          { ...sampleCsvRow, label: "in", type: "inflow", amount: 120 },
        ],
      });
      expect(out).toEqual({ ok: true, persisted: 2 });
      expect(findPairMock).toHaveBeenCalledTimes(2);
      expect(pairMock).toHaveBeenCalledTimes(1);
      const pairCall = pairMock.mock.calls.at(0) as unknown as [string, string, string, string];
      expect(pairCall[0]).toBe("u_a");
      // Candidate is row 2 (inflow), sibling is row 1 (outflow).
      expect(pairCall[1]).toBe("tx_bulkinxxxxxxxxxxxxxx");
      expect(pairCall[2]).toBe("tx_bulkoutxxxxxxxxxxxxx");
      expect(pairCall[3]).toMatch(/^tp_[0-9A-Za-z]{21}$/);
    });
  });

  // ─── 5-3 — categoriseAfterCreate ───────────────────────────────────────
  // AC-1 (verbatim from story 5-3-transfer-rule.md:17, excerpt):
  //   the service detects the pair, generates a fresh tp_<21-char-base62> id,
  //   and the repository updates BOTH rows so category=transfer,
  //   transferPairId=<the same tp_… id>.
  test("AC-1 — categoriseAfterCreate pairs both rows when a sibling matches", async () => {
    const sibling = {
      ...sampleTx,
      id: "tx_siblingxxxxxxxxxxxxx",
      accountId: "acc_bbb222222222222222222",
      type: "inflow" as const,
      category: "autre" as const,
    };
    const findPairMock = mock(async () => [sibling]);
    const pairMock = mock(async () => ({ paired: 2 }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      type: "outflow",
      category: "autre",
      transferPairId: null,
    });
    expect(out.category).toBe("transfer");
    expect(out.transferPairId).toMatch(/^tp_[0-9A-Za-z]{21}$/);
    expect(pairMock).toHaveBeenCalledTimes(1);
    const pairCall = pairMock.mock.calls.at(0) as unknown as [string, string, string, string];
    expect(pairCall[0]).toBe("u_a");
    expect(pairCall[1]).toBe(sampleTx.id);
    expect(pairCall[2]).toBe("tx_siblingxxxxxxxxxxxxx");
    // `toMatch` above proved transferPairId is a string — non-null-assert here.
    expect(pairCall[3]).toBe(out.transferPairId!);
  });

  // AC-4 (verbatim from story 5-3-transfer-rule.md:23):
  //   Given Alex creates a transaction with category=loyer and a sibling on
  //   the other account would otherwise match, When categoriseAfterCreate
  //   runs, Then it short-circuits at the eligibility check.
  test("AC-4 — categoriseAfterCreate short-circuits when category !== 'autre'", async () => {
    const findPairMock = mock(async () => [{ ...sampleTx, id: "tx_siblingxxxxxxxxxxxxx" }]);
    const pairMock = mock(async () => ({ paired: 2 }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      category: "loyer",
      transferPairId: null,
    });
    expect(out.category).toBe("loyer");
    expect(out.transferPairId).toBeNull();
    expect(findPairMock).not.toHaveBeenCalled();
    expect(pairMock).not.toHaveBeenCalled();
  });

  // AC-2 (verbatim from story 5-3-transfer-rule.md:19):
  //   Given an outflow for A with no inflow sibling that matches, When
  //   createTransaction runs, Then the transaction's category stays as the
  //   user's input ; transferPairId stays null.
  test("AC-2 — categoriseAfterCreate is a no-op when no sibling matches", async () => {
    const findPairMock = mock(async () => []);
    const pairMock = mock(async () => ({ paired: 2 }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    const out = await svc.categoriseAfterCreate("u_a", {
      ...sampleTx,
      category: "autre",
      transferPairId: null,
    });
    expect(out.category).toBe("autre");
    expect(out.transferPairId).toBeNull();
    expect(findPairMock).toHaveBeenCalledTimes(1);
    expect(pairMock).not.toHaveBeenCalled();
  });

  // F6 (aped-review) — TOCTOU race guard. pairAsTransfer returning count !== 2
  // signals a concurrent delete vaporised the sibling between the candidates
  // lookup and the pair-stamp updateMany. The service raises
  // TRANSACTION_PAIR_RACE so the caller can retry on a fresh scan. The
  // createTransaction path lets it bubble (the user sees 409) ; importCsv's
  // per-row loop swallows it via console.warn (already covered by AC-3's
  // non-fatal contract — story Architecture > Atomic persistence).
  test("F6 — categoriseAfterCreate raises TRANSACTION_PAIR_RACE when pairAsTransfer count !== 2", async () => {
    const sibling = {
      ...sampleTx,
      id: "tx_siblingxxxxxxxxxxxxx",
      accountId: "acc_bbb222222222222222222",
      type: "inflow" as const,
      category: "autre" as const,
    };
    const findPairMock = mock(async () => [sibling]);
    const pairMock = mock(async () => ({ paired: 1 }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findTransferPairCandidates: findPairMock,
        pairAsTransfer: pairMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await expect(
      svc.categoriseAfterCreate("u_a", {
        ...sampleTx,
        type: "outflow",
        category: "autre",
        transferPairId: null,
      }),
    ).rejects.toMatchObject({ code: "TRANSACTION_PAIR_RACE" });
  });

  // AC-11 (verbatim from story 5-3-transfer-rule.md:37):
  //   the service (a) pre-reads tx_A to discover its transferPairId, (b) calls
  //   the repository to update the SIBLING → { category: "autre",
  //   transferPairId: null }, (c) deletes tx_A.
  test("AC-11 — deleteTransaction unpairs the sibling before deleting (when transferPairId is set)", async () => {
    const findByIdMock = mock(async () => ({
      ...sampleTx,
      transferPairId: "tp_xxxxxxxxxxxxxxxxxxxxx",
    }));
    const unpairMock = mock(async () => undefined);
    const deleteMock = mock(async () => ({ deleted: true }));
    const svc = createTransactionsService({
      repository: makeRepoMock({
        findByIdForUser: findByIdMock,
        unpairAfterDelete: unpairMock,
        delete: deleteMock,
      }),
      accountOwnershipProbe: makeProbe(true),
      accountResolver: makeResolver(),
    });
    await svc.deleteTransaction("u_a", { id: sampleTx.id });
    expect(unpairMock).toHaveBeenCalledTimes(1);
    const unpairCall = unpairMock.mock.calls.at(0) as unknown as [string, string, string];
    expect(unpairCall[0]).toBe("u_a");
    expect(unpairCall[1]).toBe("tp_xxxxxxxxxxxxxxxxxxxxx");
    expect(unpairCall[2]).toBe(sampleTx.id);
    expect(deleteMock).toHaveBeenCalledTimes(1);
    // Ordering proof: unpair invoked BEFORE delete.
    const unpairOrder = unpairMock.mock.invocationCallOrder?.[0];
    const deleteOrder = deleteMock.mock.invocationCallOrder?.[0];
    if (unpairOrder !== undefined && deleteOrder !== undefined) {
      expect(unpairOrder).toBeLessThan(deleteOrder);
    }
  });

  // ─── T21 — importFromProvider (story 5-6 + post-review race counter) ────
  describe("importFromProvider (T21)", () => {
    test("dedup pre-flight short-circuits when every row already exists", async () => {
      const findExisting = mock(async (_u: string, _p: string, ids: string[]) => new Set(ids));
      const bulkProvider = mock(async () => ({
        persisted: 0,
        raceSkipped: 0,
        rows: [] as (typeof sampleTx)[],
      }));
      const repo = makeRepoMock({
        findExistingProviderTxIds:
          findExisting as unknown as TransactionsRepository["findExistingProviderTxIds"],
        bulkCreateFromProvider:
          bulkProvider as unknown as TransactionsRepository["bulkCreateFromProvider"],
      });
      const svc = createTransactionsService({
        repository: repo,
        accountOwnershipProbe: makeProbe(true),
        accountResolver: makeResolver(),
      });
      const { persisted, skipped } = await svc.importFromProvider("u_a", "bridge", [
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-26"),
          label: "Carrefour",
          amount: 25.5,
          type: "outflow",
          category: "autre",
          providerTransactionId: "bridge-tx-1",
        },
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-27"),
          label: "Virement",
          amount: 100,
          type: "inflow",
          category: "autre",
          providerTransactionId: "bridge-tx-2",
        },
      ]);
      expect(persisted).toBe(0);
      expect(skipped).toBe(2);
      expect(bulkProvider.mock.calls.length).toBe(0);
    });

    test("skipped tally folds pre-flight dedup + race-skip from bulkCreateFromProvider", async () => {
      // Inputs = 4 rows ; pre-flight returns 1 already-existing ;
      // bulkCreateFromProvider persists 2 and race-skips 1.
      // Expected: persisted=2, skipped=2 (1 + 1).
      const findExisting = mock(
        async () => new Set(["bridge-tx-1"]), // 1 already present
      );
      const bulkProvider = mock(async (_u: string, rows: unknown[]) => ({
        persisted: 2,
        raceSkipped: 1,
        rows: rows.slice(0, 2).map((_r, i) => ({
          ...sampleTx,
          id: `tx_imp${i}aaaaaaaaaaaaaaaaaa`.slice(0, 24),
        })),
      }));
      const repo = makeRepoMock({
        findExistingProviderTxIds:
          findExisting as unknown as TransactionsRepository["findExistingProviderTxIds"],
        bulkCreateFromProvider:
          bulkProvider as unknown as TransactionsRepository["bulkCreateFromProvider"],
      });
      const svc = createTransactionsService({
        repository: repo,
        accountOwnershipProbe: makeProbe(true),
        accountResolver: makeResolver(),
      });
      const { persisted, skipped } = await svc.importFromProvider("u_a", "bridge", [
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-26"),
          label: "R1",
          amount: 10,
          type: "inflow",
          category: "autre",
          providerTransactionId: "bridge-tx-1",
        },
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-26"),
          label: "R2",
          amount: 20,
          type: "inflow",
          category: "autre",
          providerTransactionId: "bridge-tx-2",
        },
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-26"),
          label: "R3",
          amount: 30,
          type: "inflow",
          category: "autre",
          providerTransactionId: "bridge-tx-3",
        },
        {
          accountId: "acc_aaa111111111111111111",
          occurredOn: new Date("2026-05-26"),
          label: "R4",
          amount: 40,
          type: "inflow",
          category: "autre",
          providerTransactionId: "bridge-tx-4",
        },
      ]);
      expect(persisted).toBe(2);
      expect(skipped).toBe(2);
      // Only 3 fresh rows reached bulkCreateFromProvider (pre-flight stripped tx-1).
      const bulkCallArgs = bulkProvider.mock.calls[0]?.[1] as unknown[];
      expect(bulkCallArgs).toHaveLength(3);
    });
  });
});

const txRow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaaaaaaaaaaaaaaaaaaaa",
  occurredOn: "2026-05-01",
  label: "Carrefour",
  amount: 42,
  type: "outflow",
  category: "autre",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  suggestedCategory: "courses",
  suggestedConfidence: 0.9,
  suggestedRoute: "ollama",
  suggestedAt: "2026-05-01T00:00:00.000Z",
  createdAt: "2026-05-01T00:00:00.000Z",
  ...over,
});

function makeService(opts: {
  before: ReturnType<typeof txRow> | null;
  audit?: LlmOverrideAuditPort;
}) {
  const repository = {
    findByIdForUser: mock(async () => opts.before),
    confirmCategorisation: mock(async (_u: string, _id: string, finalCategory: string) => ({
      outcome: "ok" as const,
      transaction: txRow({
        category: finalCategory,
        suggestedCategory: null,
        suggestedRoute: null,
      }),
    })),
  } as never;
  return createTransactionsService({
    repository,
    accountOwnershipProbe: { exists: mock(), existsMany: mock() } as never,
    accountResolver: { resolve: mock() } as never,
    llmAudit: opts.audit,
  });
}

describe("confirmCategorisation (6-4)", () => {
  test("AC-1 accept (final === suggested) → NO override audit row", async () => {
    const recordOverride = mock(async () => {});
    const svc = makeService({
      before: txRow({ suggestedCategory: "courses" }),
      audit: { recordOverride },
    });
    await svc.confirmCategorisation("u1", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "courses" });
    expect(recordOverride).not.toHaveBeenCalled();
  });

  test("AC-2 override (final !== suggested) → records outcome overridden with route_actual", async () => {
    const recordOverride = mock(async () => {});
    const svc = makeService({
      before: txRow({ suggestedCategory: "courses", suggestedRoute: "ollama" }),
      audit: { recordOverride },
    });
    await svc.confirmCategorisation("u1", {
      id: "tx_aaaaaaaaaaaaaaaaaaaaa",
      category: "transport",
    });
    expect(recordOverride).toHaveBeenCalledTimes(1);
    expect(recordOverride.mock.calls[0]?.[0]).toMatchObject({
      userId: "u1",
      route: "ollama",
      label: "Carrefour",
    });
  });

  test("not-found → throws TRANSACTION_NOT_FOUND", async () => {
    const svc = makeService({ before: null });
    await expect(
      svc.confirmCategorisation("u1", { id: "tx_aaaaaaaaaaaaaaaaaaaaa", category: "transport" }),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND" });
  });
});
