// Prisma layer for per-user preferences (story 8-2). Two methods:
//   - find(userId)               → stored pref or null
//   - upsertTheme/upsertLang     → write-through; create branch seeds the
//                                  other column's default. Returns {theme,lang}.
// Every query carries an explicit where: { userId } (ADR-0013, defence in
// depth) — the lint rule pekulo/no-prisma-query-without-user-id enforces it.
import type { ExtendedPrismaClient } from "../../database";
import type { ThemePref, LangPref, UserPref } from "@pekulo/validators";

export interface SettingsRepository {
  find(userId: string): Promise<UserPref | null>;
  upsertTheme(userId: string, theme: ThemePref): Promise<UserPref>;
  upsertLang(userId: string, lang: LangPref): Promise<UserPref>;
}

function rowToPref(row: { theme: ThemePref; lang: LangPref }): UserPref {
  return { theme: row.theme, lang: row.lang };
}

export function createSettingsRepository(deps: {
  client: ExtendedPrismaClient;
}): SettingsRepository {
  return {
    async find(userId) {
      const row = await deps.client.userPref.findUnique({
        where: { userId },
        select: { theme: true, lang: true },
      });
      return row ? rowToPref(row as { theme: ThemePref; lang: LangPref }) : null;
    },

    async upsertTheme(userId, theme) {
      const row = await deps.client.userPref.upsert({
        where: { userId },
        update: { theme, updatedAt: new Date() },
        create: { userId, theme } as unknown as Parameters<
          typeof deps.client.userPref.upsert
        >[0]["create"],
        select: { theme: true, lang: true },
      });
      return rowToPref(row as { theme: ThemePref; lang: LangPref });
    },

    async upsertLang(userId, lang) {
      const row = await deps.client.userPref.upsert({
        where: { userId },
        update: { lang, updatedAt: new Date() },
        create: { userId, lang } as unknown as Parameters<
          typeof deps.client.userPref.upsert
        >[0]["create"],
        select: { theme: true, lang: true },
      });
      return rowToPref(row as { theme: ThemePref; lang: LangPref });
    },
  };
}
