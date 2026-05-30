// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (stories 5-1 + 5-2 + 5-3).
//
// Cross-aggregate guards (defense in depth, ADR-0013):
//   - AccountOwnershipProbe.exists(userId, accountId) pre-flights BEFORE
//     create (always) and BEFORE update (only when the patch carries
//     accountId — mirrors 3-1's policy). Re-applied per-row inside importCsv
//     even though the resolver in previewImportCsv already filtered.
//   - AccountResolver.resolve(userId, label) maps CSV `account-label` to an
//     account id, scoped to the calling user (RLS + explicit where).
//
// Story 5-3 — rule-based transfer detection (FR-30):
//   - categoriseAfterCreate(userId, candidate) — runs the pair-detection
//     derive ; on match, persists category="transfer" + transferPairId on
//     both rows. Eligibility: candidate.category === "autre" only (AC-4).
//   - Wired into createTransaction (post-create re-read) and importCsv
//     (per-row loop AFTER the bulkCreate commits — failures non-fatal).
//   - Lifecycle: deleteTransaction unpairs the sibling before deleting
//     (AC-11) so the orphan reverts to category=autre + transferPairId=null.
//
// Errors:
//   - ACCOUNT_NOT_FOUND  (../accounts/accounts.errors)
//   - TRANSACTION_NOT_FOUND (./transactions.errors)
//   - TRANSACTION_FAILED (bulk-insert rollback surfaced from $transaction)

import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  GetTransactionInput,
  ImportCsvInput,
  ImportCsvOutput,
  ListTransactionsInput,
  ListTransactionsOutput,
  PreviewImportCsvInput,
  PreviewImportCsvOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import { TRANSACTION_CATEGORIES } from "@pekulo/validators";
import { accountNotFound } from "../accounts/accounts.errors";
import { PekuloError } from "../../common/errors";
import { generateBase62Id } from "../../database";
import { detectTransferPair } from "../../common/derive/transfer-rule";
import { parseCsvForPreview, type AccountResolver } from "./services/csv-parser";
import { transactionNotFound } from "./transactions.errors";
import type { TransactionsRepository } from "./transactions.repository";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
  // Bulk variant — single round-trip for N ids. The CSV import path dedupes
  // row.accountIds and hands the set here instead of awaiting `exists` per row.
  existsMany(userId: string, accountIds: string[]): Promise<Set<string>>;
}

export type { AccountResolver };

/**
 * Story 5-6 T21 — input row for `importFromProvider`. The bank-aggregator
 * service translates ProviderTransaction → this shape (resolving the local
 * accountId via accounts.service.findOrCreateAutoFromProvider) before
 * delegating to TransactionsService.
 */
export interface ProviderTransactionImportRow {
  accountId: string;
  occurredOn: Date;
  label: string;
  amount: number;
  type: "inflow" | "outflow";
  category: string;
  providerTransactionId: string;
}

/**
 * Story 6-2 (FR-32) — narrow categoriser port. The runtime wires this around
 * llmModule.service.categorise (bootstrap/runtime-dependencies.ts) so the
 * transactions module never imports LlmService directly (L1 — no cross-module
 * type leak, mirrors AccountOwnershipProbe). `category` is null when the model
 * abstained or the call failed; `route` is the server route_actual.
 */
export interface TransactionCategoriser {
  categorise(input: {
    userId: string;
    label: string;
    amountSigned: number;
    occurredOn: string;
    categories: readonly string[];
  }): Promise<{ category: string | null; confidence: number; route: string }>;
}

// Categories the LLM may suggest — the closed transaction enum minus the two
// system values: 'transfer' (rule-owned, story 5-3) and 'autre' (the fallback
// the suggestion would replace).
const SUGGESTABLE_CATEGORIES: readonly string[] = TRANSACTION_CATEGORIES.filter(
  (c) => c !== "transfer" && c !== "autre",
);

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
  previewImportCsv(userId: string, input: PreviewImportCsvInput): Promise<PreviewImportCsvOutput>;
  importCsv(userId: string, input: ImportCsvInput): Promise<ImportCsvOutput>;
  // Story 5-3 — exposed on the interface so a future LLM-categorisation
  // wrapper (épic 6) can chain on top, and so tests can stub directly.
  categoriseAfterCreate(userId: string, candidate: Transaction): Promise<Transaction>;
  /**
   * Story 6-2 (FR-32) — produce + persist a pending LLM category suggestion for
   * a non-transfer, still-'autre' transaction. Awaitable (tests + callers);
   * createTransaction invokes it fire-and-forget off the hot path (NFR-1). No-op
   * when no categoriser is wired or the transaction is already categorised.
   */
  suggestCategory(userId: string, transaction: Transaction): Promise<void>;
  /**
   * Story 5-6 T21 — bulk import from a provider with dedup pre-flight on
   * (userId, provider, providerTransactionId). Runs `categoriseAfterCreate`
   * per persisted row non-fatally (warn-only), mirroring `importCsv`.
   */
  importFromProvider(
    userId: string,
    provider: string,
    rows: ProviderTransactionImportRow[],
  ): Promise<{ persisted: number; skipped: number }>;
}

