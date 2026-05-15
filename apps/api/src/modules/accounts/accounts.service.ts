// Business logic for the accounts domain. The service is the boundary that
// (a) raises AccountError("ACCOUNT_NOT_FOUND") when the repository returns
// null (cross-user attempt or stale id) and (b) wraps the FK probe + delete
// in a single $transaction so a concurrent holdings insert cannot land
// between the probe and the delete (TOCTOU). Mirrors the count-then-act
// pattern from milestones.repository.ts#addEnforcingCap.
//
// The runTx dep is the composition-root-provided transaction runner. In
// production accounts.module.ts injects it as
//   (fn) => prismaService.client.$transaction((tx) =>
//             fn(createAccountRepository({ client: tx })))
// so the FK probe + delete both run against the same tx-scoped repository.
// Tests pass `(fn) => fn(repo)` for direct invocation against the stub.

import type {
  Account,
  CreateAccountInput,
  DeleteAccountInput,
  DeleteAccountOutput,
  UpdateAccountInput,
} from "@pekulo/validators";
import { accountNotFound, accountReferencedFk } from "./accounts.errors";
import type { AccountRepository } from "./accounts.repository";

export interface AccountService {
  create(userId: string, input: CreateAccountInput): Promise<Account>;
  update(userId: string, input: UpdateAccountInput): Promise<Account>;
  delete(userId: string, input: DeleteAccountInput): Promise<DeleteAccountOutput>;
  list(userId: string): Promise<Account[]>;
}

export interface AccountServiceDeps {
  repository: AccountRepository;
  /**
   * Transaction runner. The service uses it to wrap the FK probe and the
   * delete in a single $transaction so a concurrent holdings insert cannot
   * slip past the guard. The injected `tx` is a repository scoped to the
   * transaction context.
   */
  runTx<T>(fn: (tx: AccountRepository) => Promise<T>): Promise<T>;
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
      // FK guard wrapped in a single $transaction (TOCTOU avoidance) —
      // mirrors milestones.repository.ts#addEnforcingCap (count + create).
      return deps.runTx(async (tx) => {
        const count = await tx.countHoldingsReferencing(userId, input.id);
        if (count > 0) throw accountReferencedFk(count);
        const ok = await tx.delete(userId, input.id);
        if (!ok) throw accountNotFound();
        return { ok: true as const };
      });
    },

    async list(userId) {
      return deps.repository.listByUser(userId);
    },
  };
}
