// Business logic for the accounts domain. The service translates repository
// outcomes (null returns, FK-probe sentinels) into typed AccountError
// instances; the error-mapper maps each code to its HTTP status.
//
// The FK-probe + delete is atomic at the repository layer
// (accounts.repository.ts#deleteWithFkProbe wraps both in a single $transaction
// — TOCTOU avoidance, mirrors milestones.repository#addEnforcingCap). The
// service consumes the discriminated outcome and never holds a transaction
// runner itself, so the composition root (accounts.module.ts) stays trivial.

import type {
  Account,
  CreateAccountInput,
  DeleteAccountInput,
  DeleteAccountOutput,
  RecordBalanceChangeInput,
  UpdateAccountInput,
} from "@pekulo/validators";
import { accountNotFound, accountReferencedFk } from "./accounts.errors";
import type { AccountRepository } from "./accounts.repository";

export interface AccountService {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, input: UpdateAccountInput): Promise<Account>;
  delete(userId: string, input: DeleteAccountInput): Promise<DeleteAccountOutput>;
  list(userId: string): Promise<Account[]>;
  recordBalanceChange(userId: string, input: RecordBalanceChangeInput): Promise<Account>;
  accountExists(userId: string, accountId: string): Promise<boolean>;
  accountsExist(userId: string, accountIds: string[]): Promise<Set<string>>;
  findAccountIdByLabel(
    userId: string,
    label: string,
  ): Promise<{ id: string | null; matchCount: number }>;
  /**
   * Story 5-6 T22 — idempotent auto-create on (userId, provider, providerAccountKey).
   * AC-7: re-completeConnection of the same Bridge item produces zero new
   * accounts rows. The bank-aggregator service calls this in completeConnection
   * (per remote account) and reuses the returned accountId during refresh
   * for transaction insertion.
   */
  findOrCreateAutoFromProvider(
    userId: string,
    provider: string,
    providerAccountKey: string,
    input: { label: string; type: Account["type"]; currency: string; cashBalance?: number },
  ): Promise<Account>;
}

export interface AccountServiceDeps {
  repository: AccountRepository;
}

export function createAccountService(deps: AccountServiceDeps): AccountService {
  return {
    async create(userId, input) {
      return deps.repository.create(userId, {
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance,
        notes: input.notes ?? null,
      });
    },

    async update(userId, input) {
      const { id, ...patch } = input;
      const updated = await deps.repository.update(userId, id, patch);
      if (!updated) throw accountNotFound();
      return updated;
    },

    async delete(userId, input) {
      const out = await deps.repository.deleteWithFkProbe(userId, input.id);
      if (out.outcome === "fk-blocked") throw accountReferencedFk(out.holdingCount);
      if (out.outcome === "not-found") throw accountNotFound();
      return { ok: true };
    },

    async list(userId) {
      return deps.repository.listByUser(userId);
    },

    async recordBalanceChange(userId, input) {
      const out = await deps.repository.recordBalanceChange(userId, {
        id: input.id,
        valuedOn: input.valuedOn,
        cashBalance: input.cashBalance,
      });
      if (out.outcome === "not-found") throw accountNotFound();
      return out.account;
    },

    async accountExists(userId, accountId) {
      return deps.repository.accountExistsForUser(userId, accountId);
    },

    async accountsExist(userId, accountIds) {
      return deps.repository.accountsExistForUser(userId, accountIds);
    },

    async findAccountIdByLabel(userId, label) {
      return deps.repository.findAccountIdByLabelForUser(userId, label);
    },

    async findOrCreateAutoFromProvider(userId, provider, providerAccountKey, input) {
      const existing = await deps.repository.findByProviderKey(
        userId,
        provider,
        providerAccountKey,
      );
      if (existing) return existing;
      return deps.repository.createAuto({
        userId,
        label: input.label,
        type: input.type,
        currency: input.currency,
        cashBalance: input.cashBalance ?? 0,
        provider,
        providerAccountKey,
      });
    },
  };
}
