// bun:test — LLM suggestion path (story 6-2, AC-4).
import { expect, mock, test } from "bun:test";
import type { Transaction } from "@pekulo/validators";
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
    categorise: mock(async () => ({ category: "courses", confidence: 0.9, route: "ollama" })),
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
    categorise: mock(async () => ({ category: null, confidence: 0, route: "ollama" })),
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
  const categorise = mock(async () => ({ category: "courses", confidence: 0.9, route: "ollama" }));
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
    categoriser: { categorise },
  });
  await service.suggestCategory("u1", { ...autreTx, category: "loyer" });
  expect(categorise).toHaveBeenCalledTimes(0);
});

test("no categoriser wired → suggestCategory is a no-op (must not throw)", async () => {
  const service = createTransactionsService({
    repository: makeRepo(),
    accountOwnershipProbe: probe,
    accountResolver: resolver,
  });
  await service.suggestCategory("u1", autreTx);
});
