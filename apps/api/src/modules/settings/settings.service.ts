// Domain service for the settings module (story 8-2). Owns:
//   - get(userId):            return stored pref, or the defaults
//                             {theme:'system', lang:'fr'} when no row exists
//                             (getOrCreate semantics — no write on read).
//   - updateTheme(userId, t): persist theme, return the full updated pref.
//   - updateLang(userId, l):  persist lang, return the full updated pref.
// The service NEVER trusts the column blind — repository rows are already
// shaped to {theme,lang}; defaults are the Prisma enum defaults mirrored here.
import type { ThemePref, LangPref, UserPref } from "@pekulo/validators";
import type { SettingsRepository } from "./settings.repository";

export const DEFAULT_USER_PREF: UserPref = { theme: "system", lang: "fr" };

export interface SettingsService {
  get(userId: string): Promise<UserPref>;
  updateTheme(userId: string, theme: ThemePref): Promise<UserPref>;
  updateLang(userId: string, lang: LangPref): Promise<UserPref>;
}

export function createSettingsService(deps: { repository: SettingsRepository }): SettingsService {
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
  };
}
