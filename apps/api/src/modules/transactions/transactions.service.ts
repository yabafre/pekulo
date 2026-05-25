// apps/api/src/modules/transactions/transactions.service.ts
// Business logic for the transactions domain (story 5-1).
//
// Cross-aggregate guard: AccountOwnershipProbe.exists(userId, accountId)
// pre-flights BEFORE create (always) and BEFORE update (only when the patch
// includes accountId — mirrors 3-1's pre-flight policy).
//
// Errors:
//   - ACCOUNT_NOT_FOUND  (from ../accounts/accounts.errors)
//   - TRANSACTION_NOT_FOUND (from ./transactions.errors)

import type {
  CreateTransactionInput,
  DeleteTransactionInput,
  GetTransactionInput,
  ListTransactionsInput,
  ListTransactionsOutput,
  Transaction,
  UpdateTransactionInput,
} from "@pekulo/validators";
import { accountNotFound } from "../accounts/accounts.errors";
import { transactionNotFound } from "./transactions.errors";
import type { TransactionsRepository } from "./transactions.repository";

export interface AccountOwnershipProbe {
  exists(userId: string, accountId: string): Promise<boolean>;
}

export interface TransactionsService {
  createTransaction(userId: string, input: CreateTransactionInput): Promise<Transaction>;
  updateTransaction(userId: string, input: UpdateTransactionInput): Promise<Transaction>;
  deleteTransaction(userId: string, input: DeleteTransactionInput): Promise<{ ok: true }>;
  getTransaction(userId: string, input: GetTransactionInput): Promise<Transaction>;
  listTransactions(userId: string, input: ListTransactionsInput): Promise<ListTransactionsOutput>;
}

export function createTransactionsService(deps: {
  repository: TransactionsRepository;
  accountOwnershipProbe: AccountOwnershipProbe;
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
  };
}
