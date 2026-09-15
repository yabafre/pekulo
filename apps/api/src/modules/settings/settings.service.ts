// Domain service for the settings module (story 8-2, extended by story 11-2). Owns:
//   - get(userId):            return stored pref, or the defaults
//                             {theme:'system', lang:'fr'} when no row exists
//                             (getOrCreate semantics — no write on read).
//   - updateTheme(userId, t): persist theme, return the full updated pref.
//   - updateLang(userId, l):  persist lang, return the full updated pref.
//   - deleteAccount(...):     GDPR erasure (FR-50) — provider, then local
//                             data, then identity.
// The service NEVER trusts the column blind — repository rows are already
// shaped to {theme,lang}; defaults are the Prisma enum defaults mirrored here.
//
// deleteAccount takes PORTS, never the Prisma client: the local fan-out lives
// in settings.deletion.ts (same shape as settings.export.ts, which the service
// also does not own), and the module wires the three ports together.
import type { ThemePref, LangPref, UserPref } from "@pekulo/validators";
import type { DeleteUserAccountInput, DeleteUserAccountResult } from "@pekulo/validators";
import { PekuloError } from "../../common/errors";
import { hashUserId } from "../../common/security-primitives/hash-user-id";
import type { SettingsRepository } from "./settings.repository";
import type { LocalErasureResult } from "./settings.deletion";

export const DEFAULT_USER_PREF: UserPref = { theme: "system", lang: "fr" };

/** Erasure at the bank aggregator. Implemented by bank-aggregator's service. */
export interface ProviderErasurePort {
  eraseUser(userId: string): Promise<unknown>;
}

/** Erasure of every user-scoped Postgres row. Implemented by deleteUserData. */
export interface LocalDataErasurePort {
  erase(userId: string): Promise<LocalErasureResult>;
}

/** Erasure of the Supabase Auth user. Implemented by platform/auth. */
export interface IdentityErasurePort {
  deleteUser(userId: string): Promise<void>;
}

export interface SettingsService {
  get(userId: string): Promise<UserPref>;
  updateTheme(userId: string, theme: ThemePref): Promise<UserPref>;
  updateLang(userId: string, lang: LangPref): Promise<UserPref>;
  /**
   * FR-50. `sessionEmail` is the email claim on the VERIFIED JWT — the caller
   * must name the account it is destroying, and only the server can check it.
   */
  deleteAccount(
    userId: string,
    sessionEmail: string | null,
    input: DeleteUserAccountInput,
  ): Promise<DeleteUserAccountResult>;
}

// One retry, short: a transient Supabase blip should not leave the account in
// the "data gone, login still works" state, and two failures in 250 ms is a
// real outage rather than a hiccup. Exported so settings.deletion-budget.test.ts
// can add it into the NFR-7 sum.
export const IDENTITY_RETRY_DELAY_MS = 250;
export const IDENTITY_ERASE_ATTEMPTS = 2;

function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertConfirmation(sessionEmail: string | null, typed: string): void {
  // A token with no email claim cannot prove which account it names. Refusing
  // is the only safe branch: accepting any string here would turn the
  // confirmation into decoration.
  if (!sessionEmail || !sessionEmail.trim()) {
    throw new PekuloError("FORBIDDEN", "session carries no email; cannot confirm deletion");
  }
  if (normaliseEmail(sessionEmail) !== normaliseEmail(typed)) {
    throw new PekuloError("FORBIDDEN", "confirmation email does not match the signed-in account");
  }
}

async function eraseIdentity(port: IdentityErasurePort, userId: string): Promise<void> {
  // Driven by the constant the budget test sums, so the two cannot drift.
  let lastError: unknown;
  for (let attempt = 1; attempt <= IDENTITY_ERASE_ATTEMPTS; attempt += 1) {
    try {
      await port.deleteUser(userId);
      return;
    } catch (err) {
      lastError = err;
      if (attempt < IDENTITY_ERASE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, IDENTITY_RETRY_DELAY_MS));
      }
    }
  }
  // The data is already gone; only the account shell remains. This log line
  // is what lets the controller finish the job by hand, so it must identify
  // the account — as a hash (architecture.md forbids the raw id in any log):
  // hash the id you suspect and compare. The typed code, not INTERNAL, is
  // what lets the client say the truth: erased, not closed, retry or write.
  console.error(
    JSON.stringify({
      event: "account_deletion.identity_erase_failed",
      userIdHash: hashUserId(userId),
      reasonClass: lastError instanceof Error ? lastError.constructor.name : typeof lastError,
    }),
  );
  throw new PekuloError(
    "ACCOUNT_PARTIALLY_ERASED",
    "account data was erased but the identity could not be removed",
    { cause: lastError },
  );
}

export function createSettingsService(deps: {
  repository: SettingsRepository;
  providerErasure: ProviderErasurePort;
  localData: LocalDataErasurePort;
  authAdmin: IdentityErasurePort;
}): SettingsService {
  return {
    async get(userId) {
      const stored = await deps.repository.find(userId);
      return stored ?? { ...DEFAULT_USER_PREF };
    },
    async updateTheme(userId, theme) {
      return deps.repository.upsertTheme(userId, theme);
    },
    async updateLang(userId, lang) {
      return deps.repository.upsertLang(userId, lang);
    },

    async deleteAccount(userId, sessionEmail, input) {
      assertConfirmation(sessionEmail, input.confirmationEmail);

      // ORDER IS LOAD-BEARING — do not reorder these three steps.
      //
      // 1. The provider FIRST, and fail-closed on it. Bridge holds the user's
      //    bank data; if we cannot reach it, nothing local is touched and the
      //    user retries with their session intact. Erasing locally first would
      //    destroy the bridge_users mapping that any later Bridge-side erasure
      //    needs, leaving the data at the AISP with no way to finish.
      await deps.providerErasure.eraseUser(userId);

      // 2. The data, in one transaction.
      const { rowsDeleted, vaultSecretsPurged } = await deps.localData.erase(userId);

      // 3. The identity LAST. If this fails the user is left with an empty but
      //    signable-into account — degraded, loudly logged, and RETRYABLE: a
      //    second confirmation skips the provider (no bridge_users row left),
      //    deletes nothing locally, and tries the identity again. Erasing the
      //    identity first and then failing at step 2 would strand orphan rows
      //    with no session left to retry from: worse, and silent.
      await eraseIdentity(deps.authAdmin, userId);

      return { ok: true as const, rowsDeleted, vaultSecretsPurged };
    },
  };
}
