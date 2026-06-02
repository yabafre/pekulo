// bun:test — backfillSuggestions + backfillAllUsers (épic 6). The categoriser
// port + repository are faked. Asserts: suggests when the model answers; stamps
// (no retry) on a clean abstention; STOPS and does NOT stamp on a transport
// failure (the safety net retries next sweep); the cross-user sweep iterates.
import { test, expect } from "bun:test";
import type { Transaction, TransactionSource } from "@pekulo/validators";
import type { TransactionsRepository } from "./transactions.repository";
import type { TransactionCategoriser } from "./transactions.service";
import { createTransactionsService } from "./transactions.service";

function tx(
  id: string,
  source: TransactionSource = "manual",
): Transaction & { source: TransactionSource } {
  return {
    id,
    accountId: "acc_1",
    occurredOn: "2026-05-15",
    label: `label ${id}`,
    amount: 12,
    type: "outflow",
    category: "autre",
    isImprevu: false,
    notes: null,
    transferPairId: null,
    suggestedCategory: null,
    suggestedConfidence: null,
    suggestedRoute: null,
    suggestedAt: null,
    createdAt: "2026-05-15T10:00:00.000Z",
    source,
  };
}

function makeService(opts: {
  backlog: (Transaction & { source: TransactionSource })[];
  categorise: TransactionCategoriser["categorise"];
}) {
  const saved: string[] = [];
  const applied: string[] = [];
  const stamped: string[] = [];
  const repo = {
    listAutreWithoutAttempt: async (_userId: string, limit: number) => opts.backlog.slice(0, limit),
    saveSuggestion: async (_u: string, txId: string) => {
      saved.push(txId);
      return { saved: true };
    },
    applySuggestedCategory: async (_u: string, txId: string) => {
      applied.push(txId);
      return { applied: true };
    },
    stampSuggestionAttempt: async (_u: string, txId: string) => {
      stamped.push(txId);
    },
    listUserIdsWithBacklog: async () => ["u1", "u2"],
  } as unknown as TransactionsRepository;
  const service = createTransactionsService({
    repository: repo,
    accountOwnershipProbe: { exists: async () => true, existsMany: async () => new Set() },
    accountResolver: { resolve: async () => ({ id: null, matchCount: 0 }) },
    categoriser: { categorise: opts.categorise },
  });
  return { service, saved, applied, stamped };
}

test("suggests for each row the model categorises", async () => {
  const { service, saved, stamped } = makeService({
    backlog: [tx("tx_1"), tx("tx_2")],
    categorise: async () => ({
      category: "courses",
      confidence: 0.8,
      route: "third_party",
      failed: false,
    }),
  });
  const counts = await service.backfillSuggestions("u1", 10);
  expect(counts).toMatchObject({ scanned: 2, suggested: 2, abstained: 0, failed: 0 });
  expect(saved).toEqual(["tx_1", "tx_2"]);
  expect(stamped).toEqual([]);
});

test("clean abstention stamps attempted (no retry), does not save", async () => {
  const { service, saved, stamped } = makeService({
    backlog: [tx("tx_1")],
    categorise: async () => ({ category: null, confidence: 0, route: "ollama", failed: false }),
  });
  const counts = await service.backfillSuggestions("u1", 10);
  expect(counts).toMatchObject({ scanned: 1, suggested: 0, abstained: 1, failed: 0 });
  expect(saved).toEqual([]);
  expect(stamped).toEqual(["tx_1"]);
});

test("transport failure STOPS the batch and stamps nothing (retried next sweep)", async () => {
  const seen: string[] = [];
  const { service, saved, stamped } = makeService({
    backlog: [tx("tx_1"), tx("tx_2"), tx("tx_3")],
    categorise: async ({ label }) => {
      seen.push(label);
      return { category: null, confidence: 0, route: "ollama", failed: true };
    },
  });
  const counts = await service.backfillSuggestions("u1", 10);
  expect(counts).toMatchObject({ scanned: 1, suggested: 0, abstained: 0, failed: 1 });
  expect(saved).toEqual([]);
  expect(stamped).toEqual([]); // unstamped → eligible again
  expect(seen).toEqual(["label tx_1"]); // stopped after the first failure
});

test("AUTO-APPLIES (not suggests) for bulk-origin rows — source csv/bridge (6-7)", async () => {
  const { service, saved, applied, stamped } = makeService({
    backlog: [tx("tx_csv", "csv"), tx("tx_bridge", "bridge")],
    categorise: async () => ({
      category: "courses",
      confidence: 0.8,
      route: "ollama",
      failed: false,
    }),
  });
  const counts = await service.backfillSuggestions("u1", 10);
  expect(counts).toMatchObject({ scanned: 2, suggested: 0, applied: 2, abstained: 0, failed: 0 });
  expect(applied).toEqual(["tx_csv", "tx_bridge"]);
  expect(saved).toEqual([]);
  expect(stamped).toEqual([]);
});

test("importCsv fires a source-aware auto-apply pass after the bulk commit (6-7)", async () => {
  const csvRow = tx("tx_csv1", "csv");
  const applied: string[] = [];
  const repo = {
    bulkCreate: async () => ({ persisted: 1, rows: [csvRow as Transaction] }),
    findTransferPairCandidates: async () => [],
    listAutreWithoutAttempt: async () => [csvRow],
    applySuggestedCategory: async (_u: string, txId: string) => {
      applied.push(txId);
      return { applied: true };
    },
    saveSuggestion: async () => ({ saved: true }),
    stampSuggestionAttempt: async () => {},
  } as unknown as TransactionsRepository;
  const service = createTransactionsService({
    repository: repo,
    accountOwnershipProbe: {
      exists: async () => true,
      existsMany: async (_u: string, ids: string[]) => new Set(ids),
    },
    accountResolver: { resolve: async () => ({ id: null, matchCount: 0 }) },
    categoriser: {
      categorise: async () => ({
        category: "courses",
        confidence: 0.8,
        route: "ollama",
        failed: false,
      }),
    },
  });
  const out = await service.importCsv("u1", {
    rows: [
      {
        occurredOn: "2026-05-15",
        amount: 12,
        type: "outflow",
        category: "autre",
        label: "label tx_csv1",
        accountId: "acc_aaa111111111111111111",
        isImprevu: false,
        notes: null,
      },
    ],
  });
  expect(out).toEqual({ ok: true, persisted: 1 });
  // Fire-and-forget: the auto-apply pass lands after importCsv resolves.
  await new Promise((r) => setTimeout(r, 0));
  expect(applied).toEqual(["tx_csv1"]);
});

test("no categoriser wired → no-op", async () => {
  const repo = {
    listAutreWithoutAttempt: async () => [tx("tx_1")],
  } as unknown as TransactionsRepository;
  const service = createTransactionsService({
    repository: repo,
    accountOwnershipProbe: { exists: async () => true, existsMany: async () => new Set() },
    accountResolver: { resolve: async () => ({ id: null, matchCount: 0 }) },
  });
  const counts = await service.backfillSuggestions("u1", 10);
  expect(counts).toEqual({ scanned: 0, suggested: 0, applied: 0, abstained: 0, failed: 0 });
});

test("backfillAllUsers sweeps each user with backlog", async () => {
  const { service } = makeService({
    backlog: [tx("tx_1")],
    categorise: async () => ({
      category: "courses",
      confidence: 0.7,
      route: "ollama",
      failed: false,
    }),
  });
  const summary = await service.backfillAllUsers(50, 50);
  expect(summary.users).toBe(2); // u1 + u2 from listUserIdsWithBacklog
  expect(summary.suggested).toBe(2); // one row each
});
