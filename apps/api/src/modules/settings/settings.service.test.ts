// Service unit tests with a stubbed in-memory repository (mirrors
// milestones.service.test). AC coverage: AC-6 (getOrCreate default {system,fr}
// when no row; a stored pref round-trips back through get — the device-B read),
// AC-8 (per-user isolation — A's get never returns B's row, enforced by the
// repo's userId-keyed lookup).

import { describe, expect, test } from "bun:test";
import type { UserPref } from "@pekulo/validators";
import { isPekuloError } from "../../common/errors";
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

// The pref tests never reach deleteAccount; the three erasure ports are
// required by the factory's shape, not by their behaviour here.
const noopErasurePorts = {
  providerErasure: { eraseUser: async () => undefined },
  localData: { erase: async () => ({ rowsDeleted: {}, vaultSecretsPurged: 0 }) },
  authAdmin: { deleteUser: async () => undefined },
};

describe("settings.service", () => {
  // AC-6 (verbatim from story 8-2-theme-language-prefs:24):
  //   Given I changed theme + language on device A and the choice was persisted
  //   server-side, When I authenticate on device B with empty local storage and
  //   cookies, Then my last theme + language are applied on the first
  //   authenticated render.
  test("AC-6 — get returns the defaults {system, fr} when no row exists", async () => {
    const service = createSettingsService({ ...noopErasurePorts, repository: stubRepo() });
    expect(await service.get(USER_A)).toEqual({ theme: "system", lang: "fr" });
  });

  test("AC-6 — get returns the stored pref when a row exists (device B first read)", async () => {
    const service = createSettingsService({
      ...noopErasurePorts,
      repository: stubRepo({ [USER_A]: { theme: "dark", lang: "en" } }),
    });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "en" });
  });

  test("updateTheme persists the theme and returns the full updated pref", async () => {
    const service = createSettingsService({ ...noopErasurePorts, repository: stubRepo() });
    expect(await service.updateTheme(USER_A, "dark")).toEqual({ theme: "dark", lang: "fr" });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "fr" });
  });

  test("updateLang persists the lang and returns the full updated pref", async () => {
    const service = createSettingsService({ ...noopErasurePorts, repository: stubRepo() });
    expect(await service.updateLang(USER_A, "en")).toEqual({ theme: "system", lang: "en" });
  });

  // AC-8 (verbatim from story 8-2-theme-language-prefs:26):
  //   Given two distinct users A and B, When user A reads their preferences,
  //   Then A receives only A's preferences and never B's.
  test("AC-8 — user A's get returns only A's pref, never B's", async () => {
    const service = createSettingsService({
      ...noopErasurePorts,
      repository: stubRepo({
        [USER_A]: { theme: "dark", lang: "fr" },
        [USER_B]: { theme: "light", lang: "en" },
      }),
    });
    expect(await service.get(USER_A)).toEqual({ theme: "dark", lang: "fr" });
    expect(await service.get(USER_B)).toEqual({ theme: "light", lang: "en" });
  });
});

describe("settings.service deleteAccount (story 11-2)", () => {
  const EMAIL_A = "alex@pekulo.local";

  function harness(overrides: Partial<Record<string, unknown>> = {}) {
    const order: string[] = [];
    const service = createSettingsService({
      repository: stubRepo(),
      providerErasure: {
        eraseUser: async () => {
          order.push("provider");
        },
      },
      localData: {
        erase: async () => {
          order.push("local");
          return { rowsDeleted: { accounts: 3 }, vaultSecretsPurged: 0 };
        },
      },
      authAdmin: {
        deleteUser: async () => {
          order.push("identity");
        },
      },
      ...overrides,
    } as never);
    return { service, order };
  }

  // AC-6 (verbatim from story 11-2-account-deletion:19):
  //   […] Then the Bridge user is deleted at the provider […] before any local
  //   row is removed.
  test("AC-6 — erases at the provider, then locally, then the identity", async () => {
    const { service, order } = harness();
    const result = await service.deleteAccount(USER_A, EMAIL_A, {
      confirmationEmail: EMAIL_A,
    });
    expect(order).toEqual(["provider", "local", "identity"]);
    expect(result).toEqual({
      ok: true,
      rowsDeleted: { accounts: 3 },
      vaultSecretsPurged: 0,
    });
  });

  test("AC-6 — a provider failure aborts before a single local row is touched", async () => {
    const { service, order } = harness({
      providerErasure: {
        eraseUser: async () => {
          throw new Error("bank provider unavailable: bridge DELETE → 500");
        },
      },
    });
    expect(service.deleteAccount(USER_A, EMAIL_A, { confirmationEmail: EMAIL_A })).rejects.toThrow(
      "bank provider unavailable",
    );
    expect(order).toEqual([]);
  });

  // AC-7 (verbatim from story 11-2-account-deletion:20):
  //   […] given a confirmationEmail that does not match the session's email,
  //   Then the call is rejected with FORBIDDEN and no row is deleted, no
  //   provider call is made, and the Supabase Auth user is untouched.
  test("AC-7 — a mismatched confirmation email is FORBIDDEN and touches nothing", async () => {
    const { service, order } = harness();
    try {
      await service.deleteAccount(USER_A, EMAIL_A, { confirmationEmail: "someone@else.test" });
      throw new Error("expected deleteAccount to reject");
    } catch (err) {
      expect(isPekuloError(err) && err.code).toBe("FORBIDDEN");
    }
    expect(order).toEqual([]);
  });

  test("AC-7 — the email comparison ignores case and surrounding whitespace", async () => {
    const { service, order } = harness();
    await service.deleteAccount(USER_A, EMAIL_A, {
      confirmationEmail: `  ${EMAIL_A.toUpperCase()}  `,
    });
    expect(order).toEqual(["provider", "local", "identity"]);
  });

  test("AC-7 — a session with no email can never confirm", async () => {
    // A token without an email claim cannot prove which account it is about
    // to destroy. Fail rather than accept any string.
    const { service, order } = harness();
    try {
      await service.deleteAccount(USER_A, null, { confirmationEmail: EMAIL_A });
      throw new Error("expected deleteAccount to reject");
    } catch (err) {
      expect(isPekuloError(err) && err.code).toBe("FORBIDDEN");
    }
    expect(order).toEqual([]);
  });

  test("AC-1 — a failing identity erase is retried once before it throws", async () => {
    let attempts = 0;
    const { service, order } = harness({
      authAdmin: {
        deleteUser: async () => {
          attempts += 1;
          if (attempts === 1) throw new Error("transient");
          order.push("identity");
        },
      },
    });
    await service.deleteAccount(USER_A, EMAIL_A, { confirmationEmail: EMAIL_A });
    expect(attempts).toBe(2);
    expect(order).toEqual(["provider", "local", "identity"]);
  });

  test("AC-1 — two failing identity erases surface as INTERNAL", async () => {
    const { service } = harness({
      authAdmin: {
        deleteUser: async () => {
          throw new Error("nope");
        },
      },
    });
    try {
      await service.deleteAccount(USER_A, EMAIL_A, { confirmationEmail: EMAIL_A });
      throw new Error("expected deleteAccount to reject");
    } catch (err) {
      expect(isPekuloError(err) && err.code).toBe("INTERNAL");
    }
  });
});
