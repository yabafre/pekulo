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
  await repository.pairAsTransfer(userId, candidate.id, pair.id, pairId);
  return { ...candidate, category: "transfer", transferPairId: pairId };
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
  accountResolver: AccountResolver;
}): TransactionsService {
  return {
    async createTransaction(userId, input) {
      const owns = await deps.accountOwnershipProbe.exists(userId, input.accountId);
      if (!owns) throw accountNotFound();
      const created = await deps.repository.create(userId, input);
      // 5-3 — categorise inline. The helper short-circuits if not eligible
      // OR if no sibling matches ; on match it stamps both rows and returns
      // the candidate carrying the new tags.
      return categoriseAfterCreateImpl({
        userId,
        candidate: created,
        repository: deps.repository,
      });
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
  };
}
