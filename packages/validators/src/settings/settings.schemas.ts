// Zod source of truth for the settings (user-preference) domain. Consumed by
// @pekulo/contracts (oRPC procedure I/O) and the apps/api settings service.
// Values are iso with the Postgres enums theme_pref / lang_pref (story 8-2).
import { z } from "@pekulo/zod";

// Centralized value lists — apps/web segmented controls + apps/api service
// import these; never inline the literals (project invariant 2026-05-09).
export const THEME_VALUES = ["system", "dark", "light"] as const;
export const LANG_VALUES = ["fr", "en"] as const;

export const themePrefSchema = z.enum(THEME_VALUES);
export type ThemePref = z.infer<typeof themePrefSchema>;

export const langPrefSchema = z.enum(LANG_VALUES);
export type LangPref = z.infer<typeof langPrefSchema>;

export const userPrefSchema = z.object({
  theme: themePrefSchema,
  lang: langPrefSchema,
});
export type UserPref = z.infer<typeof userPrefSchema>;

export const updateThemeInputSchema = z.object({ theme: themePrefSchema });
export type UpdateThemeInput = z.infer<typeof updateThemeInputSchema>;

export const updateLangInputSchema = z.object({ lang: langPrefSchema });
export type UpdateLangInput = z.infer<typeof updateLangInputSchema>;
