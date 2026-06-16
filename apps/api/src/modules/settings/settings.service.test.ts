// Service unit tests with a stubbed in-memory repository (mirrors
// milestones.service.test). AC coverage: AC-6 (getOrCreate default {system,fr}
// when no row; a stored pref round-trips back through get — the device-B read),
// AC-8 (per-user isolation — A's get never returns B's row, enforced by the
// repo's userId-keyed lookup).

import { describe, expect, test } from "bun:test";
import type { UserPref } from "@pekulo/validators";
import { createSettingsService, DEFAULT_USER_PREF } from "./settings.service";
import type { SettingsRepository } from "./settings.repository";

const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function stubRepo(initial: Record<string, UserPref> = {}): SettingsRepository {
  const rows = new Map<string, UserPref>(Object.entries(initial));
  return {
    async find(userId) {
      return rows.get(userId) ?? null;
    },
    async upsertTheme(userId, theme) {
      const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), theme };
      rows.set(userId, next);
      return next;
    },
    async upsertLang(userId, lang) {
      const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), lang };
      rows.set(userId, next);
      return next;
    },
  };
}

describe("settings.service", () => {
  // AC-6 (verbatim from story 8-2-theme-language-prefs:24):
  //   Given I changed theme + language on device A and the choice was persisted
  //   server-side, When I authenticate on device B with empty local storage and
  //   cookies, Then my last theme + language are applied on the first
  //   authenticated render.
  test("AC-6 — get returns the defaults {system, fr} when no row exists", async () => {
    const service = createSettingsService({ repository: stubRepo() });
    expect(await service.get(USER_A)).toEqual({ theme: "system", lang: "fr" });
  });

  test("AC-6 — get returns the stored pref when a row exists (device B first read)", async () => {
    const service = createSettingsService({
      repository: stubRepo({ [USER_A]: { theme: "dark", lang: "en" } }),
    });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "en" });
  });

  test("updateTheme persists the theme and returns the full updated pref", async () => {
    const service = createSettingsService({ repository: stubRepo() });
    expect(await service.updateTheme(USER_A, "dark")).toEqual({ theme: "dark", lang: "fr" });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "fr" });
  });

  test("updateLang persists the lang and returns the full updated pref", async () => {
    const service = createSettingsService({ repository: stubRepo() });
    expect(await service.updateLang(USER_A, "en")).toEqual({ theme: "system", lang: "en" });
  });

  // AC-8 (verbatim from story 8-2-theme-language-prefs:26):
  //   Given two distinct users A and B, When user A reads their preferences,
  //   Then A receives only A's preferences and never B's.
  test("AC-8 — user A's get returns only A's pref, never B's", async () => {
    const service = createSettingsService({
      repository: stubRepo({
        [USER_A]: { theme: "dark", lang: "fr" },
        [USER_B]: { theme: "light", lang: "en" },
      }),
    });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "fr" });
    expect(await service.get(USER_B)).toEqual({ theme: "light", lang: "en" });
  });
});
