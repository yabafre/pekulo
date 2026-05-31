// bun:test — LLM suggestion path (story 6-2, AC-4).
import { expect, mock, test } from "bun:test";
import type { CreateTransactionInput, Transaction } from "@pekulo/validators";
import type { TransactionsRepository } from "./transactions.repository";
import {
  createTransactionsService,
  type AccountOwnershipProbe,
  type AccountResolver,
  type TransactionCategoriser,
} from "./transactions.service";

const autreTx: Transaction = {
  id: "tx_aaaaaaaaaaaaaaaaaaaaa",
  accountId: "acc_aaa111111111111111111",
  occurredOn: "2026-05-15",
  label: "Carrefour",
  amount: 42.5,
  type: "outflow",
  category: "autre",
  isImprevu: false,
  notes: null,
  transferPairId: null,
  createdAt: "2026-05-15T10:00:00.000Z",
};

const makeRepo = (over: Partial<TransactionsRepository> = {}): TransactionsRepository =>
  ({
    create: mock(async () => autreTx),
    findByIdForUser: mock(async () => autreTx),
    update: mock(async () => ({ outcome: "ok", transaction: autreTx })),
    delete: mock(async () => ({ deleted: true })),
    listByUser: mock(async () => ({ items: [autreTx], nextCursor: null })),
    bulkCreate: mock(async () => ({ persisted: 0, rows: [] })),
    bulkCreateFromProvider: mock(async () => ({ persisted: 0, raceSkipped: 0, rows: [] })),
    findExistingProviderTxIds: mock(async () => new Set<string>()),
    findTransferPairCandidates: mock(async () => []),
    pairAsTransfer: mock(async () => ({ paired: 2 })),
    unpairAfterDelete: mock(async () => undefined),
    saveSuggestion: mock(async () => ({ saved: true })),
    ...over,
  }) as unknown as TransactionsRepository;

const probe: AccountOwnershipProbe = {
  exists: mock(async () => true),
  existsMany: mock(async (_u: string, ids: string[]) => new Set(ids)),
};
const resolver: AccountResolver = { resolve: mock(async () => ({ id: null, matchCount: 0 })) };

test("AC-4: a confident suggestion is persisted; category stays 'autre'", async () => {
  const saveSuggestion = mock(async () => ({ saved: true }));
  const categoriser: TransactionCategoriser = {
    categorise: mock(async () => ({
      category: "courses",
      confidence: 0.9,
      route: "ollama",
      failed: false,
    })),
  };
  const service = createTransactionsService({
    repository: makeRepo({ saveSuggestion }),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser,
  });
  await service.suggestCategory("u1", autreTx);
  expect(saveSuggestion).toHaveBeenCalledTimes(1);
  expect((saveSuggestion.mock.calls[0]! as unknown[])[2]).toMatchObject({
    category: "courses",
    confidence: 0.9,
  });
});

test("AC-4: an abstention (null category) persists nothing", async () => {
  const saveSuggestion = mock(async () => ({ saved: true }));
  const categoriser: TransactionCategoriser = {
    categorise: mock(async () => ({
      category: null,
      confidence: 0,
      route: "ollama",
      failed: false,
    })),
  };
  const service = createTransactionsService({
    repository: makeRepo({ saveSuggestion }),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser,
  });
  await service.suggestCategory("u1", autreTx);
  expect(saveSuggestion).toHaveBeenCalledTimes(0);
});

test("AC-4: an explicit-category transaction is never suggested", async () => {
  const categorise = mock(async () => ({
    category: "courses",
    confidence: 0.9,
    route: "ollama",
    failed: false,
  }));
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser: { categorise },
  });
  await service.suggestCategory("u1", { ...autreTx, category: "loyer" });
  expect(categorise).toHaveBeenCalledTimes(0);
});

test("AC-4: a detected transfer is never suggested", async () => {
  // A row already categorised "transfer" (the rule fired in 5-3) must not be
  // re-categorised by the LLM — symmetric with the explicit-category skip.
  const categorise = mock(async () => ({
    category: "courses",
    confidence: 0.9,
    route: "ollama",
    failed: false,
  }));
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser: { categorise },
  });
  await service.suggestCategory("u1", { ...autreTx, category: "transfer" });
  expect(categorise).toHaveBeenCalledTimes(0);
});

test("AC-6: createTransaction returns OFF the hot path — not blocked by the model call", async () => {
  // A categoriser whose call never resolves: if createTransaction awaited the
  // suggestion, this test would hang. Proves the suggestion is fire-and-forget
  // (NFR-1) and that persistence happens AFTER the create response resolves.
  let resolveCategorise: (v: {
    category: string | null;
    confidence: number;
    route: string;
    failed: boolean;
  }) => void = () => {};
  const categorise = mock(
    () =>
      new Promise<{ category: string | null; confidence: number; route: string; failed: boolean }>(
        (res) => {
          resolveCategorise = res;
        },
      ),
  );
  const saveSuggestion = mock(async () => ({ saved: true }));
  const service = createTransactionsService({
    repository: makeRepo({ saveSuggestion }),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser: { categorise },
  });
  const input: CreateTransactionInput = {
    accountId: "acc_aaa111111111111111111",
    occurredOn: "2026-05-15",
    label: "Carrefour",
    amount: 42.5,
    type: "outflow",
    category: "autre",
    isImprevu: false,
    notes: null,
  };

  // Resolves despite the model call still pending → off the hot path.
  const created = await service.createTransaction("u1", input);
  expect(created.category).toBe("autre");
  expect(categorise).toHaveBeenCalledTimes(1); // fired…
  expect(saveSuggestion).toHaveBeenCalledTimes(0); // …but not awaited on the hot path

  // Let the suggestion finish; persistence lands after the response returned.
  resolveCategorise({ category: "courses", confidence: 0.9, route: "ollama", failed: false });
  await new Promise((r) => setTimeout(r, 0));
  expect(saveSuggestion).toHaveBeenCalledTimes(1);
});

test("no categoriser wired → suggestCategory is a no-op (must not throw)", async () => {
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
  });
  await service.suggestCategory("u1", autreTx);
});
