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

export const settingsContractV1 = {
  get: oc.output(userPrefSchema),
  updateTheme: oc.input(updateThemeInputSchema).output(userPrefSchema),
  updateLang: oc.input(updateLangInputSchema).output(userPrefSchema),
  deleteAccount: oc.input(deleteUserAccountInputSchema).output(deleteUserAccountResultSchema),
} as const;

export const settingsContract = settingsContractV1;
export const settingsContractMeta = {
  moduleKey: "settings",
  mountPath: "/rpc/v1/settings",
  version: "v1",
} as const;
