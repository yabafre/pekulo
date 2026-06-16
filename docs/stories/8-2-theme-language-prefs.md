# Story: 8-2-theme-language-prefs — Theme + language preferences (full i18n + server-persisted)

**Epic:** Epic 8 — Auth & preferences
**Status:** ready-for-dev
**Ticket:** [#43](https://github.com/yabafre/pekulo/issues/43)
**Branch:** feature/43-8-2-theme-language-prefs
**Commit prefix:** `feat(#43): …` (or `test(#43):` / `chore(#43):` per change type)

## User Story

**As a** Pekulo user, **I want** to switch the UI theme (system/dark/light) and language (FR/EN) from Paramètres, with the choice persisted across sessions and devices and the entire UI actually rendering in the chosen language, **so that** Pekulo follows my preferences everywhere.

**Covered FRs:** FR-51 (theme), FR-52 (language).

> **Scope note (XL).** This story bundles three subsystems: (1) a server-persisted `UserPref` (Prisma + `settings` oRPC module), (2) a **full i18n** stack (next-intl, no-i18n-routing / cookie locale) with an app-wide string sweep, and (3) the Apparence settings UI. The user explicitly chose to keep full i18n + light-theme registration inside 8-2 (design gate 2026-06-16). Land it in the **sub-lots** below — each sub-lot ends green and committable.

## Acceptance Criteria

- **AC-1 (theme persist)** — **Given** the default theme, **When** I select « Sombre » in Paramètres › Apparence then reload the page, **Then** `<html data-theme="pekulo-dark">` and the UI renders dark (persisted via `@tamagui/next-theme` localStorage `theme=dark`).
- **AC-2 (light registered)** — **Given** I select « Clair », **When** the theme applies, **Then** `pekulo-light` is a **registered, active** Tamagui theme (`<html data-theme="pekulo-light">`, no fallback to `pekulo-dark`) and the surface renders in light tokens.
- **AC-3 (system)** — **Given** « Système », **When** the OS `prefers-color-scheme` is light vs dark, **Then** the UI follows the OS (`window.matchMedia('(prefers-color-scheme: dark)')`).
- **AC-4 (live language switch)** — **Given** FR active, **When** I select « English » in Apparence, **Then** the strings on the current page re-render in English without a full page reload, and the `NEXT_LOCALE=en` cookie is set.
- **AC-5 (SSR locale)** — **Given** EN was chosen, **When** I reload any route, **Then** the server-rendered HTML is already English on first paint (no French flash before hydration).
- **AC-6 (cross-device)** — **Given** I changed theme + language on device A and the choice was persisted server-side, **When** I authenticate on device B with empty local storage and cookies, **Then** my last theme + language are applied on the first authenticated render.
- **AC-7 (RLS — singleton table)** — **Given** the persisted-preferences table, **When** its row-level security is audited, **Then** RLS is enabled with **exactly 3 policies — SELECT, INSERT, UPDATE — each scoped so a user can only read or write their own row, and no DELETE policy exists**.
- **AC-8 (tenant isolation)** — **Given** two distinct users A and B, **When** user A reads their preferences, **Then** A receives only A's preferences and never B's.

## Tasks

> Test runners differ per package: **`apps/api` uses `bun test`** (bun-native; import from `"bun:test"`), **`apps/web` uses `vitest run`**. Always quote the workspace name: `bun --filter='@pekulo/api' …` (lesson 2026-05-19). `tsc` is NOT in the commit gate (lesson 2026-06-01) — run the typecheck command in each task before committing.

**Sub-lot A — Data layer (`UserPref` + enums + migration + RLS)**

- [ ] **T1 — Add `ThemePref` + `LangPref` enums.** [AC: AC-1, AC-4]
  Append to `apps/api/prisma/schema/enums.prisma`:
  ```prisma
  // User-preference enums (story 8-2, FR-51 / FR-52). All identifiers are
  // already snake/lower (Postgres enum identifiers reject hyphens). The API/UI
  // surface uses the same literal values (no kebab mapping needed).
  enum ThemePref {
    system
    dark
    light

    @@map("theme_pref")
  }

  enum LangPref {
    fr
    en

    @@map("lang_pref")
  }
  ```
  Run: `bun --filter='@pekulo/api' run prisma:format && bun --filter='@pekulo/api' run prisma:validate`
  Expected: `The schema at …/schema is valid 🚀`, exit 0.
  Commit: `git add apps/api/prisma/schema/enums.prisma && git commit -m "feat(#43): add ThemePref + LangPref enums"`

- [ ] **T2 — Add the `UserPref` model (per-user singleton).** [AC: AC-6, AC-7, AC-8]
  Create `apps/api/prisma/schema/settings.prisma` (mirror of `dashboard.prisma` — PK is `user_id`, one row per user):
  ```prisma
  // apps/api/prisma/schema/settings.prisma
  // Per-user UI preferences (story 8-2 / FR-51 / FR-52). One row per user
  // (userId is the PK — a user has exactly one pref row). theme/lang are
  // Postgres enums (theme_pref / lang_pref). RLS (SELECT/INSERT/UPDATE where
  // user_id = auth.uid()) is appended to the migration SQL manually — Prisma
  // does not introspect policies (ADR-0013). No DELETE policy: a pref reset
  // overwrites via UPDATE; row removal happens only via cascade from
  // auth.users (account deletion, story 11-2). Same shape as DashboardLayout.
  model UserPref {
    userId    String    @id @map("user_id") @db.Uuid
    theme     ThemePref @default(system)
    lang      LangPref  @default(fr)
    updatedAt DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
    createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz

    @@map("user_pref")
  }
  ```
  Run: `bun --filter='@pekulo/api' run prisma:format && bun --filter='@pekulo/api' run prisma:validate`
  Expected: schema valid, exit 0.
  Commit: `git add apps/api/prisma/schema/settings.prisma && git commit -m "feat(#43): add UserPref model (per-user singleton)"`

- [ ] **T3 — Register `UserPref` as a prefixed-ID opt-out.** [AC: AC-8]
  In `apps/api/src/database/id-prefixes.config.ts`, add this entry to `ID_PREFIXES` (after the `DashboardLayout: null` line, before the closing `} as const satisfies …`):
  ```ts
    // UserPref (story 8-2, FR-51/FR-52) — PK is `user_id` (UUID FK to
    // auth.users), one row per user, no synthetic id column. Same opt-out
    // shape as DashboardLayout: the prefixed-ids extension MUST NOT inject,
    // or the getOrCreate upsert's create branch throws MissingPrefixError.
    UserPref: null,
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/api/src/database/id-prefixes.config.ts && git commit -m "feat(#43): register UserPref prefixed-id opt-out"`

- [ ] **T4 — Generate the migration + hand-append the 3 RLS policies.** [AC: AC-7]
  1. Generate: `bun --filter='@pekulo/api' run prisma:migrate:dev -- --name create_user_pref` (creates `apps/api/prisma/migrations/<timestamp>_create_user_pref/migration.sql` + the `theme_pref` / `lang_pref` enum DDL).
  2. **Append** the RLS block to the bottom of that generated `migration.sql` (mirror of `dashboard_layout` — SELECT/INSERT/UPDATE only, no DELETE):
  ```sql
  -- RLS policies (manually appended — Prisma does not introspect policies, ADR-0013).
  -- user_pref is a per-user singleton (one row/user): SELECT/INSERT/UPDATE scoped
  -- to the owner. No DELETE policy — a pref reset overwrites via UPDATE; row removal
  -- happens only via cascade from auth.users (account deletion, story 11-2).
  ALTER TABLE "user_pref" ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "user_pref_select_own" ON "user_pref"
    FOR SELECT USING (user_id = auth.uid());
  CREATE POLICY "user_pref_insert_own" ON "user_pref"
    FOR INSERT WITH CHECK (user_id = auth.uid());
  CREATE POLICY "user_pref_update_own" ON "user_pref"
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  ```
  3. Re-apply so the appended SQL runs: `bun --filter='@pekulo/api' run prisma:migrate:dev` (no-op name prompt → accept) **or** apply manually against the dev DB, then audit.
  Run: `bun --filter='@pekulo/api' run db:rls-audit`
  Expected: audit passes; `user_pref` reported with exactly 3 policies (SELECT/INSERT/UPDATE), exit 0.
  Commit: `git add apps/api/prisma/migrations && git commit -m "feat(#43): create user_pref migration + RLS (3 policies, no delete)"`

**Sub-lot B — Validators + contract**

- [ ] **T5 — Add the settings validators.** [AC: AC-1, AC-4, AC-8]
  Create `packages/validators/src/settings/settings.schemas.ts`:
  ```ts
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
  ```
  Create `packages/validators/src/settings/index.ts`:
  ```ts
  export * from "./settings.schemas";
  ```
  Then add this line to `packages/validators/src/index.ts` (next to the other module re-exports — read the file first, keep alphabetical-ish grouping):
  ```ts
  export * from "./settings";
  ```
  Run: `bun --filter='@pekulo/validators' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add packages/validators/src/settings packages/validators/src/index.ts && git commit -m "feat(#43): settings validators (theme/lang prefs)"`

- [ ] **T6 — Fill the settings oRPC contract.** [AC: AC-1, AC-4, AC-6]
  Replace the body of `packages/contracts/src/settings/settings.contract.ts` (it is currently an empty scaffold — keep the existing `settingsContractMeta`, replace `settingsContractV1`):
  ```ts
  // packages/contracts/src/settings/settings.contract.ts
  // Settings module oRPC contract (story 8-2). Three procedures:
  //   - get:         read the caller's UserPref (getOrCreate defaults if absent).
  //   - updateTheme: persist {system|dark|light}, returns the updated pref.
  //   - updateLang:  persist {fr|en}, returns the updated pref.
  // See ADR-0009 (mount under /rpc/v1/settings).
  import { oc } from "@orpc/contract";
  import {
    updateLangInputSchema,
    updateThemeInputSchema,
    userPrefSchema,
  } from "@pekulo/validators";

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
  ```
  Run: `bun --filter='@pekulo/contracts' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add packages/contracts/src/settings/settings.contract.ts && git commit -m "feat(#43): settings oRPC contract (get/updateTheme/updateLang)"`

**Sub-lot C — `settings` API module (mirror of `milestones`/`dashboard`)**

- [ ] **T7 — Settings errors + repository.** [AC: AC-6, AC-8]
  Create `apps/api/src/modules/settings/settings.errors.ts`:
  ```ts
  // Typed error class for the settings module. Extends PekuloError so the
  // Elysia error mapper translates it to an oRPC error with the matching HTTP
  // status. story 8-2.
  import { PekuloError } from "../../common/errors";

  export type SettingsErrorCode = "SETTINGS_NOT_FOUND";

  export class SettingsError extends PekuloError {
    override readonly name = "SettingsError";

    // oxlint-disable-next-line no-useless-constructor -- narrows code union
    constructor(code: SettingsErrorCode, message: string, options?: { cause?: unknown }) {
      super(code, message, options);
    }
  }
  ```
  Create `apps/api/src/modules/settings/settings.repository.ts` (mirror `dashboard-layout.repository.ts` — `find` + `upsert`, every query carries explicit `where: { userId }`):
  ```ts
  // Prisma layer for per-user preferences (story 8-2). Two methods:
  //   - find(userId)               → stored pref or null
  //   - upsert(userId, patch)      → write-through; create branch seeds the
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
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.errors.ts apps/api/src/modules/settings/settings.repository.ts && git commit -m "feat(#43): settings repository (per-user upsert)"`

- [ ] **T8 — Settings service.** [AC: AC-6, AC-8]
  Create `apps/api/src/modules/settings/settings.service.ts`:
  ```ts
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

  export function createSettingsService(deps: {
    repository: SettingsRepository;
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
    };
  }
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.service.ts && git commit -m "feat(#43): settings service (get/updateTheme/updateLang)"`

- [ ] **T9 — Settings routes + module factory.** [AC: AC-6, AC-8]
  Create `apps/api/src/modules/settings/settings.routes.ts` (mirror `milestones.routes.ts` — `implement(contract).$context<…>()` + `requireUserId`):
  ```ts
  // oRPC handlers for the settings module (story 8-2). Each handler reads
  // { userId } from the oRPC context (injected by mountOrpc after JWT
  // verification) and delegates to the service. Throws PekuloError on missing
  // context — the Elysia error mapper translates it to a 401.
  import { implement } from "@orpc/server";
  import { settingsContract } from "@pekulo/contracts";
  import { PekuloError } from "../../common/errors";
  import type { SettingsService } from "./settings.service";

  const impl = implement(settingsContract).$context<{
    userId: string;
    email: string | null;
  }>();

  function requireUserId(userId: string | undefined): asserts userId is string {
    if (!userId || !userId.trim()) {
      throw new PekuloError("UNAUTHORIZED", "user context missing");
    }
  }

  export function createSettingsRouter(deps: { service: SettingsService }) {
    return impl.router({
      get: impl.get.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.service.get(context.userId);
      }),
      updateTheme: impl.updateTheme.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.updateTheme(context.userId, input.theme);
      }),
      updateLang: impl.updateLang.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.updateLang(context.userId, input.lang);
      }),
    });
  }
  ```
  Create `apps/api/src/modules/settings/settings.module.ts` (mirror `milestones.module.ts` — `ReturnType<typeof createSettingsRouter>`, never annotate the concrete oRPC type):
  ```ts
  // Module factory wiring repository + service + router for the settings
  // domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
  // L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
  // never annotate as `Elysia` or any concrete oRPC implementation type.
  import type { PrismaService } from "../../database";
  import { createSettingsRepository } from "./settings.repository";
  import { createSettingsService, type SettingsService } from "./settings.service";
  import { createSettingsRouter } from "./settings.routes";

  export interface SettingsModule {
    service: SettingsService;
    router: ReturnType<typeof createSettingsRouter>;
  }

  export function createSettingsModule(deps: {
    prismaService: PrismaService;
  }): SettingsModule {
    const repository = createSettingsRepository({ client: deps.prismaService.client });
    const service = createSettingsService({ repository });
    const router = createSettingsRouter({ service });
    return { service, router };
  }
  ```
  Run: `bun --filter='@pekulo/api' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.routes.ts apps/api/src/modules/settings/settings.module.ts && git commit -m "feat(#43): settings routes + module factory"`

- [ ] **T10 — Mount the settings module in the oRPC router.** [AC: AC-6]
  In `apps/api/src/bootstrap/runtime-dependencies.ts`:
  1. Add the import alongside the other `createXxxModule` imports:
  ```ts
  import { createSettingsModule } from "../modules/settings/settings.module";
  ```
  2. Instantiate it next to the other module factories (it only needs `prismaService`):
  ```ts
  const settingsModule = createSettingsModule({ prismaService });
  ```
  3. Add it to the `orpcRouter` object (the assembly currently lists 11 modules — append `settings`):
  ```ts
    llm: llmModule.router,
    settings: settingsModule.router,
  };
  ```
  Run: `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/api' run test src/modules/settings`
  Expected: typecheck clean; bun test prints `… pass`, exit 0 (after T11 lands the tests).
  Commit: `git add apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#43): mount settings module under /rpc/v1/settings"`

- [ ] **T11 — Settings service + integration tests.** [AC: AC-6, AC-7, AC-8]
  Create `apps/api/src/modules/settings/settings.service.test.ts` using `bun:test` (mirror the structure of `milestones.service.test.ts`): cover `get` returns `{theme:'system', lang:'fr'}` when the repository finds nothing (AC-6 default), `updateTheme` / `updateLang` delegate to the repository and return the upserted pref. Mock the repository with an in-memory object.
  Create `apps/api/src/modules/settings/settings.integration.test.ts` (mirror `dashboard.integration.test.ts`): exercise the real repository against the test DB — assert a second user's `get` never returns the first user's row (AC-8), and that `updateTheme` then `get` round-trips (AC-6).
  > Use `import { describe, it, expect } from "bun:test";` — apps/api runs the **bun-native** test runner, not vitest.
  Run: `bun --filter='@pekulo/api' run test src/modules/settings`
  Expected: `… pass, 0 fail`, exit 0.
  Commit: `git add apps/api/src/modules/settings/settings.service.test.ts apps/api/src/modules/settings/settings.integration.test.ts && git commit -m "test(#43): settings service + integration (isolation, defaults)"`

**Sub-lot D — i18n framework (next-intl, cookie locale, no i18n-routing)**

> **Before writing any next-intl code:** pin the version with `npm view next-intl dist-tags` (memory: verify versions via npm directly, not Context7) and confirm the **App-Router / no-i18n-routing / cookie** setup against Context7 (`mcp__context7__query-docs` for `next-intl`) **and** `node_modules/next/dist/docs/` (apps/web/AGENTS.md — this Next.js has breaking changes vs training data). next-intl must be compatible with Next 16.2.9 + Turbopack (`apps/web/next.config.ts` runs Turbopack with `resolveAlias`).

- [ ] **T12 — Install + configure next-intl.** [AC: AC-4, AC-5]
  1. Install (exact version from the dist-tag check): `bun add --cwd apps/web next-intl@<latest>` (memory: `bun add --filter` targets root — use `--cwd apps/web`).
  2. Create `apps/web/src/i18n/request.ts` (cookie-driven locale, no routing segment):
  ```ts
  // apps/web/src/i18n/request.ts
  // next-intl request config — NO i18n routing. The active locale is read from
  // the NEXT_LOCALE cookie (set by the Apparence lang control + the login
  // hydrator). Defaults to 'fr' (the app's source language). story 8-2.
  import { getRequestConfig } from "next-intl/server";
  import { cookies } from "next/headers";
  import { LANG_VALUES } from "@pekulo/validators";

  const DEFAULT_LOCALE = "fr";

  export default getRequestConfig(async () => {
    const cookie = (await cookies()).get("NEXT_LOCALE")?.value;
    const locale =
      cookie && (LANG_VALUES as readonly string[]).includes(cookie) ? cookie : DEFAULT_LOCALE;
    return {
      locale,
      messages: (await import(`../../messages/${locale}.json`)).default,
    };
  });
  ```
  3. Wrap the Next config with the next-intl plugin in `apps/web/next.config.ts` — import at the top and wrap the export (keep the whole existing `nextConfig` object intact):
  ```ts
  import createNextIntlPlugin from "next-intl/plugin";
  // …existing nextConfig object unchanged…
  const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
  export default withNextIntl(nextConfig);
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/package.json apps/web/src/i18n/request.ts apps/web/next.config.ts && git commit -m "feat(#43): wire next-intl (cookie locale, no routing)"`

- [ ] **T13 — Seed message catalogs + provider + dynamic `<html lang>`.** [AC: AC-4, AC-5]
  1. Create `apps/web/messages/fr.json` and `apps/web/messages/en.json` seeded with the Settings + Auth keys (the sweep in Sub-lot G grows these). Start with:
  ```json
  {
    "settings": {
      "appearance": { "title": "Apparence", "theme": "Thème", "language": "Langue" },
      "theme": { "system": "Système", "dark": "Sombre", "light": "Clair" },
      "lang": { "fr": "Français", "en": "English" }
    },
    "auth": {
      "signInError": { "badCredentials": "Email ou mot de passe incorrect", "generic": "Connexion impossible. Réessaie plus tard." },
      "signUpError": "Inscription refusée. Réessaie.",
      "signOutError": "Déconnexion impossible. Réessaie.",
      "passwordUpdateError": "Impossible de mettre à jour le mot de passe. Réessaie.",
      "emailInvalid": "Email invalide"
    }
  }
  ```
  …and the parallel `en.json` (same keys, English values: `"Appearance"`, `"Theme"`, `"Language"`, `"System"`, `"Dark"`, `"Light"`, `"French"`, `"English"`, `"Incorrect email or password"`, etc.).
  2. Wrap the client tree in `NextIntlClientProvider` and make `<html lang>` dynamic in `apps/web/src/app/layout.tsx`. Add the imports, fetch `locale`/`messages` in the async `RootLayout`, set `lang={locale}`, and wrap `<Providers>`:
  ```tsx
  import { NextIntlClientProvider } from "next-intl";
  import { getLocale, getMessages } from "next-intl/server";
  // …inside RootLayout, after the nonce line:
  const locale = await getLocale();
  const messages = await getMessages();
  // …<html lang={locale} suppressHydrationWarning>… and in <body>:
  //   <NextIntlClientProvider locale={locale} messages={messages}>
  //     <NuqsAdapter><Providers>{children}</Providers></NuqsAdapter>
  //   </NextIntlClientProvider>
  ```
  > Keep the existing anti-FOUC `<script>` exactly as-is — theme persistence is unchanged. Only `lang` + the provider wrapper change here.
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/messages apps/web/src/app/layout.tsx && git commit -m "feat(#43): seed catalogs + NextIntlClientProvider + dynamic html lang"`

**Sub-lot E — Theme registration**

- [ ] **T14 — Register `pekulo-light` in the Tamagui config.** [AC: AC-2]
  In `packages/ui/src/config/tamagui.ts`: import `pekuloLight` and add it to `themes`. Update the header note. The provider already declares `themes={["pekulo-light", "pekulo-dark"]}` (`packages/ui/src/provider/index.tsx`), so this closes the registration gap.
  ```ts
  import { pekuloDark } from "../themes/pekulo-dark";
  import { pekuloLight } from "../themes/pekulo-light";
  // …
    themes: {
      "pekulo-dark": pekuloDark,
      "pekulo-light": pekuloLight,
    },
  ```
  Then rebuild the UI package's generated CSS so `data-theme="pekulo-light"` selectors are emitted: `bun --filter='@pekulo/ui' run build` (or the package's CSS-gen script — read `packages/ui/package.json` scripts first).
  > **Known risk (design gate):** the `@tamagui/cli` rc.41 selector-emission bug may drop the second custom theme's selectors. **Verify** after build: `grep -c 'pekulo-light' packages/ui/generated.css` must be > 0. If the bug bites (0 matches / light renders as dark), STOP and report — fall back to a 2-option control (Système/Sombre) and open a follow-up; do NOT ship an inert « Clair » option silently. Verify the installed `@tamagui/cli` version first (`npm view @tamagui/cli dist-tags`; a post-rc.41 fix may already exist).
  Run: `bun --filter='@pekulo/ui' run typecheck && grep -c 'pekulo-light' packages/ui/generated.css`
  Expected: typecheck clean; grep count > 0.
  Commit: `git add packages/ui/src/config/tamagui.ts packages/ui/generated.css && git commit -m "feat(#43): register pekulo-light theme (AC-2)"`

**Sub-lot F — Apparence UI + actions + cross-device hydration**

- [ ] **T15 — Web settings client + server actions + cache tags.** [AC: AC-4, AC-6]
  1. Add the settings client to `apps/web/src/lib/orpc/modules.ts` (import `settingsContract`, export `settingsClient` with `path: ["settings"]` — mirror the existing exports):
  ```ts
  import { /* …existing… */ settingsContract } from "@pekulo/contracts";
  // …
  // Story 8-2 — user preferences (theme/lang). Mount path `/rpc/v1/settings`.
  export const settingsClient: ContractRouterClient<typeof settingsContract> = createORPCClient(
    orpcLink,
    { path: ["settings"] },
  );
  ```
  2. Add settings keys/tags to `apps/web/src/lib/zapaction/keys.ts` (mirror `compassKeys`/`compassTags` + the `setTagRegistry` edge at the bottom of the file):
  ```ts
  export const settingsKeys = createFeatureKeys("settings", {
    current: () => ["current"] as const,
  });
  export const settingsTags = createFeatureTags("settings", {
    current: () => ["current"] as const,
  });
  ```
  3. Create `apps/web/src/app/(cap)/dashboard/_appearance/_actions/settings-actions.ts` (mirror `_compass/_actions/compass-actions.ts` — `defineAction` + `settingsClient` + `ensureRequestContext`; the lang action also sets the `NEXT_LOCALE` cookie so SSR re-renders in the new locale):
  ```ts
  "use server";

  import { cookies } from "next/headers";
  import { defineAction } from "@zapaction/core";
  import { z } from "@pekulo/zod";
  import {
    updateLangInputSchema,
    updateThemeInputSchema,
    type UserPref,
  } from "@pekulo/validators";
  import { settingsClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import { settingsTags } from "@/lib/zapaction/keys";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  // Story 8-2 — thin oRPC delegators (ADR-0010 hard layering; zero business
  // logic on the web tier). No cross-feature action import.
  export const getSettings = defineAction<void, UserPref, ActionContext>({
    name: "getSettings",
    input: z.void(),
    handler: async () => {
      await ensureRequestContext();
      return settingsClient.get();
    },
  });

  export const updateTheme = defineAction<z.infer<typeof updateThemeInputSchema>, UserPref, ActionContext>({
    name: "updateTheme",
    input: updateThemeInputSchema,
    invalidates: [settingsTags.current()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      return settingsClient.updateTheme(input);
    },
  });

  export const updateLang = defineAction<z.infer<typeof updateLangInputSchema>, UserPref, ActionContext>({
    name: "updateLang",
    input: updateLangInputSchema,
    invalidates: [settingsTags.current()],
    handler: async ({ input }) => {
      await ensureRequestContext();
      const pref = await settingsClient.updateLang(input);
      // SSR locale source — getRequestConfig reads this cookie (T12). 1-year maxAge.
      (await cookies()).set("NEXT_LOCALE", input.lang, { path: "/", maxAge: 60 * 60 * 24 * 365 });
      return pref;
    },
  });
  ```
  > **Lesson 2026-05-20:** if you change these to return an `{ ok }` envelope, omit `output:` — zapaction runs `output.parse` unconditionally. Here we return the typed `UserPref` (contract output), so no envelope issue.
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/src/lib/orpc/modules.ts apps/web/src/lib/zapaction/keys.ts apps/web/src/app/(cap)/dashboard/_appearance/_actions/settings-actions.ts && git commit -m "feat(#43): web settings client + theme/lang server actions"`

- [ ] **T16 — Theme + Lang controls + Appearance section.** [AC: AC-1, AC-2, AC-3, AC-4]
  Create `apps/web/src/app/(cap)/dashboard/_appearance/_components/theme-control.tsx` (client — `PekuloSegmentedControl` + `@tamagui/next-theme` `useThemeSetting` for live apply + `updateTheme` action for server persistence; copy from `messages` via `useTranslations`):
  ```tsx
  "use client";

  import { Monitor, Moon, Sun } from "lucide-react";
  import { useThemeSetting } from "@tamagui/next-theme";
  import { useTranslations } from "next-intl";
  import { PekuloSegmentedControl } from "@pekulo/ui";
  import { THEME_VALUES, type ThemePref } from "@pekulo/validators";
  import { updateTheme } from "../_actions/settings-actions";

  // Maps a UserPref theme to the Tamagui theme name the provider expects.
  // 'system' is left to next-theme's system resolution (set('system')).
  const ICONS = { system: Monitor, dark: Moon, light: Sun } as const;

  export function ThemeControl({ initial }: { initial: ThemePref }) {
    const t = useTranslations("settings");
    const { set, resolvedTheme } = useThemeSetting();
    const current = (resolvedTheme as ThemePref) ?? initial;
    const options = THEME_VALUES.map((v) => ({ value: v, label: t(`theme.${v}`), icon: ICONS[v] }));
    return (
      <PekuloSegmentedControl<ThemePref>
        value={current}
        ariaLabel={t("appearance.theme")}
        options={options}
        onChange={(v) => {
          set(v); // live apply via next-theme (writes localStorage 'theme')
          void updateTheme({ theme: v }); // persist server-side (AC-6)
        }}
      />
    );
  }
  ```
  > Verify `useThemeSetting`'s exact API (`set`, `resolvedTheme`/`current`) against the installed `@tamagui/next-theme` `src/` before finalizing (memory: read the dep src before styling/using). If `set('system')` doesn't map to the OS preference, fall back to `set(v === 'system' ? 'system' : 'pekulo-' + v)` per the provider's `themes` names.

  Create `apps/web/src/app/(cap)/dashboard/_appearance/_components/lang-control.tsx` (client — segmented control + `updateLang` action + `router.refresh()` so RSC re-render in the new locale; AC-4):
  ```tsx
  "use client";

  import { Globe } from "lucide-react";
  import { useRouter } from "next/navigation";
  import { useLocale, useTranslations } from "next-intl";
  import { PekuloSegmentedControl } from "@pekulo/ui";
  import { LANG_VALUES, type LangPref } from "@pekulo/validators";
  import { updateLang } from "../_actions/settings-actions";

  export function LangControl() {
    const t = useTranslations("settings");
    const router = useRouter();
    const locale = useLocale() as LangPref;
    const options = LANG_VALUES.map((v) => ({ value: v, label: t(`lang.${v}`), icon: Globe }));
    return (
      <PekuloSegmentedControl<LangPref>
        value={locale}
        ariaLabel={t("appearance.language")}
        options={options}
        onChange={(v) => {
          if (v === locale) return;
          void updateLang({ lang: v }).then(() => router.refresh()); // re-render RSC in the new locale
        }}
      />
    );
  }
  ```
  Create `apps/web/src/app/(cap)/dashboard/_appearance/_components/appearance-section.tsx` (server component — fetches initial theme via `getSettings`, composes the `Section` like 8-1's `AccountSection`):
  ```tsx
  import { getTranslations } from "next-intl/server";
  import { Section, Text, View } from "@pekulo/ui";
  import { getSettings } from "../_actions/settings-actions";
  import { ThemeControl } from "./theme-control";
  import { LangControl } from "./lang-control";

  export async function AppearanceSection() {
    const t = await getTranslations("settings");
    const pref = await getSettings();
    return (
      <Section ariaLabel={t("appearance.title")} title={t("appearance.title")}>
        <View flexDirection="column" gap={4}>
          <View flexDirection="column" gap={2}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("appearance.theme")}
            </Text>
            <ThemeControl initial={pref.theme} />
          </View>
          <View flexDirection="column" gap={2}>
            <Text color="$colorTertiary" fontSize="$caption">
              {t("appearance.language")}
            </Text>
            <LangControl />
          </View>
        </View>
      </Section>
    );
  }
  ```
  > Confirm `Text` / `View` are exported from `@pekulo/ui` (they are used by `AccountSection`). If `getSettings()` (a `defineAction`) cannot be called from a server component, read the pref directly via `settingsClient.get()` + `ensureRequestContext()` here instead — mirror how `AccountSection` reads server-side.
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/src/app/(cap)/dashboard/_appearance && git commit -m "feat(#43): Apparence section + theme/lang controls"`

- [ ] **T17 — Mount `<AppearanceSection/>` in Paramètres.** [AC: AC-1, AC-4]
  In `apps/web/src/app/(cap)/dashboard/parametres/page.tsx`: import and render `<AppearanceSection/>` right after `<AccountSection/>` (per the ux-preview order: Compte → Apparence). Update the stale header comment ("interim home until the real Settings screen lands in story 8-2") — the Settings screen is landing now.
  ```tsx
  import { AppearanceSection } from "../_appearance/_components/appearance-section";
  // …
        <AccountSection />
        <AppearanceSection />
        <CompassEditForm />
  ```
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/src/app/(cap)/dashboard/parametres/page.tsx && git commit -m "feat(#43): mount Apparence section in Paramètres"`

- [ ] **T18 — Cross-device hydrator on the authenticated layout.** [AC: AC-6]
  Create `apps/web/src/app/(cap)/_components/preference-hydrator.tsx` (client — applies the server pref once on mount: theme via `useThemeSetting().set`, locale via the `NEXT_LOCALE` cookie + `router.refresh()` when it differs):
  ```tsx
  "use client";

  import { useEffect, useRef } from "react";
  import { useRouter } from "next/navigation";
  import { useThemeSetting } from "@tamagui/next-theme";
  import { useLocale } from "next-intl";
  import type { ThemePref, LangPref } from "@pekulo/validators";

  // Story 8-2 AC-6 — on the first authenticated render of a fresh device,
  // apply the server-persisted pref. Theme applies instantly (no reload);
  // locale needs a cookie write + router.refresh() to re-render RSC.
  export function PreferenceHydrator({ pref }: { pref: { theme: ThemePref; lang: LangPref } }) {
    const { set } = useThemeSetting();
    const locale = useLocale();
    const router = useRouter();
    const done = useRef(false);
    useEffect(() => {
      if (done.current) return;
      done.current = true;
      set(pref.theme);
      if (pref.lang !== locale) {
        document.cookie = `NEXT_LOCALE=${pref.lang}; path=/; max-age=${60 * 60 * 24 * 365}`;
        router.refresh();
      }
    }, [pref, locale, set, router]);
    return null;
  }
  ```
  Then mount it in the authenticated `(cap)` layout. **Read `apps/web/src/app/(cap)/layout.tsx` first** (not yet inspected) and mirror its existing server-fetch style; fetch the pref server-side (`settingsClient.get()` + `ensureRequestContext()`, or the `getSettings` action) and render `<PreferenceHydrator pref={pref} />` near the top of the layout's returned tree.
  Run: `bun --filter='@pekulo/web' run typecheck`
  Expected: no errors, exit 0.
  Commit: `git add apps/web/src/app/(cap)/_components/preference-hydrator.tsx apps/web/src/app/(cap)/layout.tsx && git commit -m "feat(#43): cross-device preference hydrator (AC-6)"`

**Sub-lot G — App-wide i18n string sweep (the long tail)**

> This is the bulk-mechanical part of the « i18n complet » choice. Land Sub-lots A–F green first; this sweep is its own commit train. **Every file follows the identical recipe** — there is no per-file design, only application of the pattern below. Do NOT machine-translate blindly: keep the FR source verbatim as the key value, write the EN translation by hand.

- [ ] **T19 — Inventory the hardcoded French strings.** [AC: AC-4, AC-5]
  Build the work-list (does not change code):
  ```bash
  # User-facing FR strings in client/server components + actions (excludes tests, comments-only matches need manual triage).
  grep -rnE '"[^"]*[éèêàçùôîâ][^"]*"' apps/web/src/app apps/web/src/components apps/web/src/lib --include='*.tsx' --include='*.ts' | grep -vE '//|/\*|\.test\.|aria-|data-' > /tmp/i18n-inventory.txt
  wc -l /tmp/i18n-inventory.txt
  ```
  Group the hits by route area (auth, dashboard chrome, portefeuille, immobilier, transactions, mensuel, compass, hypothesis, llm, errors). Each group becomes one commit in T20.
  Run: `cat /tmp/i18n-inventory.txt | sed -E 's#(apps/web/src/[^:]+):.*#\1#' | sort -u`
  Expected: a de-duplicated list of files to convert (the T20 checklist), exit 0.
  Commit: _(no commit — inventory only; paste the file list into the PR description)._

- [ ] **T20 — Convert each area to `useTranslations` / `getTranslations` (repeat per file).** [AC: AC-4, AC-5]
  **Recipe (apply verbatim to every file in the T19 list):**
  1. Add a namespace block to `apps/web/messages/fr.json` for the area (e.g. `"portefeuille": { … }`), keys = camelCase slug of the string, value = the **exact current FR string**. Mirror the same keys into `en.json` with hand-written English.
  2. In a **client** component: `import { useTranslations } from "next-intl";` then `const t = useTranslations("<namespace>");` and replace each literal `"Foo"` with `{t("foo")}`. In a **server** component / action: `import { getTranslations } from "next-intl/server";` then `const t = await getTranslations("<namespace>");`.
  3. For strings with interpolation, use ICU: `t("greeting", { name })` ↔ `"greeting": "Bonjour {name}"`.

  **Worked example — `apps/web/src/app/(auth)/_actions/auth-actions.ts`** (this file is a server action; `getTranslations` works in actions). Replace the hardcoded returns. Before → after for `signIn` + `friendlySignInError`:
  ```ts
  // BEFORE
  function friendlySignInError(message: string): string {
    return message === "Invalid login credentials"
      ? "Email ou mot de passe incorrect"
      : "Connexion impossible. Réessaie plus tard.";
  }
  export async function signIn(email: string, password: string): Promise<AuthResult> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: friendlySignInError(error.message) };
    return { ok: true };
  }
  // AFTER
  import { getTranslations } from "next-intl/server";
  async function friendlySignInError(message: string): Promise<string> {
    const t = await getTranslations("auth.signInError");
    return message === "Invalid login credentials" ? t("badCredentials") : t("generic");
  }
  export async function signIn(email: string, password: string): Promise<AuthResult> {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, message: await friendlySignInError(error.message) };
    return { ok: true };
  }
  ```
  Apply the same recipe to: `auth-actions.ts` (all remaining FR returns → `auth.*` keys already seeded in T13), `components/auth-form.tsx`, `components/recover-form.tsx`, `lib/user-error-message.ts` (`USER_ERROR_MESSAGE` → `errors.generic`), `layout.tsx` metadata (move to `generateMetadata` with `getTranslations`), then each dashboard area surfaced by the T19 inventory. **One commit per area.**
  Run (after each area): `bun --filter='@pekulo/web' run typecheck` and the relevant component tests if present.
  Expected: typecheck clean; no remaining FR literals in the converted files (`grep` from T19 over just those files returns 0 user-facing hits).
  Commit (per area): `git add <area files> apps/web/messages && git commit -m "feat(#43): i18n sweep — <area>"`

**Sub-lot H — Verification (a11y + final gates)**

- [ ] **T21 — a11y on the Apparence section.** [AC: AC-1, AC-4]
  Add a `vitest-axe` test for `AppearanceSection` (mirror an existing `*.axe.test.tsx` / vitest-axe usage in the repo): render the section, assert no axe violations and that each `PekuloSegmentedControl` exposes `role="radiogroup"` + `aria-label` (the component already sets these). Cover the `aria-checked` reflection on the active segment.
  Run: `bun --filter='@pekulo/web' run test apps/web/src/app/(cap)/dashboard/_appearance`
  Expected: `Test Files  1 passed`, `Tests  N passed`, exit 0.
  Commit: `git add apps/web/src/app/(cap)/dashboard/_appearance && git commit -m "test(#43): a11y on Apparence section"`

- [ ] **T22 — Full typecheck + RLS audit + visual verification.** [AC: all]
  1. `bun --filter='@pekulo/api' run typecheck && bun --filter='@pekulo/web' run typecheck` → both exit 0.
  2. `bun --filter='@pekulo/api' run db:rls-audit` → `user_pref` shows 3 policies (AC-7), exit 0.
  3. Run the app, open `/dashboard/parametres`, and **visually verify** every GREEN per CLAUDE.md (frontend = visual verification): toggle theme (Système/Sombre/Clair — confirm `data-theme` flips and light actually renders, AC-1/2/3), toggle language (FR↔EN — confirm strings flip without full reload, AC-4; reload → no flash, AC-5). Use `mcp__react-grab-mcp__get_element_context` on the segmented controls.
  4. Cross-device sanity (AC-6): change prefs, clear `localStorage` + cookies in a second profile, log in, confirm the prefs apply on first authenticated render.
  Expected: all gates green; screenshots / element-context captured for the review.
  Commit: _(no code commit — verification step; record findings in the PR body.)_

## Dev Notes

- **Architecture / layering:**
  - **ADR-0010 hard web layering:** Component → Hook/Section → `'use server'` action → (oRPC client | next-theme). The web tier owns **zero** business logic; `settings-actions.ts` are thin oRPC delegators (mirror `_compass/_actions/compass-actions.ts`). `auth-actions.ts` MUST NOT be imported cross-feature, but importing the **lib** `settingsClient` is fine (it's not a feature action).
  - **ADR-0009 module topology:** the `settings` module mirrors `milestones`/`dashboard` — `createSettingsModule(deps) → { service, router }`, mounted under `/rpc/v1/settings` in `runtime-dependencies.ts`. **L8 invariant:** the router type is `ReturnType<typeof createSettingsRouter>` — never annotate the concrete `Elysia`/oRPC type (Elysia 1.4's `Elysia` type is invariant, lesson 2026-05-04).
  - **ADR-0013 defense-in-depth:** RLS on `user_pref` **plus** an explicit `where: { userId }` on every repository query (the `pekulo/no-prisma-query-without-user-id` lint rule enforces it).
  - **ADR-0012 prefixed IDs:** `UserPref` opts OUT (PK = `user_id` UUID) exactly like `DashboardLayout`/`BridgeUser` — register `UserPref: null`, do not invent a synthetic `up_*` id.
  - **Zustand:** the epics summary named Zustand `persist` stores, but the repo has **no Zustand** and the installed stack already owns the client mirror — `@tamagui/next-theme` (theme + localStorage) + next-intl (locale + cookie). Decision (design gate 2026-06-16): **do NOT add Zustand** — a second source of truth would contradict architecture L549 ("Zustand never mirrors server state"). Server `UserPref` is the source of truth; next-theme/next-intl are the local appliers.
  - **next-intl topology:** **no i18n routing** — locale lives in the `NEXT_LOCALE` cookie, a single route tree. This avoids restructuring the `(auth)`/`(cap)` route groups into `[locale]` segments. SSR locale = `getRequestConfig` reads the cookie; switching = action sets cookie + `router.refresh()`.

- **Deviations from the cache / epics (surfaced, not silent):**
  - **RLS = 3 policies, not the « 4-policy quartet »** the epic-8 cache assumed: `UserPref` is a per-user singleton, so it mirrors `dashboard_layout` (SELECT/INSERT/UPDATE, no DELETE; removal via `auth.users` cascade in 11-2). AC-7 reflects this.
  - **File paths differ from `epics.md`:** epics listed `apps/web/src/lib/stores/{theme,lang}-store.ts` + `apps/web/src/app/(cap)/parametres/_components/…`. Reality: route is `(cap)/dashboard/parametres/`, no `lib/stores/`, feature code co-located in `_appearance/_components/` (mirrors 8-1's `_account/_components/`). The story uses the **real** tree.
  - **Complexity M → XL:** full i18n + light-theme registration were user-chosen additions (design gate). Per lesson 2026-05-31 this carries doc-debt to pay in the same change — if the sweep balloons past one session, the disciplined fallback is to split Sub-lot G into a sibling story (recompile the epic-8 cache + write the lesson if so).

- **Verify-before-patch (memory):** pin `next-intl` via `npm view next-intl dist-tags`; confirm the App-Router/no-routing/cookie setup via Context7 + `node_modules/next/dist/docs/` (apps/web/AGENTS.md — this Next.js diverges from training data); read `@tamagui/next-theme` `src/` for the exact `useThemeSetting` API; verify `@tamagui/cli` ≥ rc.41 fix before relying on `pekulo-light` selector emission.

- **Commit gate (lesson 2026-06-01):** `tsc` is NOT auto-run (`next.config.ts` sets `typescript.ignoreBuildErrors: true`). Run `bun --filter='@pekulo/<pkg>' run typecheck` manually before every commit. Quote the workspace name in `--filter` (lesson 2026-05-19); `bun add` uses `--cwd apps/web`, not `--filter` (which targets root).

- **Testing:** `apps/api` = **bun-native** runner (`import … from "bun:test"`); `apps/web` = **vitest** (`vitest run`) + `vitest-axe` for a11y. `@pekulo/validators` and `@pekulo/contracts` have no `test` script — exercise the settings schemas through the api tests. Integration tests hit the real test DB (mirror `dashboard.integration.test.ts`) for AC-7/AC-8.

### Step-0 — Existing code at write time (verbatim, for every MODIFIED file)

**`apps/api/prisma/schema/enums.prisma`** — appending `ThemePref` + `LangPref`. Current tail (last enum):
```prisma
enum LlmRoute {
  foundation_models
  ollama
  third_party

  @@map("llm_route")
}
```

**`apps/api/src/database/id-prefixes.config.ts`** — adding `UserPref: null`. Current opt-out neighbours:
```ts
  MerchantLogoCache: null,
  ProviderLogoCache: null,
  DashboardLayout: null,
} as const satisfies Record<string, string | null>;
```

**`packages/contracts/src/settings/settings.contract.ts`** — replacing the empty `settingsContractV1`:
```ts
export const settingsContractV1 = {} as const;
export const settingsContract = settingsContractV1;
export const settingsContractMeta = {
  moduleKey: "settings",
  mountPath: "/rpc/v1/settings",
  version: "v1",
} as const;
```

**`packages/contracts/src/index.ts`** — `settingsContract` is already re-exported + aggregated into `pekuloContract` (no change needed there; the web client in T15 imports it directly).

**`apps/api/src/bootstrap/runtime-dependencies.ts`** — current oRPC assembly (append `settings`):
```ts
const orpcRouter: PekuloRpcRouter = {
  hypothesis: hypothesisModule.router,
  compass: compassModule.router,
  milestones: milestonesModule.router,
  accounts: accountsModule.router,
  holdings: holdingsModule.router,
  realestate: realestateModule.router,
  dashboard: dashboardModule.router,
  transactions: transactionsModule.router,
  monthly: monthlyModule.router,
  bankaggregator: bankAggregatorModule.router,
  llm: llmModule.router,
};
```
> The `PekuloRpcRouter` type may need a `settings` key — read where it's declared; if it's `ReturnType`-inferred this is automatic, otherwise add `settings: ReturnType<typeof createSettingsRouter>`.

**`packages/ui/src/config/tamagui.ts`** — registering `pekulo-light`. Current `themes`:
```ts
  themes: {
    "pekulo-dark": pekuloDark,
  },
  defaultTheme: "pekulo-dark",
```
The provider already declares both: `<NextThemeProvider defaultTheme="pekulo-dark" themes={["pekulo-light", "pekulo-dark"]}>` (`packages/ui/src/provider/index.tsx`).

**`apps/web/src/app/layout.tsx`** — wrapping `NextIntlClientProvider` + dynamic `lang`. Current (anti-FOUC script stays unchanged):
```tsx
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: `…theme anti-FOUC…` }} />
      </head>
      <body>
        <ReactGrabDev />
        <NuqsAdapter>
          <Providers>{children}</Providers>
        </NuqsAdapter>
      </body>
    </html>
  );
```

**`apps/web/next.config.ts`** — wrapping with `createNextIntlPlugin`. Current export:
```ts
const nextConfig: NextConfig = { /* transpilePackages, typescript, allowedDevOrigins, turbopack */ };
export default nextConfig;
```

**`apps/web/src/app/(cap)/dashboard/parametres/page.tsx`** — inserting `<AppearanceSection/>` after `<AccountSection/>`. Current body:
```tsx
        <AccountSection />
        <CompassEditForm />
        <CompassHistoryPanel />
        <LlmOptInToggle />
        <LlmActivityLogLink />
        <HypothesisSettings />
```

**`apps/web/src/lib/orpc/modules.ts`** — adding `settingsClient` (currently NOT exported; the file header explicitly notes auth/settings clients are added when their api route lands). Pattern to mirror:
```ts
export const dashboardClient: ContractRouterClient<typeof dashboardContract> = createORPCClient(
  orpcLink,
  { path: ["dashboard"] },
);
```

**`apps/web/src/app/(auth)/_actions/auth-actions.ts`** — i18n sweep target (T20). Current hardcoded FR returns to convert: `friendlySignInError` (2 strings), `signUp` ("Inscription refusée. Réessaie."), `signOut` ("Déconnexion impossible. Réessaie."), `requestPasswordReset` ("Email invalide"), `updatePassword` ("Impossible de mettre à jour le mot de passe. Réessaie."). Keys seeded in `auth.*` (T13). The `PASSWORD_POLICY_MESSAGE` comes from `@pekulo/validators` — leave it (or i18n it in a validators follow-up; out of this file's scope).

**`apps/web/src/app/(cap)/layout.tsx`** — NOT yet inspected. **Read it before T18** and mirror its existing server-fetch pattern when mounting `<PreferenceHydrator>`.

**`apps/web/src/lib/zapaction/keys.ts`** — adding `settingsKeys`/`settingsTags` + a `setTagRegistry` edge. Mirror `compassKeys`/`compassTags` and the registry block at the bottom of the file.

### 3-bullet file decisions (new files)

- **`apps/api/prisma/schema/settings.prisma`** — *Responsibility:* the `UserPref` table shape. *In/out:* depends on `ThemePref`/`LangPref` enums; exports the `UserPref` Prisma model.
- **`apps/api/src/modules/settings/settings.repository.ts`** — *Responsibility:* Prisma read/upsert for one user's pref. *In/out:* `ExtendedPrismaClient` + validator types → `{find, upsertTheme, upsertLang}`.
- **`…/settings.service.ts`** — *Responsibility:* getOrCreate defaults + delegate updates. *In/out:* `SettingsRepository` → `{get, updateTheme, updateLang}` returning `UserPref`.
- **`…/settings.routes.ts`** — *Responsibility:* oRPC handlers extracting `userId` from context. *In/out:* `settingsContract` + `SettingsService` → oRPC router.
- **`…/settings.module.ts`** — *Responsibility:* wire repo→service→router. *In/out:* `PrismaService` → `{service, router}`.
- **`…/settings.errors.ts`** — *Responsibility:* typed `SettingsError`. *In/out:* extends `PekuloError`.
- **`packages/validators/src/settings/settings.schemas.ts`** — *Responsibility:* zod SSOT for theme/lang. *In/out:* `@pekulo/zod` → schemas + `THEME_VALUES`/`LANG_VALUES` constants + types.
- **`apps/web/src/i18n/request.ts`** — *Responsibility:* resolve locale from cookie + load messages. *In/out:* `NEXT_LOCALE` cookie → `{locale, messages}`.
- **`apps/web/messages/{fr,en}.json`** — *Responsibility:* message catalogs. *In/out:* namespace→string maps, consumed by `useTranslations`.
- **`…/_appearance/_actions/settings-actions.ts`** — *Responsibility:* web→api delegators for prefs + locale cookie write. *In/out:* `settingsClient` → `{getSettings, updateTheme, updateLang}`.
- **`…/_appearance/_components/theme-control.tsx`** — *Responsibility:* theme segmented control (live apply + persist). *In/out:* `initial: ThemePref` → renders `PekuloSegmentedControl`.
- **`…/_appearance/_components/lang-control.tsx`** — *Responsibility:* language segmented control (cookie + refresh + persist). *In/out:* current locale → `PekuloSegmentedControl`.
- **`…/_appearance/_components/appearance-section.tsx`** — *Responsibility:* compose the « Apparence » `Section`. *In/out:* server-fetched pref → theme + lang controls.
- **`apps/web/src/app/(cap)/_components/preference-hydrator.tsx`** — *Responsibility:* apply server pref on first authenticated render (AC-6). *In/out:* `{theme, lang}` → side-effect (set theme / locale cookie / refresh).

## File List

**Created**
- `apps/api/prisma/schema/settings.prisma`
- `apps/api/prisma/migrations/<ts>_create_user_pref/migration.sql`
- `apps/api/src/modules/settings/settings.errors.ts`
- `apps/api/src/modules/settings/settings.repository.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.routes.ts`
- `apps/api/src/modules/settings/settings.module.ts`
- `apps/api/src/modules/settings/settings.service.test.ts`
- `apps/api/src/modules/settings/settings.integration.test.ts`
- `packages/validators/src/settings/settings.schemas.ts`
- `packages/validators/src/settings/index.ts`
- `apps/web/src/i18n/request.ts`
- `apps/web/messages/fr.json`
- `apps/web/messages/en.json`
- `apps/web/src/app/(cap)/dashboard/_appearance/_actions/settings-actions.ts`
- `apps/web/src/app/(cap)/dashboard/_appearance/_components/theme-control.tsx`
- `apps/web/src/app/(cap)/dashboard/_appearance/_components/lang-control.tsx`
- `apps/web/src/app/(cap)/dashboard/_appearance/_components/appearance-section.tsx`
- `apps/web/src/app/(cap)/_components/preference-hydrator.tsx`
- a11y test under `apps/web/src/app/(cap)/dashboard/_appearance/`

**Modified**
- `apps/api/prisma/schema/enums.prisma` (ThemePref + LangPref)
- `apps/api/src/database/id-prefixes.config.ts` (`UserPref: null`)
- `apps/api/src/bootstrap/runtime-dependencies.ts` (mount settings)
- `packages/contracts/src/settings/settings.contract.ts` (fill procedures)
- `packages/validators/src/index.ts` (export settings)
- `packages/ui/src/config/tamagui.ts` (register pekulo-light) + `packages/ui/generated.css` (rebuilt)
- `apps/web/next.config.ts` (next-intl plugin)
- `apps/web/src/app/layout.tsx` (NextIntlClientProvider + dynamic lang)
- `apps/web/src/lib/orpc/modules.ts` (settingsClient)
- `apps/web/src/lib/zapaction/keys.ts` (settings keys/tags)
- `apps/web/src/app/(cap)/dashboard/parametres/page.tsx` (mount Apparence)
- `apps/web/src/app/(cap)/layout.tsx` (mount PreferenceHydrator)
- i18n sweep (T20): `apps/web/src/app/(auth)/_actions/auth-actions.ts`, `components/auth-form.tsx`, `components/recover-form.tsx`, `lib/user-error-message.ts`, `app/layout.tsx` metadata, + each dashboard area surfaced by the T19 inventory

## Dev Agent Record

_Filled by aped-dev at completion (step-08). Model / start / end stamped there._

### Summary

_Filled by aped-dev._

### Files changed

_Filled by aped-dev._

### Deviations

_Filled by aped-dev._

### Test output

_Filled by aped-dev._