function generateTransferPairId(): string {
  return `tp_${generateBase62Id(21)}`;
}

// Extracted so createTransaction + importCsv + the public method can call
// it without `this`-binding gymnastics. The service factory returns a plain
// object literal where `this` is unreliable across the closure shape.
async function categoriseAfterCreateImpl(args: {
  userId: string;
  candidate: Transaction;
  repository: TransactionsRepository;
}): Promise<Transaction> {
  const { userId, candidate, repository } = args;
  // AC-4 eligibility: only category=autre runs the rule. Explicit user
  // categories (loyer, salaire, …) ALWAYS win — no sibling lookup, no stamp.
  if (candidate.category !== "autre") return candidate;
  const siblings = await repository.findTransferPairCandidates(userId, {
    accountId: candidate.accountId,
    occurredOn: candidate.occurredOn,
    amount: candidate.amount,
    type: candidate.type,
  });
  const { pair } = detectTransferPair({ candidate, siblings });
  if (!pair) return candidate;
  const pairId = generateTransferPairId();
  const { paired } = await repository.pairAsTransfer(userId, candidate.id, pair.id, pairId);
  // F6 (aped-review) — guard against concurrent-delete race between the
  // findTransferPairCandidates lookup and the updateMany. If the sibling
  // vanished mid-window, updateMany matches only the candidate (count = 1)
  // — raise TRANSACTION_PAIR_RACE (409) so the caller can retry with a fresh
  // sibling scan. The createTransaction path lets it bubble ; importCsv's
  // per-row loop already swallows categorise failures by design.
  if (paired !== 2) {
    throw new PekuloError(
      "TRANSACTION_PAIR_RACE",
      `pairAsTransfer expected count=2, got ${paired} (candidate=${candidate.id} sibling=${pair.id})`,
    );
  }
  return { ...candidate, category: "transfer", transferPairId: pairId };
}

