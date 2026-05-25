// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (stories 5-1 + 5-2).
//
// Cross-aggregate guards (defense in depth, ADR-0013):
//   - AccountOwnershipProbe.exists(userId, accountId) pre-flights BEFORE
//     create (always) and BEFORE update (only when the patch carries
//     accountId — mirrors 3-1's policy). Re-applied per-row inside importCsv
//     even though the resolver in previewImportCsv already filtered.
//   - AccountResolver.resolve(userId, label) maps CSV `account-label` to an
//     account id, scoped to the calling user (RLS + explicit where).
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
import { parseCsvForPreview, type AccountResolver } from "./services/csv-parser";
import { transactionNotFound } from "./transactions.errors";
import type { TransactionsRepository } from "./transactions.repository";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
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
      return deps.repository.create(userId, input);
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
      // AC-8 — defense in depth: re-check every account ownership even though
      // the resolver in previewImportCsv already filtered. The client could
      // have tampered with the rows array between preview and import.
      for (const row of input.rows) {
        const owns = await deps.accountOwnershipProbe.exists(userId, row.accountId);
        if (!owns) throw accountNotFound();
      }
      try {
        const { persisted } = await deps.repository.bulkCreate(userId, input.rows);
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
  };
}
