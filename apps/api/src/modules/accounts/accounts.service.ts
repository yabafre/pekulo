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
    input: {
      label: string;
      type: Account["type"];
      currency: string;
      cashBalance?: number;
      providerId?: string | null;
    },
  ): Promise<Account>;
  /**
   * Story 5-6 FIX12 (2026-05-27) — look up only, no auto-create. Used by
   * the bank-aggregator refresh path to map transaction.account_id → local
   * Account.id WITHOUT creating orphans when the provider's transaction
   * endpoint returns an unknown account_id (Bridge sandbox race observed).
   */
  findByProviderKey(
    userId: string,
    provider: string,
    providerAccountKey: string,
  ): Promise<Account | null>;
  /**
   * Story 6-10 (FR-65) — the user's distinct Bridge provider_ids, used by the
   * bank-aggregator logo warm-up + backfill to resolve the tier-2 bank logo
   * (incl. IBAN accounts whose key carries no provider_id).
   */
  listProviderIds(userId: string): Promise<string[]>;
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
      // Story 5-6 FIX (post-review aped-review): the find-then-create
      // sequence is non-atomic — two concurrent completeConnection calls for
      // the same `(userId, provider, providerAccountKey)` both observe null
      // and both call createAuto. The second hits the partial UNIQUE index
      // `accounts_user_provider_key_uq` → P2002. We catch + re-read, mirroring
      // the race-safe `resolveProviderUserUuid` pattern in the bank-aggregator
      // service. If even the re-read returns null (shouldn't happen — the
      // unique index says someone won), surface the original error.
      try {
        return await deps.repository.createAuto({
          userId,
          label: input.label,
          type: input.type,
          currency: input.currency,
          cashBalance: input.cashBalance ?? 0,
          provider,
          providerAccountKey,
          providerId: input.providerId ?? null,
        });
      } catch (err) {
        const code = (err as { code?: string } | null)?.code;
        if (code === "P2002") {
          const winner = await deps.repository.findByProviderKey(
            userId,
            provider,
            providerAccountKey,
          );
          if (winner) return winner;
        }
        throw err;
      }
    },

    async findByProviderKey(userId, provider, providerAccountKey) {
      return deps.repository.findByProviderKey(userId, provider, providerAccountKey);
    },

    async listProviderIds(userId) {
      return deps.repository.listProviderIds(userId);
    },
  };
}