// Story 6-2 (FR-32) — best-effort LLM suggestion. Awaitable so tests drive it
// deterministically; createTransaction calls it fire-and-forget off the hot
// path (NFR-1). Persists only when the model returned a category with non-zero
// confidence; saveSuggestion is additionally guarded to stamp only 'autre' rows.
async function suggestCategoryImpl(args: {
  userId: string;
  transaction: Transaction;
  repository: TransactionsRepository;
  categoriser: TransactionCategoriser;
}): Promise<void> {
  const { userId, transaction, repository, categoriser } = args;
  if (transaction.category !== "autre") return;
  const amountSigned = transaction.type === "outflow" ? -transaction.amount : transaction.amount;
  const result = await categoriser.categorise({
    userId,
    label: transaction.label,
    amountSigned,
    occurredOn: transaction.occurredOn,
    categories: SUGGESTABLE_CATEGORIES,
  });
  if (!result.category || result.confidence <= 0) return;
  await repository.saveSuggestion(userId, transaction.id, {
    category: result.category,
    confidence: result.confidence,
    route: result.route,
  });
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
  categoriser?: TransactionCategoriser;
}): TransactionsService {
  return {
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound();
      const created = await deps.repository.create(userId, input);
      const categorised = await categoriseAfterCreateImpl({
        userId,
        candidate: created,
        repository: deps.repository,
      });
      // 6-2 (FR-32) — fire-and-forget LLM suggestion OFF the hot path (NFR-1):
      // the create response is never blocked by the ≤5 s Ollama call. Only when
      // the row is still 'autre' (not a detected transfer, no explicit category)
      // and a categoriser is wired. categoriseImpl records its own audit outcome
      // row, so the swallowed rejection here loses no durable signal.
      if (deps.categoriser && categorised.category === "autre") {
        const categoriser = deps.categoriser;
        void suggestCategoryImpl({
          userId,
          transaction: categorised,
          repository: deps.repository,
          categoriser,
        }).catch(() => {
          /* best-effort; the llm_call_log outcome row is the durable record */
        });
      }
      return categorised;
    },

    async updateTransaction(userId, input) {
      if (input.accountId !== undefined) {
        const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
        if (!owns) throw accountNotFound();
      }
      const outcome = await deps.repository.update(userId, input);
      if (outcome.outcome === "not-found") throw transactionNotFound(input.id);
      return outcome.transaction;
    },

    async deleteTransaction(userId, input) {
      // AC-11 — unpair the sibling BEFORE the delete. Doing the delete first
      // would leave the sibling pointing at a now-vanished pairId until the
      // second updateMany ran (window of inconsistency for any concurrent
      // read).
      const row = await deps.repository.findByIdForUser(userId, input.id);
      if (!row) throw transactionNotFound(input.id);
      if (row.transferPairId !== null) {
        await deps.repository.unpairAfterDelete(userId, row.transferPairId, input.id);
      }
      const { deleted } = await deps.repository.delete(userId, input);
      if (!deleted) throw transactionNotFound(input.id);
      return { ok: true } as const;
    },

    async getTransaction(userId, input) {
      const row = await deps.repository.findByIdForUser(userId, input.id);
      if (!row) throw transactionNotFound(input.id);
      return row;
    },

    async listTransactions(userId, input) {
      return deps.repository.listByUser(userId, input);
    },

    async previewImportCsv(userId, input) {
      return parseCsvForPreview({
        csvText: input.csvText,
        userId,
        accountResolver: deps.accountResolver,
      });
    },

    async importCsv(userId, input) {
      // 5-2 AC-8 — defense in depth: re-check every account ownership even
      // though the resolver in previewImportCsv already filtered. The client
      // could have tampered with the rows array between preview and import.
      // Bulk probe via existsMany so 1000 rows referencing K unique accounts
      // cost one round-trip, not N (aped-review N2).
      const uniqueIds = Array.from(new Set(input.rows.map((r) => r.accountId)));
      const owned = await deps.accountOwnershipProbe.existsMany(userId, uniqueIds);
      for (const id of uniqueIds) {
        if (!owned.has(id)) throw accountNotFound();
      }
      try {
        const { persisted, rows } = await deps.repository.bulkCreate(userId, input.rows);
        // 5-3 AC-3 — categorise AFTER the bulk commits. Sequential per-row
        // because pair detection depends on already-persisted siblings.
        // Failures are non-fatal: the row is still valid as autre — surface
        // via console.warn so a regression is visible but doesn't roll back
        // a committed bulk.
        for (const row of rows) {
          try {
            await categoriseAfterCreateImpl({
              userId,
              candidate: row,
              repository: deps.repository,
            });
          } catch (err) {
            console.warn(
              `[5-3] categoriseAfterCreate failed for tx ${row.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
        return { ok: true as const, persisted };
      } catch (err) {
        // Bulk-insert rollback surfaces as TRANSACTION_FAILED (mapper → 500).
        // The accountNotFound thrown by the pre-flight loop is intentionally
        // NOT caught here — it bubbles to the route handler unchanged.
        if (err instanceof PekuloError) throw err;
        throw new PekuloError(
          "TRANSACTION_FAILED",
          err instanceof Error ? err.message : "bulk insert failed",
        );
      }
    },

    async categoriseAfterCreate(userId, candidate) {
      return categoriseAfterCreateImpl({ userId, candidate, repository: deps.repository });
    },

    async suggestCategory(userId, transaction) {
      if (!deps.categoriser) return;
      await suggestCategoryImpl({
        userId,
        transaction,
        repository: deps.repository,
        categoriser: deps.categoriser,
      });
    },

    async importFromProvider(userId, provider, rows) {
      // 5-6 T21 — dedup pre-flight + bulk insert + per-row categorise (warn).
      // The bank-aggregator service has already resolved accountId via
      // accounts.service.findOrCreateAutoFromProvider, so we trust the
      // accountId column here (no ownership probe needed — auto-create
      // stamps userId on every accounts row).
      if (rows.length === 0) return { persisted: 0, skipped: 0 };
      const ids = rows.map((r) => r.providerTransactionId);
      const existing = await deps.repository.findExistingProviderTxIds(userId, provider, ids);
      const fresh = rows.filter((r) => !existing.has(r.providerTransactionId));
      if (fresh.length === 0) {
        return { persisted: 0, skipped: existing.size };
      }
      const insertRows = fresh.map((r) => ({
        accountId: r.accountId,
        occurredOn: r.occurredOn,
        label: r.label,
        amount: r.amount,
        type: r.type,
        category: r.category,
        provider,
        providerTransactionId: r.providerTransactionId,
      }));
      try {
        const {
          persisted,
          raceSkipped,
          rows: persistedRows,
        } = await deps.repository.bulkCreateFromProvider(userId, insertRows);
        for (const row of persistedRows) {
          try {
            await categoriseAfterCreateImpl({
              userId,
              candidate: row,
              repository: deps.repository,
            });
          } catch (err) {
            console.warn(
              `[5-6] categoriseAfterCreate failed for provider tx ${row.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
        // Story 5-6 FIX (post-review aped-review): the dedup pre-flight and
        // the per-row insert are non-atomic. Concurrent webhook handlers can
        // both pass the pre-flight then race the insert ; the partial UNIQUE
        // index makes the loser's row P2002 — `raceSkipped` carries that
        // count up so observers see "skipped = pre-flight-dedup + race-dedup"
        // as one number.
        return { persisted, skipped: existing.size + raceSkipped };
      } catch (err) {
        if (err instanceof PekuloError) throw err;
        throw new PekuloError(
          "TRANSACTION_FAILED",
          err instanceof Error ? err.message : "provider bulk insert failed",
        );
      }
    },
  };
}
