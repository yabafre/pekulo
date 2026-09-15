// packages/contracts/src/settings/settings.contract.ts
// Settings module oRPC contract (story 8-2, extended by story 11-2). Four procedures:
//   - get:           read the caller's UserPref (getOrCreate defaults if absent).
//   - updateTheme:   persist {system|dark|light}, returns the updated pref.
//   - updateLang:    persist {fr|en}, returns the updated pref.
//   - deleteAccount: GDPR erasure (FR-50) — Bridge erasure, then every
//                    user-scoped table, then the Supabase Auth user.
// See ADR-0009 (mount under /rpc/v1/settings).
//
// deleteAccount is oRPC, unlike its sibling GET /v1/export (story 11-1) which
// is Elysia-native. The export had to be: a stream cannot travel through the
// RPC envelope. A deletion returns one small object, so it stays on the
// contract-first path and the web tier reaches it through ADR-0010's
// component -> hook -> server action triad.
import { oc } from "@orpc/contract";
import {
  deleteUserAccountInputSchema,
  deleteUserAccountResultSchema,
  updateLangInputSchema,
  updateThemeInputSchema,
  userPrefSchema,
} from "@pekulo/validators";

// Typed errors for deleteAccount. oRPC only lets a handler-thrown error reach
// the wire as a 4xx/5xx when the contract declares it; an undeclared throw
// is collapsed to 500 before the Elysia error mapper ever sees it.
const forbiddenError = {
  status: 403 as const,
  message: "confirmation email does not match the signed-in account",
};
// Same shape as the bank-aggregator contract's BANK_PROVIDER_UNAVAILABLE, so
// the web tier can branch on one code for "Bridge is down" in both modules.
const bankProviderUnavailableError = {
  status: 503 as const,
  message: "bank provider unavailable",
};
// The one state where the deletion is neither done nor untouched: every
// user-scoped row is gone, the Supabase Auth user is not. Declared so the
// web tier can name it instead of collapsing it into a generic failure.
const accountPartiallyErasedError = {
  status: 500 as const,
  message: "account data was erased but the identity could not be removed",
};

export const settingsContractV1 = {
  get: oc.output(userPrefSchema),
  updateTheme: oc.input(updateThemeInputSchema).output(userPrefSchema),
  updateLang: oc.input(updateLangInputSchema).output(userPrefSchema),
  deleteAccount: oc
    .input(deleteUserAccountInputSchema)
    .output(deleteUserAccountResultSchema)
    .errors({
      FORBIDDEN: forbiddenError,
      BANK_PROVIDER_UNAVAILABLE: bankProviderUnavailableError,
      ACCOUNT_PARTIALLY_ERASED: accountPartiallyErasedError,
    }),
} as const;

export const settingsContract = settingsContractV1;
export const settingsContractMeta = {
  moduleKey: "settings",
  mountPath: "/rpc/v1/settings",
  version: "v1",
} as const;
