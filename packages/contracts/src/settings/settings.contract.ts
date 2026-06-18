// packages/contracts/src/settings/settings.contract.ts
// Settings module oRPC contract (story 8-2). Three procedures:
//   - get:         read the caller's UserPref (getOrCreate defaults if absent).
//   - updateTheme: persist {system|dark|light}, returns the updated pref.
//   - updateLang:  persist {fr|en}, returns the updated pref.
// See ADR-0009 (mount under /rpc/v1/settings).
import { oc } from "@orpc/contract";
import { updateLangInputSchema, updateThemeInputSchema, userPrefSchema } from "@pekulo/validators";

export const settingsContractV1 = {
  get: oc.output(userPrefSchema),
  updateTheme: oc.input(updateThemeInputSchema).output(userPrefSchema),
  updateLang: oc.input(updateLangInputSchema).output(userPrefSchema),
} as const;

export const settingsContract = settingsContractV1;
export const settingsContractMeta = {
  moduleKey: "settings",
  mountPath: "/rpc/v1/settings",
  version: "v1",
} as const;
