# Story: 11-2-account-deletion — GDPR account deletion: Bridge erasure, explicit purge of all 21 user-scoped tables, Supabase Auth user erased

**Epic:** Epic 11 — Public-ramp readiness
**Status:** review
**Ticket:** #49
**Branch:** feature/49-11-2-account-deletion

## User Story

**As a** Pekulo user, **I want** to delete my account from the settings page, with my data erased at Bridge and every user-scoped table purged, **so that** I can exercise my GDPR right to erasure.

## Acceptance Criteria

- **AC-1** — **Given** a signed-in user holding rows across the 21 user-scoped tables, **When** they confirm deletion in Paramètres → Vos données, **Then** every row they own is removed from all 21 tables, the Supabase Auth user is erased, and the call returns in under 60 s. (FR-50, NFR-7, DR-5)
- **AC-2** — **Given** the deletion completed, **When** the user attempts to sign in with the same credentials, **Then** Supabase rejects the attempt. (ticket #49 AC-2)
- **AC-3** — **Given** two users A and B who each own rows in every user-scoped table, **When** A deletes their account, **Then** not one row belonging to B is removed, on any of the 21 tables, and B's Supabase Auth user is untouched. (2026-05-27 lesson: a single-tenant fixture cannot prove isolation — the test seeds two users and asserts on both.)
- **AC-4** — **Given** a database table that holds user data but was never added to the deletion, **When** the apps/api test suite runs, **Then** it fails and names that table. **And given** a table the export takes but the deletion leaves behind — or the reverse — **When** the suite runs, **Then** it fails and names it: what a user can take with them and what goes when they leave are asserted to be the same set, so a new table can never enter one without the other. (This is the guard story 11-1's review required by name: "the deletion cascade needs the same mechanical guard, not a prose reminder.")
- **AC-5** — **Given** the committed migration SQL, **When** `db:rls-migration-audit` runs, **Then** it fails and names the table if any public user-data table cannot reach `auth.users` through an `ON DELETE CASCADE` path — directly, or through a parent table that can. A new user-data table without that path is a build failure.
- **AC-6** — **Given** a user holding at least one Bridge bank connection, **When** they delete their account, **Then** the Bridge user is deleted at the provider (`DELETE /v3/aggregation/users/{uuid}`) **before** any local row is removed. **And given** that provider call fails, **Then** no local row is deleted, the Supabase Auth user is untouched, and the caller receives a `BANK_PROVIDER_UNAVAILABLE` error. (ticket #49 audit comment, 🔴; `docs/rgpd-readiness.md` §1.)
- **AC-7** — **Given** a call to `settings.deleteAccount` with no `Authorization` header or an invalid Bearer token, **Then** apps/api answers `401` and no Prisma query runs. **And given** a `confirmationEmail` that does not match the session's email, **Then** the call is rejected with `FORBIDDEN` and no row is deleted, no provider call is made, and the Supabase Auth user is untouched.
- **AC-8** — **Given** the Paramètres page, **When** it renders, **Then** the « Vos données » section holds a **second** row labelled « Supprimer mon compte » with the sub-label « Cascade sur toutes les tables · irréversible », rendered in the destructive variant with a `Trash2` + « Supprimer » control — in both `fr` and `en`. **When** that control is activated, **Then** a confirmation dialog opens requiring the account's email address to be typed before the confirm button enables. **When** the deletion succeeds, **Then** the offline cache is purged, the session is cleared and the browser lands on `/`. **When** the section is scanned for accessibility, **Then** it reports zero violations and both row controls expose an accessible name.

## Tasks

- [x] **T1 — Migration: the four missing `auth.users` foreign keys** [AC: AC-1, AC-5]

  Four of the 21 user-scoped tables carry no foreign key to `auth.users` on any path. Three of their migrations contain a comment asserting the opposite. Verify the gap first, then close it.

  Verify (this is the failing state you are fixing):

  ```bash
  cd /Users/fredyaba/Documents/Saas-projects/pekulo && grep -rl 'REFERENCES auth\.users\|REFERENCES "auth"\.' apps/api/prisma/migrations/ | wc -l
  ```

  Create `apps/api/prisma/migrations/20260915120000_add_missing_auth_users_fk/migration.sql` with exactly this content:

  ```sql
  -- 11-2-account-deletion — close the auth.users cascade gap.
  --
  -- Four user-scoped tables were created WITHOUT a foreign key to auth.users:
  --   compass_history   (20260509150000_create_compass_history)
  --   milestones        (20260510120000_create_milestones)
  --   dashboard_layout  (20260604172000_dashboard_layout)
  --   user_pref         (20260616120000_create_user_pref)
  --
  -- Three of those four migrations carry a comment stating that "row removal
  -- happens only via cascade from auth.users (story 11-2)". The comment was
  -- aspirational; the constraint was never written, so deleting the auth.users
  -- row left those four tables orphaned — an incomplete GDPR erasure that every
  -- existing test passed. This migration makes the schema match the claim.
  --
  -- account_balance_log is deliberately NOT in this list: it has no direct FK to
  -- auth.users either, but it cascades through accounts(id) ON DELETE CASCADE,
  -- which does. The gate added in T2 accepts that indirect path.
  --
  -- Idempotent (DO $$ … EXCEPTION WHEN duplicate_object) so a re-run against a
  -- database that already carries the constraint is a no-op. Apply via
  -- `bun --filter=@pekulo/api run prisma:migrate:deploy` (ADR-0014 + the
  -- 2026-05-05 lesson — never `prisma migrate dev` against the Supabase pooler).

  BEGIN;

  DO $$ BEGIN
    ALTER TABLE "compass_history"
      ADD CONSTRAINT "compass_history_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    ALTER TABLE "milestones"
      ADD CONSTRAINT "milestones_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    ALTER TABLE "dashboard_layout"
      ADD CONSTRAINT "dashboard_layout_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  DO $$ BEGIN
    ALTER TABLE "user_pref"
      ADD CONSTRAINT "user_pref_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  COMMIT;
  ```

  Apply it against the dev database (the 2026-06-05 lesson: a migration that is written but never deployed is a 500 waiting to happen):

  Run: `cd /Users/fredyaba/Documents/Saas-projects/pekulo && bun --filter=@pekulo/api run prisma:migrate:deploy`
  Expected: the output lists `20260915120000_add_missing_auth_users_fk` as applied, exit 0.
  Commit: `git add apps/api/prisma/migrations/20260915120000_add_missing_auth_users_fk/migration.sql && git commit -m "feat(#49): add the four missing auth.users FK cascades (FR-50)"`

- [x] **T2 — RED then GREEN: extend the static gate to assert cascade reachability** [AC: AC-5]

  The existing gate proves RLS is enabled. Nothing proves a user-data table can be reached by the `auth.users` cascade — which is exactly how the T1 gap survived four stories.

  First, append these tests to `apps/api/scripts/rls-migration-audit.test.ts` (leave the existing tests in place, add this `describe` block at the end of the file):

  ```ts
  describe("auditCascadeReachability (story 11-2, AC-5)", () => {
    const CREATE_TWO = `
      CREATE TABLE "widgets" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL);
      CREATE TABLE "widget_logs" ("id" TEXT NOT NULL, "user_id" UUID NOT NULL, "widget_id" TEXT NOT NULL);
    `;

    it("reports a user table with no path to auth.users", () => {
      const drift = auditCascadeReachability(CREATE_TWO);
      expect(drift.map((d) => d.table).sort()).toEqual(["widget_logs", "widgets"]);
    });

    it("accepts a direct FK to auth.users with ON DELETE CASCADE", () => {
      const sql = `${CREATE_TWO}
        ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
          FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
        ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_fk"
          FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;`;
      expect(auditCascadeReachability(sql)).toEqual([]);
    });

    it("accepts an INDIRECT path through a parent that cascades (account_balance_log shape)", () => {
      const sql = `${CREATE_TWO}
        ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
          FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
        ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_parent_fk"
          FOREIGN KEY ("widget_id") REFERENCES "widgets"("id") ON DELETE CASCADE;`;
      expect(auditCascadeReachability(sql)).toEqual([]);
    });

    it("rejects a parent FK that is NOT ON DELETE CASCADE", () => {
      const sql = `${CREATE_TWO}
        ALTER TABLE "widgets" ADD CONSTRAINT "w_fk"
          FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
        ALTER TABLE "widget_logs" ADD CONSTRAINT "wl_parent_fk"
          FOREIGN KEY ("widget_id") REFERENCES "widgets"("id") ON DELETE SET NULL;`;
      expect(auditCascadeReachability(sql).map((d) => d.table)).toEqual(["widget_logs"]);
    });

    it("skips the declared non-user tables", () => {
      const sql = `CREATE TABLE "merchant_logo_cache" ("merchant_key" TEXT NOT NULL);`;
      expect(auditCascadeReachability(sql)).toEqual([]);
    });

    it("passes on the real committed migration corpus", () => {
      // The whole point of the gate: the four tables T1 fixed must now be
      // reachable, and every future table must stay reachable.
      expect(auditCascadeReachability(readAllMigrationSql())).toEqual([]);
    });
  });
  ```

  Add the import for the two new symbols at the top of that test file, next to the existing `auditMigrationSql` import:

  ```ts
  import { auditCascadeReachability, readAllMigrationSql } from "./rls-migration-audit";
  ```

  Run: `cd apps/api && bun test scripts/rls-migration-audit.test.ts`
  Expected: RED — `error: Export named 'auditCascadeReachability' not found in module`. This is the failing state T2's GREEN half fixes.

  Now add the implementation to `apps/api/scripts/rls-migration-audit.ts`. Insert this block immediately **after** the existing `auditMigrationSql` function and **before** `function migrationSqlFiles(dir: string): string[] {`:

  ```ts
  // --- Cascade reachability gate (story 11-2, AC-5) -------------------------
  //
  // RLS proves who may READ a row. It says nothing about whether the row DIES
  // when the account does. Four tables (compass_history, milestones, user_pref,
  // dashboard_layout) shipped with no FK to auth.users at all while three of
  // their migrations carried a comment claiming the opposite — an incomplete
  // GDPR erasure (FR-50) that every gate in the repo passed. This closes that
  // class: a user-data table must reach auth.users through ON DELETE CASCADE,
  // directly or through a parent that does (the account_balance_log shape).

  // `FOREIGN KEY ("col") REFERENCES <target> ON DELETE CASCADE`, with or without
  // quotes and with or without a schema qualifier. Captures the target table
  // name only; the ON DELETE CASCADE tail is mandatory, so a SET NULL / RESTRICT
  // / NO ACTION reference simply does not match and the table stays unreachable.
  const CASCADE_FK_RE =
    /ALTER TABLE\s+(?:"?[a-z0-9_]+"?\.)?"?([a-z0-9_]+)"?\s+ADD CONSTRAINT[^;]*?FOREIGN KEY[^;]*?REFERENCES\s+(?:"?([a-z0-9_]+)"?\.)?"?([a-z0-9_]+)"?\s*\([^)]*\)\s*ON DELETE CASCADE/gi;

  export function auditCascadeReachability(
    sql: string,
    opts: { nonUser?: Set<string> } = {},
  ): RlsDrift[] {
    const nonUser = opts.nonUser ?? NON_USER_TABLES;
    const created = createdTables(sql);

    // child -> set of parents it cascade-deletes from.
    const parents = new Map<string, Set<string>>();
    for (const m of sql.matchAll(CASCADE_FK_RE)) {
      const child = m[1]!;
      const parentSchema = m[2];
      const parentTable = m[3]!;
      // auth.users is the root. Any other schema qualifier is not a public
      // table we track, and an unqualified name is public by definition.
      const parent =
        parentSchema === "auth" && parentTable === "users" ? "auth.users" : parentTable;
      if (!parents.has(child)) parents.set(child, new Set());
      parents.get(child)!.add(parent);
    }

    // Walk up from each table; `seen` makes a cyclic FK graph terminate
    // instead of recursing forever.
    function reachesAuthUsers(table: string, seen: Set<string>): boolean {
      if (seen.has(table)) return false;
      seen.add(table);
      for (const parent of parents.get(table) ?? []) {
        if (parent === "auth.users") return true;
        if (reachesAuthUsers(parent, seen)) return true;
      }
      return false;
    }

    const drift: RlsDrift[] = [];
    for (const table of [...created].sort()) {
      if (nonUser.has(table)) continue;
      if (!reachesAuthUsers(table, new Set())) {
        drift.push({
          table,
          reason: "no ON DELETE CASCADE path to auth.users (GDPR erasure would orphan it)",
        });
      }
    }
    return drift;
  }

  // Exported so the unit test can assert the gate against the real corpus
  // rather than against hand-written SQL only.
  export function readAllMigrationSql(): string {
    const here = dirname(fileURLToPath(import.meta.url));
    const migrationsDir = resolve(here, "..", "prisma", "migrations");
    const files = migrationSqlFiles(migrationsDir);
    return files.map((f) => readFileSync(f, "utf8")).join("\n");
  }
  ```

  Then wire it into `main()`. Replace this existing block in `apps/api/scripts/rls-migration-audit.ts`:

  ```ts
    const drift = auditMigrationSql(sql);
    if (drift.length > 0) {
      console.error("[rls-migration-audit] DRIFT — user-data tables without proper RLS:");
      for (const d of drift) console.error(`  ${d.table}: ${d.reason}`);
      console.error(
        "\nAppend the RLS DDL to the table's migration.sql (ENABLE ROW LEVEL SECURITY + policies),",
      );
      console.error("or add the table to NON_USER_TABLES with a justification.");
      return 1;
    }
    const checked = [...createdTables(sql)].filter((t) => !NON_USER_TABLES.has(t)).length;
    console.log(`[rls-migration-audit] OK — ${checked} user-data tables, all RLS-guarded.`);
    return 0;
  ```

  with:

  ```ts
    const drift = auditMigrationSql(sql);
    if (drift.length > 0) {
      console.error("[rls-migration-audit] DRIFT — user-data tables without proper RLS:");
      for (const d of drift) console.error(`  ${d.table}: ${d.reason}`);
      console.error(
        "\nAppend the RLS DDL to the table's migration.sql (ENABLE ROW LEVEL SECURITY + policies),",
      );
      console.error("or add the table to NON_USER_TABLES with a justification.");
      return 1;
    }

    // Story 11-2, AC-5 — erasure reachability. Kept as a SECOND pass with its
    // own message: "RLS is missing" and "the account cascade cannot reach it"
    // are different bugs with different fixes, and collapsing them into one
    // report sends the reader to the wrong file.
    const cascadeDrift = auditCascadeReachability(sql);
    if (cascadeDrift.length > 0) {
      console.error("[rls-migration-audit] DRIFT — user-data tables the account cascade cannot reach:");
      for (const d of cascadeDrift) console.error(`  ${d.table}: ${d.reason}`);
      console.error(
        "\nAdd `FOREIGN KEY (\"user_id\") REFERENCES \"auth\".\"users\"(\"id\") ON DELETE CASCADE`",
      );
      console.error(
        "to the table's migration.sql, or give it a parent FK that cascades (see account_balance_log),",
      );
      console.error("or add the table to NON_USER_TABLES with a justification.");
      return 1;
    }

    const checked = [...createdTables(sql)].filter((t) => !NON_USER_TABLES.has(t)).length;
    console.log(
      `[rls-migration-audit] OK — ${checked} user-data tables, all RLS-guarded and all reachable by the auth.users cascade.`,
    );
    return 0;
  ```

  Run: `cd apps/api && bun test scripts/rls-migration-audit.test.ts && bun run scripts/rls-migration-audit.ts`
  Expected: the test file reports `6 pass` for the new describe block (plus the pre-existing tests, all passing), and the script prints `[rls-migration-audit] OK — 23 user-data tables, all RLS-guarded and all reachable by the auth.users cascade.`, exit 0.
  Commit: `git add apps/api/scripts/rls-migration-audit.ts apps/api/scripts/rls-migration-audit.test.ts && git commit -m "feat(#49): gate cascade reachability to auth.users in the static RLS audit (AC-5)"`

- [x] **T3 — Restore `dashboard_layout` to the runtime RLS inventory** [AC: AC-5]

  `EXPECTED_POLICY_COUNTS` holds 20 entries for 21 user-scoped tables — `dashboard_layout` was never added. That omission is why story 11-1 had to warn that `rls-audit.ts` is not a usable table inventory. Its migration does declare 3 policies, so this is a reporting gap, not a security hole.

  In `apps/api/scripts/rls-audit.ts`, replace this existing block:

  ```ts
    // user_pref — per-user UI preferences singleton (story 8-2, FR-51/FR-52).
    // One row/user, PK user_id. SELECT/INSERT/UPDATE only — NO DELETE policy
    // (a pref reset overwrites via UPDATE; row removal only via auth.users
    // cascade, story 11-2). AC-7 of story 8-2 asserts exactly this 3-policy count.
    user_pref: 3,
  };
  ```

  with:

  ```ts
    // user_pref — per-user UI preferences singleton (story 8-2, FR-51/FR-52).
    // One row/user, PK user_id. SELECT/INSERT/UPDATE only — NO DELETE policy
    // (a pref reset overwrites via UPDATE; row removal only via auth.users
    // cascade, story 11-2). AC-7 of story 8-2 asserts exactly this 3-policy count.
    user_pref: 3,
    // dashboard_layout — per-user widget layout (story 7-2 / ADR-0017). Same
    // shape as user_pref: SELECT/INSERT/UPDATE, no DELETE policy.
    //
    // Added in story 11-2. It was missing since 20260604172000, which left this
    // map at 20 entries for 21 user-scoped tables — the reason story 11-1 had to
    // derive the export's table list from the Prisma DMMF instead. With this
    // entry the map is a complete inventory again; DELETION_NODES and
    // EXPORT_NODES still derive from the DMMF, which stays the source of truth.
    dashboard_layout: 3,
  };
  ```

  Run: `cd apps/api && bunx tsc --noEmit && grep -c ': [0-9],$' scripts/rls-audit.ts`
  Expected: typecheck exits 0 with no output, and the grep prints `21`.
  Commit: `git add apps/api/scripts/rls-audit.ts && git commit -m "feat(#49): add the missing dashboard_layout entry to the RLS policy inventory"`

- [x] **T4 — Zod schemas for the deletion contract** [AC: AC-1, AC-7]

  Create `packages/validators/src/settings/deletion.schemas.ts` with exactly this content:

  ```ts
  // Zod source of truth for GDPR account deletion (story 11-2, FR-50).
  // Consumed by @pekulo/contracts (oRPC procedure I/O), the apps/api settings
  // service, and the apps/web server action.
  import { z } from "@pekulo/zod";

  // The typed confirmation. The dialog asks for the account's email address and
  // the SERVER compares it to the email on the verified JWT — this is an
  // authorization check, not a UX flourish: a direct RPC call with no dialog
  // must still have to name the account it is destroying.
  export const deleteAccountInputSchema = z.object({
    confirmationEmail: z.string().min(1).max(320),
  });
  export type DeleteAccountInput = z.infer<typeof deleteAccountInputSchema>;

  // rowsDeleted is keyed by the DELETION_NODES key (the table name) and carries
  // the row count Prisma reported for that table. It is the caller's own data,
  // it makes AC-1 assertable end to end, and it is what the structured
  // completion log records.
  export const deleteAccountResultSchema = z.object({
    ok: z.literal(true),
    rowsDeleted: z.record(z.string(), z.number().int().nonnegative()),
    vaultSecretsPurged: z.number().int().nonnegative(),
  });
  export type DeleteAccountResult = z.infer<typeof deleteAccountResultSchema>;
  ```

  Then replace the entire content of `packages/validators/src/settings/index.ts` (currently the single line `export * from "./settings.schemas";`) with:

  ```ts
  export * from "./settings.schemas";
  export * from "./deletion.schemas";
  ```

  Run: `cd packages/validators && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add packages/validators/src/settings/deletion.schemas.ts packages/validators/src/settings/index.ts && git commit -m "feat(#49): zod schemas for the account-deletion contract (FR-50)"`

- [x] **T5 — Add `deleteAccount` to the settings oRPC contract** [AC: AC-1, AC-7]

  Replace the entire content of `packages/contracts/src/settings/settings.contract.ts` with:

  ```ts
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
    deleteAccountInputSchema,
    deleteAccountResultSchema,
    updateLangInputSchema,
    updateThemeInputSchema,
    userPrefSchema,
  } from "@pekulo/validators";

  export const settingsContractV1 = {
    get: oc.output(userPrefSchema),
    updateTheme: oc.input(updateThemeInputSchema).output(userPrefSchema),
    updateLang: oc.input(updateLangInputSchema).output(userPrefSchema),
    deleteAccount: oc.input(deleteAccountInputSchema).output(deleteAccountResultSchema),
  } as const;

  export const settingsContract = settingsContractV1;
  export const settingsContractMeta = {
    moduleKey: "settings",
    mountPath: "/rpc/v1/settings",
    version: "v1",
  } as const;
  ```

  Run: `cd packages/contracts && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add packages/contracts/src/settings/settings.contract.ts && git commit -m "feat(#49): add settings.deleteAccount to the oRPC contract (FR-50)"`

- [x] **T6 — Declare `SUPABASE_SERVICE_ROLE_KEY` in the apps/api env schema** [AC: AC-1, AC-2]

  `apps/api` today holds `SUPABASE_JWT_SECRET` (to verify tokens) and `DATABASE_URL` (a Postgres service-role connection). Neither can erase a Supabase Auth user — that needs the Auth Admin API key, which is a different credential and is not declared anywhere in the repo.

  In `apps/api/src/config/env.ts`, replace this existing block:

  ```ts
    // Supabase project URL — used to derive the JWT issuer
    // (`<SUPABASE_URL>/auth/v1`) for `iss` claim verification (ADR-0013
    // belt+suspenders). The value is the same as `NEXT_PUBLIC_SUPABASE_URL` on
    // the web tier; it lives here too so apps/api can run independently.
    SUPABASE_URL: z.string().url(),
  ```

  with:

  ```ts
    // Supabase project URL — used to derive the JWT issuer
    // (`<SUPABASE_URL>/auth/v1`) for `iss` claim verification (ADR-0013
    // belt+suspenders). The value is the same as `NEXT_PUBLIC_SUPABASE_URL` on
    // the web tier; it lives here too so apps/api can run independently.
    SUPABASE_URL: z.string().url(),
    // Supabase Auth Admin API key (story 11-2, FR-50). REQUIRED — GDPR erasure
    // cannot complete without it, and a deployment that silently lacks it would
    // only surface as a failed deletion after the user's data is already gone.
    // Boot fails fast instead, same posture as the Bridge credentials below.
    //
    // This is NOT the Postgres connection in DATABASE_URL and NOT
    // SUPABASE_JWT_SECRET: it is the `service_role` API key from the Supabase
    // dashboard (Project Settings -> API), and it is the only credential that
    // can call auth.admin.deleteUser. It lives ONLY in Dokploy env — never on
    // apps/web (docs/security.md: the service-role key is never read on the web
    // side), never in a committed file.
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(
        20,
        "SUPABASE_SERVICE_ROLE_KEY is required (Supabase dashboard -> Project Settings -> API -> service_role)",
      ),
  ```

  Then, in `apps/api/src/config/env.test.ts`, add the key to the base fixture. Replace:

  ```ts
    SUPABASE_JWT_SECRET: "x".repeat(32),
    SUPABASE_URL: "https://example.supabase.co",
  ```

  with:

  ```ts
    SUPABASE_JWT_SECRET: "x".repeat(32),
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key-fixture-value",
  ```

  Finally, in `.env.example`, append this block at the end of the file:

  ```
  # ---------- apps/api Supabase Auth Admin (story 11-2, FR-50) ----------
  # The `service_role` API key from Supabase dashboard -> Project Settings -> API.
  # REQUIRED: apps/api boots only with it, because GDPR account deletion
  # (auth.admin.deleteUser) has no other credential that works.
  #
  # NOT the same thing as SUPABASE_JWT_SECRET (which only VERIFIES tokens) and
  # NOT the same thing as DATABASE_URL (a Postgres connection). This key can
  # administer every user in the project — it belongs in Dokploy env only, never
  # on apps/web, never committed.
  SUPABASE_SERVICE_ROLE_KEY=
  ```

  Add the value to your local `.env.local` before running any apps/api test that boots the env (`bunx supabase status` prints it locally as `service_role key`).

  Run: `cd apps/api && bun test src/config/env.test.ts`
  Expected: every test passes, exit 0.
  Commit: `git add apps/api/src/config/env.ts apps/api/src/config/env.test.ts .env.example && git commit -m "feat(#49): require SUPABASE_SERVICE_ROLE_KEY for GDPR erasure (FR-50)"`

- [x] **T7 — Add `@supabase/supabase-js` to apps/api** [AC: AC-1]

  `apps/web` already depends on it at `^2.104.1`; apps/api does not. Pin the same major so one lockfile entry serves both.

  Run: `cd /Users/fredyaba/Documents/Saas-projects/pekulo && bun add --cwd apps/api @supabase/supabase-js@^2.104.1`
  Expected: `apps/api/package.json` gains `"@supabase/supabase-js": "^2.104.1"` in `dependencies`, and `bun.lock` updates. Verify with `grep supabase apps/api/package.json`.
  Commit: `git add apps/api/package.json bun.lock && git commit -m "chore(#49): add @supabase/supabase-js to apps/api for Auth Admin erasure"`

- [x] **T8 — RED then GREEN: the Supabase Auth admin port** [AC: AC-1, AC-2]

  Create `apps/api/src/platform/auth/supabase-admin.test.ts` with exactly this content:

  ```ts
  // Story 11-2 (FR-50). The port contract, proved against a fake admin API.
  // The real @supabase/supabase-js client is never constructed here — the
  // factory takes the deleteUser callable, so the test drives the branch
  // logic without a network or a key.
  import { describe, expect, test } from "bun:test";
  import { createAuthAdmin } from "./supabase-admin";

  const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  describe("createAuthAdmin", () => {
    test("resolves when the admin API reports no error", async () => {
      const calls: string[] = [];
      const admin = createAuthAdmin({
        deleteUser: async (userId) => {
          calls.push(userId);
          return { error: null };
        },
      });
      await admin.deleteUser(USER_A);
      expect(calls).toEqual([USER_A]);
    });

    test("throws when the admin API reports an error", async () => {
      const admin = createAuthAdmin({
        deleteUser: async () => ({ error: { message: "user not allowed" } }),
      });
      expect(admin.deleteUser(USER_A)).rejects.toThrow("user not allowed");
    });

    test("never puts the user id in the thrown message", async () => {
      // The message travels into logs and, via the error mapper, toward the
      // client. The id is already in the structured log line the service
      // writes; repeating it in free text is retention with no purpose.
      const admin = createAuthAdmin({
        deleteUser: async () => ({ error: { message: "boom" } }),
      });
      expect(admin.deleteUser(USER_A)).rejects.not.toThrow(USER_A);
    });
  });
  ```

  Run: `cd apps/api && bun test src/platform/auth/supabase-admin.test.ts`
  Expected: RED — `Cannot find module './supabase-admin'`.

  Now create `apps/api/src/platform/auth/supabase-admin.ts` with exactly this content:

  ```ts
  // apps/api/src/platform/auth/supabase-admin.ts
  // Story 11-2 (FR-50). The ONLY place apps/api touches the Supabase Auth Admin
  // API. Identity (email, password hash, sessions, refresh tokens, identities,
  // MFA factors) lives in the `auth` schema, not in Prisma's public schema —
  // deleting the Postgres rows erases the user's DATA but leaves the ACCOUNT.
  //
  // Why the Admin API and not `DELETE FROM auth.users`: the raw delete works
  // (the FK cascades would even fire), but it bypasses Supabase Auth's own
  // bookkeeping, and docs/security.md records the invariant that apps/api runs
  // NO raw SQL against user data beyond the `SELECT 1` health probe. One extra
  // credential is a smaller price than breaking that invariant.
  //
  // The factory takes the callable rather than the client so the unit test can
  // drive both branches without a key or a network.
  import { createClient } from "@supabase/supabase-js";
  import { PekuloError } from "../../common/errors";

  export interface AuthAdminPort {
    /** Erases the Supabase Auth user. Resolves on success, throws otherwise. */
    deleteUser(userId: string): Promise<void>;
  }

  export interface AuthAdminDeleteFn {
    (userId: string): Promise<{ error: { message: string } | null }>;
  }

  export function createAuthAdmin(deps: { deleteUser: AuthAdminDeleteFn }): AuthAdminPort {
    return {
      async deleteUser(userId) {
        const { error } = await deps.deleteUser(userId);
        if (error) {
          // No user id in the message: it reaches logs and the error mapper,
          // and the service already writes the id once in its structured line.
          throw new PekuloError("INTERNAL", `supabase auth admin deleteUser failed: ${error.message}`);
        }
      },
    };
  }

  /**
   * Production wiring. `persistSession: false` + `autoRefreshToken: false`
   * because this client is a stateless server-side administrator — it must
   * never try to hold a session of its own.
   */
  export function createSupabaseAuthAdmin(args: {
    supabaseUrl: string;
    serviceRoleKey: string;
  }): AuthAdminPort {
    const client = createClient(args.supabaseUrl, args.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return createAuthAdmin({
      deleteUser: async (userId) => {
        const { error } = await client.auth.admin.deleteUser(userId);
        return { error: error ? { message: error.message } : null };
      },
    });
  }
  ```

  Create `apps/api/src/platform/auth/index.ts` with exactly this content:

  ```ts
  // apps/api/src/platform/auth/ — Supabase Auth administration.
  // Public surface of the module; consumers import through here, mirroring
  // platform/security/index.ts.
  export { createAuthAdmin, createSupabaseAuthAdmin } from "./supabase-admin";
  export type { AuthAdminPort, AuthAdminDeleteFn } from "./supabase-admin";
  ```

  Run: `cd apps/api && bun test src/platform/auth/supabase-admin.test.ts && bunx tsc --noEmit`
  Expected: `3 pass`, `0 fail`; typecheck exits 0 with no output.
  Commit: `git add apps/api/src/platform/auth/ && git commit -m "feat(#49): supabase auth admin port for account erasure (FR-50)"`

- [x] **T9 — Add `deleteUser` to the `BankProvider` port** [AC: AC-6]

  In `apps/api/src/modules/bank-aggregator/bank-provider.ts`, find this existing method declaration inside `export interface BankProvider`:

  ```ts
    revokeItem(args: { userUuid: string; providerItemId: string }): Promise<void>;
  ```

  and insert the following immediately **after** it (leave `revokeItem` in place — the settings-page revoke flow still uses it):

  ```ts
    /**
     * Story 11-2 (FR-50) — GDPR erasure at the provider. Deletes the provider
     * user and, with it, every item beneath it. This is the AUTHORITATIVE
     * erasure call: `revokeItem` ends a single bank link, this ends the
     * relationship.
     *
     * MUST be idempotent: "the user is already gone" is the end state this call
     * exists to reach, so a provider answering 404 is a SUCCESS, not an error.
     * Account deletion is fail-closed on this call, and a non-idempotent
     * implementation would make a retried deletion unrecoverable.
     */
    deleteUser(args: { userUuid: string }): Promise<void>;
  ```

  Run: `cd apps/api && bunx tsc --noEmit`
  Expected: RED — `Property 'deleteUser' is missing in type ... but required in type 'BankProvider'`, pointing at `services/bridge-client.ts`. T10 fixes it.
  Commit: (none — T9 and T10 land together; commit at the end of T10.)

- [x] **T10 — Implement `deleteUser` on the Bridge client** [AC: AC-6]

  In `apps/api/src/modules/bank-aggregator/services/bridge-client.ts`, find this existing method in the returned object:

  ```ts
      async revokeItem({ userUuid, providerItemId }) {
        const bearer = await mintUserAccessToken(userUuid);
        await reqJson<{ ok: true }>(`/v3/aggregation/items/${providerItemId}`, {
          method: "DELETE",
          bearer,
        });
      },
  ```

  and insert the following immediately **after** it:

  ```ts
      async deleteUser({ userUuid }) {
        // DELETE /v3/aggregation/users/{uuid} — removes the Bridge user and
        // every item beneath it. App-level credentials (Client-Id +
        // Client-Secret), NO user Bearer: the same posture as createUser, and
        // minting a user token for a user we are deleting would be circular.
        //
        // 404 is admitted as SUCCESS. The end state this call exists to reach is
        // "no such user at Bridge", and a 404 says we are already there. Story
        // 11-2 is fail-closed on this call, so treating "already gone" as a
        // failure would make a retried deletion permanently impossible.
        await req<unknown>(`/v3/aggregation/users/${encodeURIComponent(userUuid)}`, {
          method: "DELETE",
          allowStatuses: [404],
        });
        // Drop any cached user Bearer so a later call cannot mint against a
        // deleted user from cache.
        userTokenCache.delete(userUuid);
      },
  ```

  Now add the coverage. `apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts` uses top-level `test(...)` (no `describe`), a module-level `const env`, and a per-test fetch override wrapped in `try { … } finally { globalThis.fetch = prev; }`. Append these three tests at the end of that file, following that convention exactly:

  ```ts
  // ───── Story 11-2 (AC-6) — provider-side erasure ────────────────────────

  test("deleteUser: DELETE /v3/aggregation/users/{uuid}, app credentials, no user Bearer", async () => {
    const seen: Array<{ url: string; method: string; hasBearer: boolean }> = [];
    const localFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({
        url: typeof url === "string" ? url : String(url),
        method: init?.method ?? "GET",
        hasBearer: new Headers(init?.headers).has("Authorization"),
      });
      return new Response("", { status: 204 });
    });
    const prev = globalThis.fetch;
    globalThis.fetch = localFetch as unknown as typeof fetch;
    try {
      const provider = createBridgeProvider({ env });
      await provider.deleteUser({ userUuid: "bridge-uuid-1" });
      expect(seen).toHaveLength(1);
      expect(seen[0]!.url).toContain("/v3/aggregation/users/bridge-uuid-1");
      expect(seen[0]!.method).toBe("DELETE");
      // App-level call like createUser: minting a user token for the user we
      // are deleting would be circular.
      expect(seen[0]!.hasBearer).toBe(false);
    } finally {
      globalThis.fetch = prev;
    }
  });

  test("deleteUser: a 404 is SUCCESS — the user is already gone", async () => {
    const localFetch = mock(async () => new Response("", { status: 404 }));
    const prev = globalThis.fetch;
    globalThis.fetch = localFetch as unknown as typeof fetch;
    try {
      const provider = createBridgeProvider({ env });
      expect(await provider.deleteUser({ userUuid: "bridge-uuid-1" })).toBeUndefined();
    } finally {
      globalThis.fetch = prev;
    }
  });

  test("deleteUser: any other non-2xx throws bankProviderUnavailable", async () => {
    const localFetch = mock(async () => new Response("", { status: 500 }));
    const prev = globalThis.fetch;
    globalThis.fetch = localFetch as unknown as typeof fetch;
    try {
      const provider = createBridgeProvider({ env });
      expect(provider.deleteUser({ userUuid: "bridge-uuid-1" })).rejects.toThrow(
        "bank provider unavailable",
      );
    } finally {
      globalThis.fetch = prev;
    }
  });
  ```

  `mock`, `test`, `expect` and `env` are all already imported / declared at the top of that file — add nothing to its import block.

  Run: `cd apps/api && bun test src/modules/bank-aggregator/services/bridge-client.test.ts && bunx tsc --noEmit`
  Expected: every test in the file passes including the three new ones, `0 fail`; typecheck exits 0 with no output.
  Commit: `git add apps/api/src/modules/bank-aggregator/bank-provider.ts apps/api/src/modules/bank-aggregator/services/bridge-client.ts apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts && git commit -m "feat(#49): BankProvider.deleteUser for GDPR erasure at Bridge (AC-6)"`

- [x] **T11 — RED then GREEN: `eraseUserAtProvider` on the bank-aggregator service** [AC: AC-6]

  First, `makeStubs()` in `apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts` types its `provider` as `BankProvider`, so T9's new method makes that object incomplete. Find this line inside `makeStubs()`:

  ```ts
      revokeItem: async () => undefined,
  ```

  and replace it with:

  ```ts
      revokeItem: async () => undefined,
      deleteUser: async () => undefined,
  ```

  Now append these four tests at the end of the same file. It uses top-level `test(...)` (no `describe`) and the `makeStubs()` factory, which returns `{ repo, provider, transactionsService, accountsService }` — follow that convention exactly.

  ```ts
  // ───── Story 11-2 (AC-6) — erase the user at the bank provider ──────────

  const ERASE_USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  // listByUser returns full BankConnection DTOs (@pekulo/validators), so the
  // fixtures below carry every field rather than a convenient subset.
  function connectionFixture(
    id: string,
    providerItemId: string,
    status: "active" | "revoked",
  ) {
    return {
      id,
      userId: ERASE_USER,
      provider: "bridge" as const,
      providerItemId,
      status,
      displayName: "SG",
      lastRefreshedAt: null,
      lastSyncedAt: null,
      createdAt: new Date().toISOString(),
    };
  }

  test("eraseUserAtProvider: revokes each non-revoked item, then deletes the Bridge user", async () => {
    const { repo, provider, transactionsService, accountsService } = makeStubs();
    const order: string[] = [];
    repo.findProviderUserUuid = async () => "bridge-uuid-1";
    repo.listByUser = async () => [
      connectionFixture("bnk_1", "item-1", "active"),
      connectionFixture("bnk_2", "item-2", "revoked"),
      connectionFixture("bnk_3", "item-3", "active"),
    ];
    provider.revokeItem = async ({ providerItemId }) => {
      order.push(`revoke:${providerItemId}`);
    };
    provider.deleteUser = async ({ userUuid }) => {
      order.push(`deleteUser:${userUuid}`);
    };
    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [],
    });

    const result = await svc.eraseUserAtProvider(ERASE_USER);

    // The already-revoked connection is skipped; deleteUser always comes last.
    expect(order).toEqual(["revoke:item-1", "revoke:item-3", "deleteUser:bridge-uuid-1"]);
    expect(result).toEqual({ itemsRevoked: 2, providerUserDeleted: true });
  });

  test("eraseUserAtProvider: no-op when the user was never mapped to Bridge", async () => {
    const { repo, provider, transactionsService, accountsService } = makeStubs();
    let called = false;
    repo.findProviderUserUuid = async () => null;
    repo.listByUser = async () => [];
    provider.deleteUser = async () => {
      called = true;
    };
    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [],
    });

    expect(await svc.eraseUserAtProvider(ERASE_USER)).toEqual({
      itemsRevoked: 0,
      providerUserDeleted: false,
    });
    expect(called).toBe(false);
  });

  test("eraseUserAtProvider: a failing per-item revoke does NOT block deleteUser", async () => {
    const { repo, provider, transactionsService, accountsService } = makeStubs();
    let deleted = false;
    repo.findProviderUserUuid = async () => "bridge-uuid-1";
    repo.listByUser = async () => [connectionFixture("bnk_1", "item-1", "active")];
    provider.revokeItem = async () => {
      // Bridge mints a fresh item_id on every connect, so a stale local row can
      // reference an item that no longer exists and answer 404.
      throw new Error("bank provider unavailable: bridge DELETE /v3/aggregation/items/item-1 → 404");
    };
    provider.deleteUser = async () => {
      deleted = true;
    };
    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [],
    });

    expect(await svc.eraseUserAtProvider(ERASE_USER)).toEqual({
      itemsRevoked: 0,
      providerUserDeleted: true,
    });
    expect(deleted).toBe(true);
  });

  test("eraseUserAtProvider: a failing deleteUser propagates — the caller is fail-closed", async () => {
    const { repo, provider, transactionsService, accountsService } = makeStubs();
    repo.findProviderUserUuid = async () => "bridge-uuid-1";
    repo.listByUser = async () => [];
    provider.deleteUser = async () => {
      throw new Error("bank provider unavailable: bridge DELETE /v3/aggregation/users/x → 500");
    };
    const svc = createBankAggregatorService({
      repository: repo,
      provider,
      transactionsService,
      accountsService,
      listAllActiveConnections: async () => [],
    });

    expect(svc.eraseUserAtProvider(ERASE_USER)).rejects.toThrow("bank provider unavailable");
  });
  ```

  Run: `cd apps/api && bun test src/modules/bank-aggregator/bank-aggregator.service.test.ts`
  Expected: RED — the four new tests fail with `svc.eraseUserAtProvider is not a function`.

  Now the implementation. In `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`, find this existing declaration inside `export interface BankAggregatorService`:

  ```ts
    revokeConnection(userId: string, connectionId: string): Promise<{ ok: true }>;
  ```

  and insert the following immediately **after** it:

  ```ts
    /**
     * Story 11-2 (FR-50 / AC-6) — erase the user at the bank provider, as the
     * first step of account deletion. Revokes each non-revoked item, then
     * deletes the provider user (the authoritative call: it removes the user and
     * every item beneath it).
     *
     * A per-item revoke failure is swallowed; a deleteUser failure PROPAGATES.
     * Account deletion is fail-closed on this method, so the distinction is
     * load-bearing — see the implementation comment for why.
     */
    eraseUserAtProvider(
      userId: string,
    ): Promise<{ itemsRevoked: number; providerUserDeleted: boolean }>;
  ```

  Then find this existing method in the returned object:

  ```ts
      async backfillUserLogos(userId) {
  ```

  and insert the following immediately **before** it:

  ```ts
      async eraseUserAtProvider(userId) {
        const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
        // Never mapped to Bridge (no bank ever linked) — nothing to erase, and
        // the common case for a V1 account. Deletion proceeds with no provider
        // call at all, so fail-closed costs nothing on the normal path.
        if (!userUuid) return { itemsRevoked: 0, providerUserDeleted: false };

        const connections = await deps.repository.listByUser(userId);
        let itemsRevoked = 0;
        for (const connection of connections) {
          if (connection.status === "revoked") continue;
          try {
            // oxlint-disable-next-line eslint/no-await-in-loop -- sequential on purpose: Bridge rate-limits per user, and the loop is bounded by the user's own connection count
            await deps.provider.revokeItem({
              userUuid,
              providerItemId: connection.providerItemId,
            });
            itemsRevoked += 1;
          } catch {
            // Deliberately swallowed. This pass is a courtesy: it flips each
            // item's consent state at the bank before the relationship ends.
            // It is also the fragile half — Bridge mints a fresh item_id on
            // every connect, so a stale local row can reference an item that no
            // longer exists and answer 404. Letting that abort the erasure would
            // block a GDPR deletion on a bookkeeping mismatch.
            //
            // deleteUser below is what actually guarantees the end state: it
            // removes the Bridge user and every item beneath it. If it succeeds,
            // every item is gone whether or not this loop reached it. If it
            // fails, we throw and nothing local is touched.
          }
        }

        await deps.provider.deleteUser({ userUuid });
        return { itemsRevoked, providerUserDeleted: true };
      },
  ```

  Run: `cd apps/api && bun test src/modules/bank-aggregator/bank-aggregator.service.test.ts && bunx tsc --noEmit`
  Expected: the four new tests pass, `0 fail`; typecheck exits 0 with no output.
  Commit: `git add apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts && git commit -m "feat(#49): eraseUserAtProvider — revoke items then delete the Bridge user (AC-6)"`

- [x] **T12 — RED: the deletion-map guard** [AC: AC-4]

  This is the story's mechanical guard and it is written **before** the map it guards, so its first run proves it actually fails.

  Create `apps/api/src/modules/settings/settings.deletion-map.guard.test.ts` with exactly this content:

  ```ts
  // Story 11-2, AC-4 (verbatim from story 11-2-account-deletion:12):
  //   Given a database table that holds user data but was never added to the
  //   deletion, When the apps/api test suite runs, Then it fails and names that
  //   table. And given a table the export takes but the deletion leaves behind —
  //   or the reverse — When the suite runs, Then it fails and names it: what a
  //   user can take with them and what goes when they leave are asserted to be
  //   the same set, so a new table can never enter one without the other.
  //
  // This is the guard story 11-1's review asked for by name: "the deletion
  // cascade needs the same mechanical guard, not a prose reminder". The
  // set-equality assertion is the cheap part that does the most work — it means
  // the NEXT table only has to be remembered ONCE, in either list, and the build
  // names the other one.
  import { describe, expect, it } from "bun:test";
  import { Prisma } from "@generated/prisma/client";
  import { EXPORT_NODES } from "./settings.export";
  import { DELETION_NODES } from "./settings.deletion";

  // Kept in sync with settings.export-map.guard.test.ts by the set-equality test
  // below: a model declared non-user there and exported here (or the reverse)
  // cannot happen, because the two node lists must hold the same models.
  const NON_USER_MODELS = new Set<string>(["MerchantLogoCache", "ProviderLogoCache"]);

  function modelsWithUserId(): string[] {
    return Prisma.dmmf.datamodel.models
      .filter((model) => model.fields.some((field) => field.name === "userId"))
      .map((model) => model.name);
  }

  describe("settings deletion map (story 11-2)", () => {
    it("covers every Prisma model that carries a userId field", () => {
      const registered = new Set(DELETION_NODES.map((node) => node.model));
      const missing = modelsWithUserId().filter((name) => !registered.has(name));
      expect(
        missing,
        `Prisma model(s) hold user data but are absent from DELETION_NODES in ` +
          `apps/api/src/modules/settings/settings.deletion.ts — a GDPR erasure ` +
          `that leaves them behind is incomplete (FR-50). Add a node: ${missing.join(", ")}`,
      ).toEqual([]);
    });

    it("registers no model that Prisma does not know", () => {
      const known = new Set(Prisma.dmmf.datamodel.models.map((model) => model.name));
      const unknown = DELETION_NODES.map((node) => node.model).filter((name) => !known.has(name));
      expect(unknown, `DELETION_NODES references unknown model(s): ${unknown.join(", ")}`).toEqual(
        [],
      );
    });

    it("uses a unique key per node", () => {
      const keys = DELETION_NODES.map((node) => node.key);
      expect(new Set(keys).size, "duplicate key in DELETION_NODES").toBe(keys.length);
    });

    it("deletes exactly the models the export exports", () => {
      const exported = [...new Set(EXPORT_NODES.map((n) => n.model))].sort();
      const deleted = [...new Set(DELETION_NODES.map((n) => n.model))].sort();
      expect(
        deleted,
        `EXPORT_NODES and DELETION_NODES have drifted. They are two views of one ` +
          `answer to "what is my data": everything the user can take with them ` +
          `must be everything that goes when they leave. Add the missing model to ` +
          `whichever list lacks it — never silence this test.`,
      ).toEqual(exported);
    });

    it("accounts for every Prisma model as either deleted or explicitly non-user", () => {
      const deleted = new Set(DELETION_NODES.map((node) => node.model));
      const unaccounted = Prisma.dmmf.datamodel.models
        .map((model) => model.name)
        .filter((name) => !deleted.has(name) && !NON_USER_MODELS.has(name));
      expect(
        unaccounted,
        `model(s) are neither in DELETION_NODES nor declared non-user. The userId ` +
          `guard above only sees a field literally named \`userId\`, so a table ` +
          `scoped by another column slips past it — which is how an erasure goes ` +
          `quietly incomplete: ${unaccounted.join(", ")}`,
      ).toEqual([]);
    });

    it("orders children before their parents", () => {
      // A deleteMany on a parent cascades to children that declare ON DELETE
      // CASCADE, so a parent-first order is not WRONG — but it makes the counts
      // this method returns meaningless (the child reports 0 because the parent
      // already took its rows). Child-first keeps every count truthful, which is
      // what AC-1 asserts against.
      const position = new Map(DELETION_NODES.map((node, index) => [node.model, index]));
      const CHILD_BEFORE_PARENT: ReadonlyArray<readonly [string, string]> = [
        ["HoldingLot", "Holding"],
        ["Holding", "Account"],
        ["AccountBalanceLog", "Account"],
        ["Transaction", "Account"],
        ["RealEstateValuation", "RealEstate"],
        ["RealEstateMortgage", "RealEstate"],
        ["RealEstateRental", "RealEstate"],
      ];
      for (const [child, parent] of CHILD_BEFORE_PARENT) {
        expect(
          position.get(child)!,
          `${child} must be deleted before ${parent} so its row count stays truthful`,
        ).toBeLessThan(position.get(parent)!);
      }
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.deletion-map.guard.test.ts`
  Expected: RED — `Cannot find module './settings.deletion'`.
  Commit: (none — T12 and T13 land together; commit at the end of T13.)

- [x] **T13 — GREEN: `DELETION_NODES`, the vault purge, and `deleteUserData`** [AC: AC-1, AC-3, AC-4]

  Create `apps/api/src/modules/settings/settings.deletion.ts` with exactly this content:

  ```ts
  // apps/api/src/modules/settings/settings.deletion.ts
  // Story 11-2 (FR-50 / NFR-7 / DR-5). GDPR right to erasure — the local half.
  //
  // DELETION_NODES is the ordered mirror of EXPORT_NODES (settings.export.ts):
  // the same model set, asserted equal by settings.deletion-map.guard.test.ts,
  // in child-before-parent order.
  //
  // WHY EXPLICIT DELETES AND NOT THE auth.users CASCADE ALONE.
  // Four of the 21 user-scoped tables shipped with NO foreign key to auth.users
  // on any path — compass_history, milestones, user_pref and dashboard_layout —
  // while three of their migrations carried a comment asserting the opposite
  // ("row removal happens only via cascade from auth.users (story 11-2)"). An
  // erasure built on "the cascade handles it" silently left four tables of
  // personal data behind, and every test in the repo passed.
  // Migration 20260915120000_add_missing_auth_users_fk closes that hole and the
  // gate in scripts/rls-migration-audit.ts keeps it closed, but this explicit
  // fan-out stays: it is what makes the erasure deterministic, countable, and
  // survivable when the next table forgets its FK.
  //
  // The whole fan-out runs in ONE interactive transaction, so a failure halfway
  // through leaves the account intact rather than half-erased.
  import type { ExtendedPrismaClient } from "../../database";

  export interface DeletionNode {
    /** Key in the returned count map. snake_case, matches the table name. */
    readonly key: string;
    /** Prisma model name — must match a DMMF model (asserted by the guard test). */
    readonly model: string;
    /** Deletes every row this user owns. Always carries an explicit where: { userId }. */
    remove(client: ExtendedPrismaClient, userId: string): Promise<{ count: number }>;
  }

  // Child-before-parent. Deleting a parent first would cascade its children and
  // leave their counts reporting 0, which is exactly the evidence AC-1 needs.
  export const DELETION_NODES: readonly DeletionNode[] = [
    // --- accounts aggregate: leaves first, root last ---
    {
      key: "holding_lots",
      model: "HoldingLot",
      remove: (client, userId) => client.holdingLot.deleteMany({ where: { userId } }),
    },
    {
      key: "holdings",
      model: "Holding",
      remove: (client, userId) => client.holding.deleteMany({ where: { userId } }),
    },
    {
      key: "account_balance_log",
      model: "AccountBalanceLog",
      remove: (client, userId) => client.accountBalanceLog.deleteMany({ where: { userId } }),
    },
    {
      key: "transactions",
      model: "Transaction",
      remove: (client, userId) => client.transaction.deleteMany({ where: { userId } }),
    },
    {
      key: "accounts",
      model: "Account",
      remove: (client, userId) => client.account.deleteMany({ where: { userId } }),
    },
    // --- real-estate aggregate: children first, root last ---
    {
      key: "real_estate_valuations",
      model: "RealEstateValuation",
      remove: (client, userId) => client.realEstateValuation.deleteMany({ where: { userId } }),
    },
    {
      key: "real_estate_mortgage",
      model: "RealEstateMortgage",
      remove: (client, userId) => client.realEstateMortgage.deleteMany({ where: { userId } }),
    },
    {
      key: "real_estate_rental",
      model: "RealEstateRental",
      remove: (client, userId) => client.realEstateRental.deleteMany({ where: { userId } }),
    },
    {
      key: "real_estate",
      model: "RealEstate",
      remove: (client, userId) => client.realEstate.deleteMany({ where: { userId } }),
    },
    // --- independent tables: no intra-set FK, order is free ---
    {
      key: "kpis",
      model: "Kpi",
      remove: (client, userId) => client.kpi.deleteMany({ where: { userId } }),
    },
    {
      key: "monthly_tracking",
      model: "MonthlyTracking",
      remove: (client, userId) => client.monthlyTracking.deleteMany({ where: { userId } }),
    },
    {
      key: "monthly_records",
      model: "MonthlyRecord",
      remove: (client, userId) => client.monthlyRecord.deleteMany({ where: { userId } }),
    },
    {
      key: "hypotheses",
      model: "Hypothesis",
      remove: (client, userId) => client.hypothesis.deleteMany({ where: { userId } }),
    },
    {
      key: "compass_history",
      model: "CompassHistory",
      remove: (client, userId) => client.compassHistory.deleteMany({ where: { userId } }),
    },
    {
      key: "milestones",
      model: "Milestone",
      remove: (client, userId) => client.milestone.deleteMany({ where: { userId } }),
    },
    {
      key: "bank_connections",
      model: "BankConnection",
      remove: (client, userId) => client.bankConnection.deleteMany({ where: { userId } }),
    },
    {
      key: "bridge_users",
      model: "BridgeUser",
      remove: (client, userId) => client.bridgeUser.deleteMany({ where: { userId } }),
    },
    {
      key: "llm_call_log",
      model: "LlmCallLog",
      remove: (client, userId) => client.llmCallLog.deleteMany({ where: { userId } }),
    },
    {
      key: "llm_opt_in",
      model: "LlmOptIn",
      remove: (client, userId) => client.llmOptIn.deleteMany({ where: { userId } }),
    },
    {
      key: "user_pref",
      model: "UserPref",
      remove: (client, userId) => client.userPref.deleteMany({ where: { userId } }),
    },
    {
      key: "dashboard_layout",
      model: "DashboardLayout",
      remove: (client, userId) => client.dashboardLayout.deleteMany({ where: { userId } }),
    },
  ];

  /**
   * Purges the Supabase Vault secrets referenced by this user's bank
   * connections, BEFORE the connections themselves are deleted.
   *
   * Today these columns are vestigial NULL: Bridge v3 keeps OAuth tokens
   * server-side and mints a short-lived Bearer on demand, so Pekulo persists no
   * bank tokens (ADR-0015, docs/security.md). The FK is ON DELETE SET NULL, so
   * if the columns are ever written, deleting the connection would NULL the
   * reference and leave the vault row behind — a decrypted-on-demand credential
   * outliving the account that owned it. Ten lines now, rather than a comment
   * that ages into a leak.
   *
   * This is the ONE place apps/api runs raw SQL against something other than the
   * `SELECT 1` health probe. `vault.secrets` is outside Prisma's schema, so
   * there is no delegate to call; the query is parameterised (never
   * interpolated) and compares on `id::text` so the driver can pass a plain
   * text[] with no cast on the parameter side. Recorded in docs/security.md.
   */
  export async function purgeVaultSecrets(
    client: ExtendedPrismaClient,
    userId: string,
  ): Promise<number> {
    const rows = await client.bankConnection.findMany({
      where: { userId },
      select: { accessTokenSecretId: true, refreshTokenSecretId: true },
    });
    const ids = [
      ...new Set(
        rows
          .flatMap((row) => [row.accessTokenSecretId, row.refreshTokenSecretId])
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    if (ids.length === 0) return 0;
    return client.$executeRaw`DELETE FROM vault.secrets WHERE id::text = ANY(${ids})`;
  }

  export interface LocalErasureResult {
    rowsDeleted: Record<string, number>;
    vaultSecretsPurged: number;
  }

  // Prisma's default interactive-transaction timeout is 5 s. NFR-7 budgets 60 s
  // for the whole deletion, of which the provider call and the identity erase
  // take their own share — 45 s leaves room for both while still failing well
  // inside the budget rather than hanging.
  const DELETION_TX_TIMEOUT_MS = 45_000;
  const DELETION_TX_MAX_WAIT_MS = 5_000;

  /**
   * Deletes every row the user owns, in one transaction, and returns the row
   * count per table. Idempotent: a re-run on an already-erased user returns a
   * map of zeroes rather than failing.
   */
  export async function deleteUserData(
    client: ExtendedPrismaClient,
    userId: string,
  ): Promise<LocalErasureResult> {
    return client.$transaction(
      async (tx) => {
        // The interactive-transaction client is structurally the delegate
        // surface DELETION_NODES uses, but Prisma types it as a distinct type
        // (it drops $transaction / $connect / $disconnect). One documented cast
        // at the boundary beats threading a hand-written client type through 21
        // node definitions. Named `tx` so
        // pekulo/no-prisma-query-without-user-id still inspects every call
        // inside the nodes (.oxlintrc.json prismaIdentifier: ["prisma","tx","client"]).
        const txClient = tx as unknown as ExtendedPrismaClient;

        const vaultSecretsPurged = await purgeVaultSecrets(txClient, userId);

        const rowsDeleted: Record<string, number> = {};
        for (const node of DELETION_NODES) {
          // Sequential ON PURPOSE: the order is what keeps every count truthful
          // (a parent deleted first would cascade its children to 0) and what
          // keeps FK constraints satisfied without relying on cascade order.
          // Promise.all would discard both guarantees.
          // oxlint-disable-next-line eslint/no-await-in-loop
          const { count } = await node.remove(txClient, userId);
          rowsDeleted[node.key] = count;
        }
        return { rowsDeleted, vaultSecretsPurged };
      },
      { timeout: DELETION_TX_TIMEOUT_MS, maxWait: DELETION_TX_MAX_WAIT_MS },
    );
  }
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.deletion-map.guard.test.ts && bunx tsc --noEmit`
  Expected: `6 pass`, `0 fail`; typecheck exits 0 with no output.
  Commit: `git add apps/api/src/modules/settings/settings.deletion.ts apps/api/src/modules/settings/settings.deletion-map.guard.test.ts && git commit -m "feat(#49): DELETION_NODES + vault purge + transactional deleteUserData (FR-50)"`

- [x] **T14 — Unit-test the local erasure fan-out** [AC: AC-1, AC-3]

  Create `apps/api/src/modules/settings/settings.deletion.test.ts` with exactly this content:

  ```ts
  // Story 11-2, AC-1 + AC-3. Behaviour of the local fan-out against a fake
  // client: every node is issued, every call carries where.userId, the vault
  // purge runs before bank_connections is deleted, and the counts come back
  // keyed by table.
  //
  // Two tenants, always — a single-tenant fixture cannot prove isolation
  // (lesson 2026-05-27). Here the fake enforces the filter, so a node that
  // forgot `where: { userId }` deletes B's rows and the assertion catches it.
  import { describe, expect, test } from "bun:test";
  import { DELETION_NODES, deleteUserData, purgeVaultSecrets } from "./settings.deletion";
  import type { ExtendedPrismaClient } from "../../database";

  const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  interface Recorder {
    calls: string[];
    rawQueries: string[];
    rawParams: unknown[][];
    survivors: Map<string, string[]>;
  }

  // Each delegate owns two rows: one for A, one for B. deleteMany removes only
  // the rows whose userId matches the filter, so an unfiltered node wipes both.
  function fakeClient(
    recorder: Recorder,
    bankSecretIds: Array<[string | null, string | null]> = [],
  ): ExtendedPrismaClient {
    const delegate = (name: string) => ({
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        recorder.calls.push(name);
        const owners = recorder.survivors.get(name) ?? [USER_A, USER_B];
        const kept = owners.filter((owner) => owner !== where.userId);
        recorder.survivors.set(name, kept);
        return { count: owners.length - kept.length };
      },
      findMany: async ({ where }: { where: { userId: string } }) => {
        recorder.calls.push(`${name}.findMany`);
        if (where.userId !== USER_A) return [];
        return bankSecretIds.map(([accessTokenSecretId, refreshTokenSecretId]) => ({
          accessTokenSecretId,
          refreshTokenSecretId,
        }));
      },
    });
    const root = {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(root),
      $executeRaw: async (strings: TemplateStringsArray, ...params: unknown[]) => {
        recorder.rawQueries.push(strings.join("?"));
        recorder.rawParams.push(params);
        return (params[0] as string[]).length;
      },
    };
    return new Proxy(root, {
      get: (target, prop: string) =>
        prop in target ? (target as Record<string, unknown>)[prop] : delegate(prop),
    }) as unknown as ExtendedPrismaClient;
  }

  function newRecorder(): Recorder {
    return { calls: [], rawQueries: [], rawParams: [], survivors: new Map() };
  }

  describe("deleteUserData (story 11-2)", () => {
    // AC-1 (verbatim from story 11-2-account-deletion:9):
    //   Given a signed-in user holding rows across the 21 user-scoped tables,
    //   When they confirm deletion […] Then every row they own is removed from
    //   all 21 tables […]
    test("AC-1 — issues one delete per node and returns a count per table", async () => {
      const recorder = newRecorder();
      const result = await deleteUserData(fakeClient(recorder), USER_A);

      expect(DELETION_NODES).toHaveLength(21);
      expect(Object.keys(result.rowsDeleted).sort()).toEqual(
        DELETION_NODES.map((node) => node.key).sort(),
      );
      for (const node of DELETION_NODES) {
        expect(result.rowsDeleted[node.key], `${node.key} reported no deletion`).toBe(1);
      }
    });

    test("AC-1 — deletes in DELETION_NODES order, children before parents", async () => {
      const recorder = newRecorder();
      await deleteUserData(fakeClient(recorder), USER_A);
      const deleteCalls = recorder.calls.filter((call) => !call.endsWith(".findMany"));
      expect(deleteCalls).toEqual([
        "holdingLot",
        "holding",
        "accountBalanceLog",
        "transaction",
        "account",
        "realEstateValuation",
        "realEstateMortgage",
        "realEstateRental",
        "realEstate",
        "kpi",
        "monthlyTracking",
        "monthlyRecord",
        "hypothesis",
        "compassHistory",
        "milestone",
        "bankConnection",
        "bridgeUser",
        "llmCallLog",
        "llmOptIn",
        "userPref",
        "dashboardLayout",
      ]);
    });

    // AC-3 (verbatim from story 11-2-account-deletion:11):
    //   Given two users A and B who each own rows in every user-scoped table,
    //   When A deletes their account, Then not one row belonging to B is
    //   removed, on any of the 21 tables […]
    test("AC-3 — user B keeps every row on every one of the 21 tables", async () => {
      const recorder = newRecorder();
      await deleteUserData(fakeClient(recorder), USER_A);
      // Every node must have run (otherwise `survivors` is silently empty and
      // the assertion below would pass by vacuity)…
      expect(recorder.survivors.size).toBe(DELETION_NODES.length);
      // …and every one of them must have left B's row standing.
      for (const [table, owners] of recorder.survivors) {
        expect(owners, `${table} lost user B's row`).toEqual([USER_B]);
      }
    });

    test("AC-1 — is idempotent: a second run reports zeroes, not an error", async () => {
      const recorder = newRecorder();
      const client = fakeClient(recorder);
      await deleteUserData(client, USER_A);
      const second = await deleteUserData(client, USER_A);
      for (const node of DELETION_NODES) {
        expect(second.rowsDeleted[node.key]).toBe(0);
      }
    });
  });

  describe("purgeVaultSecrets (story 11-2)", () => {
    test("is a no-op when every secret reference is NULL (the state today)", async () => {
      const recorder = newRecorder();
      const client = fakeClient(recorder, [[null, null]]);
      expect(await purgeVaultSecrets(client, USER_A)).toBe(0);
      expect(recorder.rawQueries).toEqual([]);
    });

    test("purges every distinct non-null secret id, parameterised", async () => {
      const recorder = newRecorder();
      const client = fakeClient(recorder, [
        ["sec-1", "sec-2"],
        ["sec-1", null],
      ]);
      expect(await purgeVaultSecrets(client, USER_A)).toBe(2);
      expect(recorder.rawQueries).toHaveLength(1);
      expect(recorder.rawQueries[0]).toContain("DELETE FROM vault.secrets");
      // Parameterised, never interpolated: the ids arrive as a bound param.
      expect(recorder.rawParams[0]).toEqual([["sec-1", "sec-2"]]);
    });

    test("runs BEFORE bank_connections is deleted", async () => {
      const recorder = newRecorder();
      await deleteUserData(fakeClient(recorder, [["sec-1", null]]), USER_A);
      const readIndex = recorder.calls.indexOf("bankConnection.findMany");
      const deleteIndex = recorder.calls.indexOf("bankConnection");
      expect(readIndex).toBeGreaterThanOrEqual(0);
      expect(readIndex).toBeLessThan(deleteIndex);
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.deletion.test.ts`
  Expected: `7 pass`, `0 fail`.
  Commit: `git add apps/api/src/modules/settings/settings.deletion.test.ts && git commit -m "test(#49): local erasure fan-out — order, isolation, vault purge (AC-1, AC-3)"`

- [x] **T15 — RED then GREEN: `deleteAccount` on the settings service** [AC: AC-1, AC-6, AC-7]

  Append this `describe` block to `apps/api/src/modules/settings/settings.service.test.ts`, and add the imports it needs at the top of that file next to the existing ones:

  ```ts
  import { isPekuloError } from "../../common/errors";
  ```

  ```ts
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

    // AC-6 (verbatim from story 11-2-account-deletion:14):
    //   […] Then the Bridge user is deleted at the provider […] BEFORE any local
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
      expect(
        service.deleteAccount(USER_A, EMAIL_A, { confirmationEmail: EMAIL_A }),
      ).rejects.toThrow("bank provider unavailable");
      expect(order).toEqual([]);
    });

    // AC-7 (verbatim from story 11-2-account-deletion:15):
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
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.service.test.ts`
  Expected: RED — the new tests fail with `service.deleteAccount is not a function`.

  Now replace the entire content of `apps/api/src/modules/settings/settings.service.ts` with:

  ```ts
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
  import type { DeleteAccountInput, DeleteAccountResult } from "@pekulo/validators";
  import { PekuloError } from "../../common/errors";
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
      input: DeleteAccountInput,
    ): Promise<DeleteAccountResult>;
  }

  // One retry, short: a transient Supabase blip should not leave the account in
  // the "data gone, login still works" state, and two failures in 250 ms is a
  // real outage rather than a hiccup.
  const IDENTITY_RETRY_DELAY_MS = 250;

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
    try {
      await port.deleteUser(userId);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, IDENTITY_RETRY_DELAY_MS));
    }
    try {
      await port.deleteUser(userId);
    } catch (err) {
      // The data is already gone; only the account shell remains, and the user
      // has no session left to retry with. This log line is the ONLY record that
      // can finish the job, which is why it carries the id: keeping it is
      // necessary to complete the erasure, not retention for its own sake.
      console.error(
        JSON.stringify({
          event: "account_deletion.identity_erase_failed",
          userId,
          reasonClass: err instanceof Error ? err.constructor.name : typeof err,
        }),
      );
      throw new PekuloError(
        "INTERNAL",
        "account data was erased but the identity could not be removed; contact support",
        { cause: err },
      );
    }
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
        //    signable-into account — degraded and loudly logged, but recoverable.
        //    Erasing the identity first and then failing at step 2 would strand
        //    orphan rows with no session left to retry from: worse, and silent.
        await eraseIdentity(deps.authAdmin, userId);

        return { ok: true as const, rowsDeleted, vaultSecretsPurged };
      },
    };
  }
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.service.test.ts`
  Expected: every test passes including the seven new ones, `0 fail`.
  Commit: `git add apps/api/src/modules/settings/settings.service.ts apps/api/src/modules/settings/settings.service.test.ts && git commit -m "feat(#49): settings.deleteAccount — provider, data, identity, in that order (FR-50)"`

- [x] **T16 — Wire the `deleteAccount` oRPC handler** [AC: AC-1, AC-7]

  In `apps/api/src/modules/settings/settings.routes.ts`, find this existing block:

  ```ts
      updateLang: impl.updateLang.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.updateLang(context.userId, input.lang);
      }),
    });
  }
  ```

  and replace it with:

  ```ts
      updateLang: impl.updateLang.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.updateLang(context.userId, input.lang);
      }),
      // Story 11-2 (FR-50). `context.email` is the email claim from the verified
      // JWT — passed through so the service can check the typed confirmation
      // against the real account. The handler does no checking of its own: the
      // confirmation is an authorization rule and belongs in the service, where
      // the unit tests can reach it.
      deleteAccount: impl.deleteAccount.handler(async ({ context, input }) => {
        requireUserId(context.userId);
        return deps.service.deleteAccount(context.userId, context.email, input);
      }),
    });
  }
  ```

  Run: `cd apps/api && bunx tsc --noEmit`
  Expected: it fails only in `settings.module.ts` (`Property 'providerErasure' is missing`), which T17 fixes. If any error points at `settings.routes.ts` itself, stop and fix it before continuing.
  Commit: (none — T16 and T17 land together; commit at the end of T17.)

- [x] **T17 — Compose the module and the runtime wiring** [AC: AC-1, AC-6]

  Replace the entire content of `apps/api/src/modules/settings/settings.module.ts` with:

  ```ts
  // Module factory wiring repository + service + router for the settings
  // domain (story 8-2). Mirrors ADR-0009 (createXxxModule(deps) → { service, router }).
  // L8: the router type is inferred via ReturnType<typeof createSettingsRouter>;
  // never annotate as `Elysia` or any concrete oRPC implementation type.
  //
  // Story 11-1 adds `exportRoutes`: an Elysia-native streaming route mounted
  // alongside the oRPC router (app.ts), because a stream cannot travel through
  // the oRPC envelope. It needs the JWT verifier directly — mountOrpc's context
  // injection does not cover Elysia-native routes.
  //
  // Story 11-2 adds the three erasure ports. `providerErasure` and `authAdmin`
  // are injected by the runtime composition layer (runtime-dependencies.ts):
  // the bank-aggregator service is built later in that file, and the Supabase
  // admin client needs a credential this module has no business reading.
  // `localData` is wired here because deleteUserData only needs the client this
  // module already holds.
  import type { PrismaService } from "../../database";
  import type { JwtVerifier } from "../../platform/security";
  import { createSettingsRepository } from "./settings.repository";
  import {
    createSettingsService,
    type IdentityErasurePort,
    type ProviderErasurePort,
    type SettingsService,
  } from "./settings.service";
  import { createSettingsRouter } from "./settings.routes";
  import { registerSettingsExportRoutes } from "./settings.export-routes";
  import { deleteUserData } from "./settings.deletion";

  export interface SettingsModule {
    service: SettingsService;
    router: ReturnType<typeof createSettingsRouter>;
    exportRoutes: ReturnType<typeof registerSettingsExportRoutes>;
  }

  export function createSettingsModule(deps: {
    prismaService: PrismaService;
    jwtVerifier: JwtVerifier;
    providerErasure: ProviderErasurePort;
    authAdmin: IdentityErasurePort;
  }): SettingsModule {
    const repository = createSettingsRepository({ client: deps.prismaService.client });
    const service = createSettingsService({
      repository,
      providerErasure: deps.providerErasure,
      localData: { erase: (userId) => deleteUserData(deps.prismaService.client, userId) },
      authAdmin: deps.authAdmin,
    });
    const router = createSettingsRouter({ service });
    const exportRoutes = registerSettingsExportRoutes({
      client: deps.prismaService.client,
      jwtVerifier: deps.jwtVerifier,
    });
    return { service, router, exportRoutes };
  }
  ```

  Then, in `apps/api/src/bootstrap/runtime-dependencies.ts`, add this import next to the existing `createJwtVerifier` import:

  ```ts
  import { createSupabaseAuthAdmin } from "../platform/auth";
  ```

  and replace this existing line:

  ```ts
    // Story 8-2 (FR-51/FR-52) — per-user theme/lang preferences. A pure per-user
    // singleton store; only needs prismaService (mirrors dashboard's layout half).
    const settingsModule = createSettingsModule({ prismaService, jwtVerifier });
  ```

  with:

  ```ts
    // Story 8-2 (FR-51/FR-52) — per-user theme/lang preferences.
    // Story 11-2 (FR-50) — the same module owns GDPR account deletion, so it
    // needs two ports built outside it: erasure at the bank provider (the
    // bank-aggregator service, constructed above) and erasure of the Supabase
    // Auth user (the admin client, which holds the service-role credential).
    const settingsModule = createSettingsModule({
      prismaService,
      jwtVerifier,
      providerErasure: { eraseUser: (userId) => bankAggregatorModule.service.eraseUserAtProvider(userId) },
      authAdmin: createSupabaseAuthAdmin({
        supabaseUrl: input.env.SUPABASE_URL,
        serviceRoleKey: input.env.SUPABASE_SERVICE_ROLE_KEY,
      }),
    });
  ```

  Run: `cd apps/api && bunx tsc --noEmit && bun test`
  Expected: typecheck exits 0 with no output; the whole apps/api suite passes, `0 fail`.
  Commit: `git add apps/api/src/modules/settings/settings.module.ts apps/api/src/modules/settings/settings.routes.ts apps/api/src/bootstrap/runtime-dependencies.ts && git commit -m "feat(#49): wire the three erasure ports into the settings module (FR-50)"`

- [x] **T18 — HTTP-boundary proof: two tenants, 401, and the confirmation gate** [AC: AC-3, AC-7]

  In `apps/api/src/modules/settings/settings.integration.test.ts`, the `inMemorySettingsService()` helper no longer satisfies `SettingsService` (it lacks `deleteAccount`). Replace this existing block:

  ```ts
      async updateLang(userId, lang) {
        const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), lang };
        rows.set(userId, next);
        return next;
      },
    };
  }
  ```

  with:

  ```ts
      async updateLang(userId, lang) {
        const next = { ...(rows.get(userId) ?? DEFAULT_USER_PREF), lang };
        rows.set(userId, next);
        return next;
      },
      // Story 11-2. Mirrors the real service's confirmation rule so the boundary
      // test proves the rule survives the RPC envelope, and records which users
      // were erased so tenant isolation is assertable.
      async deleteAccount(userId, sessionEmail, input) {
        if (
          !sessionEmail ||
          sessionEmail.trim().toLowerCase() !== input.confirmationEmail.trim().toLowerCase()
        ) {
          throw new PekuloError("FORBIDDEN", "confirmation email does not match");
        }
        rows.delete(userId);
        erased.push(userId);
        return { ok: true as const, rowsDeleted: { accounts: 1 }, vaultSecretsPurged: 0 };
      },
    };
  }
  ```

  Add `const erased: string[] = [];` immediately above `function inMemorySettingsService(): SettingsService {`, and add this import next to the existing `extractRequestId` import:

  ```ts
  import { PekuloError } from "../../common/errors";
  ```

  Then append this `describe` block at the end of the file:

  ```ts
  describe("settings.deleteAccount HTTP boundary (story 11-2)", () => {
    // The signer in this file puts `${userId}@pekulo.local` in the email claim,
    // so that string is what a correct confirmation must carry.
    const emailOf = (userId: string) => `${userId}@pekulo.local`;

    // AC-7 (verbatim from story 11-2-account-deletion:15):
    //   Given a call to settings.deleteAccount with no Authorization header or
    //   an invalid Bearer token, Then apps/api answers 401 […]
    test("AC-7 — deleteAccount without a JWT returns 401 and erases nobody", async () => {
      const before = erased.length;
      const res = await call("deleteAccount", { confirmationEmail: emailOf(USER_A) });
      expect(res.status).toBe(401);
      expect(((await res.json()) as { code: string }).code).toBe("UNAUTHORIZED");
      expect(erased.length).toBe(before);
    });

    test("AC-7 — a mismatched confirmation email returns 403 and erases nobody", async () => {
      const before = erased.length;
      const res = await call(
        "deleteAccount",
        { confirmationEmail: "someone@else.test" },
        await signFor(USER_A),
      );
      expect(res.status).toBe(403);
      expect(erased.length).toBe(before);
    });

    // AC-3 (verbatim from story 11-2-account-deletion:11):
    //   Given two users A and B […] When A deletes their account, Then not one
    //   row belonging to B is removed […]
    test("AC-3 — A's deletion erases A and only A, keyed by the verified JWT subject", async () => {
      const res = await call(
        "deleteAccount",
        { confirmationEmail: emailOf(USER_A) },
        await signFor(USER_A),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: { ok: true; rowsDeleted: Record<string, number> } };
      expect(body.json.ok).toBe(true);
      expect(body.json.rowsDeleted).toEqual({ accounts: 1 });
      expect(erased).toEqual([USER_A]);
      expect(erased).not.toContain(USER_B);
    });

    test("AC-7 — A cannot delete B by naming B's email: the subject wins", async () => {
      // The confirmation names the account; the JWT subject decides which
      // account is destroyed. A token for A carrying B's email must fail the
      // confirmation rather than reach B.
      const before = [...erased];
      const res = await call(
        "deleteAccount",
        { confirmationEmail: emailOf(USER_B) },
        await signFor(USER_A),
      );
      expect(res.status).toBe(403);
      expect(erased).toEqual(before);
    });
  });
  ```

  Run: `cd apps/api && bun test src/modules/settings/settings.integration.test.ts`
  Expected: every test in the file passes including the four new ones, `0 fail`.
  Commit: `git add apps/api/src/modules/settings/settings.integration.test.ts && git commit -m "test(#49): deleteAccount HTTP boundary — 401, 403, tenant isolation (AC-3, AC-7)"`

- [x] **T19 — i18n copy for the deletion row and dialog** [AC: AC-8]

  The copy comes from the ux-preview SSOT (`docs/ux-preview/src/App.tsx:1799-1809`) and `docs/ux/flows.md` § Account deletion, not from invention (2026-05-17 lesson).

  In `apps/web/messages/fr.json`, replace this existing block:

  ```json
      "data": {
        "title": "Vos données",
        "exportLabel": "Exporter mes données",
        "exportSub": "JSON complet · conforme RGPD",
        "exportAction": "Exporter"
      }
  ```

  with:

  ```json
      "data": {
        "title": "Vos données",
        "exportLabel": "Exporter mes données",
        "exportSub": "JSON complet · conforme RGPD",
        "exportAction": "Exporter",
        "deleteLabel": "Supprimer mon compte",
        "deleteSub": "Cascade sur toutes les tables · irréversible",
        "deleteAction": "Supprimer",
        "deleteTitle": "Supprimer définitivement ce compte ?",
        "deleteDescription": "Toutes vos données seront effacées : comptes, transactions, portefeuille, immobilier, objectifs et préférences. Vos connexions bancaires seront révoquées chez notre prestataire. Cette action est irréversible.",
        "deleteConfirmPrompt": "Saisissez {email} pour confirmer.",
        "deleteConfirmLabel": "Adresse e-mail du compte",
        "deleteConfirm": "Supprimer définitivement",
        "deleteLoading": "Suppression…",
        "deleteProviderError": "Impossible de joindre notre prestataire bancaire. Aucune donnée n'a été supprimée — réessayez dans quelques minutes.",
        "deleteGenericError": "La suppression a échoué. Aucune donnée n'a été supprimée."
      }
  ```

  In `apps/web/messages/en.json`, replace this existing block:

  ```json
      "data": {
        "title": "Your data",
        "exportLabel": "Export my data",
        "exportSub": "Complete JSON · GDPR compliant",
        "exportAction": "Export"
      }
  ```

  with:

  ```json
      "data": {
        "title": "Your data",
        "exportLabel": "Export my data",
        "exportSub": "Complete JSON · GDPR compliant",
        "exportAction": "Export",
        "deleteLabel": "Delete my account",
        "deleteSub": "Cascades across every table · irreversible",
        "deleteAction": "Delete",
        "deleteTitle": "Permanently delete this account?",
        "deleteDescription": "All of your data will be erased: accounts, transactions, portfolio, real estate, goals and preferences. Your bank connections will be revoked at our provider. This cannot be undone.",
        "deleteConfirmPrompt": "Type {email} to confirm.",
        "deleteConfirmLabel": "Account email address",
        "deleteConfirm": "Delete permanently",
        "deleteLoading": "Deleting…",
        "deleteProviderError": "We could not reach our banking provider. Nothing was deleted — please try again in a few minutes.",
        "deleteGenericError": "Deletion failed. Nothing was deleted."
      }
  ```

  Run: `cd apps/web && node -e "const f=JSON.parse(require('fs').readFileSync('messages/fr.json','utf8')),e=JSON.parse(require('fs').readFileSync('messages/en.json','utf8'));const a=Object.keys(f.settings.data).sort(),b=Object.keys(e.settings.data).sort();if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('key drift');console.log('both parse, '+a.length+' keys, fr/en in parity')"`
  Expected: `both parse, 15 keys, fr/en in parity`, exit 0.
  Commit: `git add apps/web/messages/fr.json apps/web/messages/en.json && git commit -m "feat(#49): fr/en copy for the account-deletion row and dialog (AC-8)"`

- [x] **T20 — The server action** [AC: AC-1, AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts` with exactly this content:

  ```ts
  "use server";

  // apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts
  // Story 11-2 (FR-50). Thin oRPC delegator — zero business logic on the web
  // tier (ADR-0010). Its one web-tier responsibility is clearing the session
  // AFTER the account is gone: the httpOnly auth cookies (story 11-7) survive
  // the Supabase Auth user, so without this the browser would keep presenting a
  // cookie for a user that no longer exists.
  //
  // No `tags`: there is nothing left to invalidate, and the user is about to
  // leave the app.
  import { defineAction } from "@zapaction/core";
  import {
    deleteAccountInputSchema,
    type DeleteAccountInput,
    type DeleteAccountResult,
  } from "@pekulo/validators";
  import { settingsClient } from "@/lib/orpc/modules";
  import { ensureRequestContext } from "@/lib/orpc/request-context";
  import { createClient } from "@/lib/supabase/server";
  import type { ActionContext } from "@/lib/zapaction/context";
  import "@/lib/zapaction/context";

  export const deleteAccount = defineAction<DeleteAccountInput, DeleteAccountResult, ActionContext>({
    name: "deleteAccount",
    input: deleteAccountInputSchema,
    handler: async ({ input }) => {
      await ensureRequestContext();
      const result = await settingsClient.deleteAccount(input);

      // Order matters here too: only clear the session once apps/api has
      // confirmed the deletion. Clearing first would leave a user whose
      // deletion failed logged out of an account that still exists.
      //
      // signOut() can legitimately fail now that the user is gone — Supabase has
      // nothing left to revoke. The SSR client still clears the cookies through
      // its setAll handler, and the account is already deleted, so a failure
      // here must never surface as an error to the caller.
      const supabase = await createClient();
      try {
        await supabase.auth.signOut();
      } catch {
        // Intentionally swallowed — see above.
      }

      return result;
    },
  });
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts" && git commit -m "feat(#49): deleteAccount server action + session teardown (FR-50)"`

- [x] **T21 — The mutation hook** [AC: AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts` with exactly this content:

  ```ts
  "use client";

  // apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts
  // Story 11-2 (FR-50). The orchestration boundary ADR-0010 requires: the
  // dialog component never reaches the server action directly.
  //
  // No `invalidateWithTags`: every cached query belongs to an account that no
  // longer exists, and the component navigates away from the app on success.
  import { useActionMutation } from "@zapaction/query";
  import { deleteAccount } from "../_actions/delete-account-action";

  export function useDeleteAccount() {
    return useActionMutation(deleteAccount, {});
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts" && git commit -m "feat(#49): useDeleteAccount hook (ADR-0010 triad)"`

- [x] **T22 — The confirmation dialog** [AC: AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.tsx` with exactly this content:

  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.tsx
  // Story 11-2 (FR-50 / AC-8). Destructive confirmation dialog. Shape follows
  // the sibling reference implementation
  // immobilier/_components/property-delete-confirm.tsx: PekuloDialog +
  // Portal/Overlay/Content, a danger button from inline CSSProperties, a plain
  // Close for cancel.
  //
  // The typed-email gate comes from docs/ux/flows.md § Account deletion ("Type
  // the email to confirm"). The client gate is UX: the SERVER performs the same
  // comparison against the email on the verified JWT, so a direct RPC call with
  // no dialog is refused too (AC-7).
  //
  // Every label rides a Tamagui <Text>, never bare DOM text: `--f-family` is
  // scoped to Tamagui's `font_*` classes, so raw text inside a View renders in
  // the browser-default serif (lesson 2026-07-13). Icons live INSIDE their
  // <Text> so they inherit colour via currentColor rather than falling back to
  // the UA default on a dark card (lesson from story 11-1's review, where an
  // uncoloured icon measured ~1.03:1).
  import { useState, type CSSProperties } from "react";
  import { useTranslations } from "next-intl";
  import { useRouter } from "next/navigation";
  import { Trash2 } from "lucide-react";
  import {
    PekuloDialog,
    PekuloDialogCloseX as DialogCloseX,
    PekuloInput,
    PekuloLabel,
    pekuloFontSizes,
    pekuloRadius,
  } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { purgeOfflineCache } from "@/lib/offline/cache-db";
  import { useDeleteAccount } from "../_hooks/use-delete-account";

  const dangerBtn = (disabled: boolean): CSSProperties => ({
    alignSelf: "flex-start",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    backgroundColor: "var(--danger)",
    color: "var(--colorOnAccent)",
    height: 40,
    padding: "0 16px",
    borderRadius: pekuloRadius.full,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    fontSize: pekuloFontSizes.bodySm,
    fontWeight: 500,
  });

  const CONFIRM_INPUT_ID = "delete-account-confirm-email";

  export interface DeleteAccountConfirmProps {
    /** The signed-in account's email — the string the user must retype. */
    email: string;
    open: boolean;
    onOpenChange: (next: boolean) => void;
  }

  export function DeleteAccountConfirm({ email, open, onOpenChange }: DeleteAccountConfirmProps) {
    const t = useTranslations("settings.data");
    const tCommon = useTranslations("common");
    const router = useRouter();
    const { mutate, isPending, error, reset } = useDeleteAccount();
    const [typed, setTyped] = useState("");

    // Same normalisation the server applies, so the button never enables on a
    // value the server will then refuse.
    const matches = typed.trim().toLowerCase() === email.trim().toLowerCase();

    const handleClose = (next: boolean) => {
      if (!next) {
        setTyped("");
        reset();
      }
      onOpenChange(next);
    };

    const handleConfirm = () => {
      if (!matches || isPending) return;
      mutate(
        { confirmationEmail: typed.trim() },
        {
          onSuccess: async () => {
            // AC-8 + ADR-0003: the session is gone, so the decrypted-at-rest
            // snapshot must go with it before we leave the page.
            // `onAuthStateChange('SIGNED_OUT')` never fires here (auth runs
            // server-side under httpOnly cookies), which is why this mirrors
            // _account/_components/sign-out-button.tsx. Exception-safe on both
            // sides: the account is ALREADY deleted, so a storage failure must
            // never cost the user the navigation below.
            await purgeOfflineCache().catch(() => undefined);
            // docs/ux/flows.md § Account deletion ends on `/`, not `/login`:
            // there is no account to sign back into.
            router.push("/");
            router.refresh();
          },
        },
      );
    };

    const errorMessage = error
      ? error.message.includes("bank provider unavailable")
        ? t("deleteProviderError")
        : t("deleteGenericError")
      : null;

    return (
      <PekuloDialog open={open} onOpenChange={handleClose}>
        <PekuloDialog.Portal>
          <PekuloDialog.Overlay />
          <PekuloDialog.Content>
            <DialogCloseX />
            <View flexDirection="column" gap="$3" padding="$4">
              <PekuloDialog.Title>{t("deleteTitle")}</PekuloDialog.Title>
              <PekuloDialog.Description>{t("deleteDescription")}</PekuloDialog.Description>

              <View flexDirection="column" gap="$2">
                <PekuloLabel htmlFor={CONFIRM_INPUT_ID}>{t("deleteConfirmLabel")}</PekuloLabel>
                <Text color="$colorTertiary" fontSize="$caption">
                  {t("deleteConfirmPrompt", { email })}
                </Text>
                <PekuloInput
                  id={CONFIRM_INPUT_ID}
                  type="email"
                  autoComplete="off"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  disabled={isPending}
                />
              </View>

              {errorMessage && (
                <Text role="alert" color="$danger" fontSize="$caption">
                  {errorMessage}
                </Text>
              )}

              <View flexDirection="row" gap="$3" alignItems="center">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={!matches || isPending}
                  aria-disabled={!matches || isPending}
                  aria-busy={isPending}
                  style={dangerBtn(!matches || isPending)}
                >
                  <Trash2 size={14} strokeWidth={2} color="currentColor" aria-hidden />
                  {isPending ? t("deleteLoading") : t("deleteConfirm")}
                </button>
                <PekuloDialog.Close asChild>
                  <View
                    render="button"
                    paddingVertical="$2"
                    cursor="pointer"
                    backgroundColor="transparent"
                    borderWidth={0}
                  >
                    <Text color="$colorTertiary" fontSize="$caption" hoverStyle={{ color: "$color" }}>
                      {tCommon("cancel")}
                    </Text>
                  </View>
                </PekuloDialog.Close>
              </View>
            </View>
          </PekuloDialog.Content>
        </PekuloDialog.Portal>
      </PekuloDialog>
    );
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.tsx" && git commit -m "feat(#49): destructive account-deletion confirmation dialog (AC-8)"`

- [x] **T23 — The destructive settings row** [AC: AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.tsx` with exactly this content:

  ```tsx
  "use client";

  // apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.tsx
  // Story 11-2 (FR-50 / AC-8). The second row of « Vos données ». Copy and
  // shape come verbatim from the ux-preview SSOT
  // (docs/ux-preview/src/App.tsx:1799-1809), which the 2026-05-17 lesson makes
  // authoritative over story prose: label « Supprimer mon compte », sub
  // « Cascade sur toutes les tables · irréversible », `destructive`, action
  // `<Trash2 size={14} strokeWidth={2} aria-hidden /> Supprimer`.
  //
  // The icon lives INSIDE the <Text> so it inherits the row's colour through
  // currentColor. As a sibling it inherits nothing: reset.css sets
  // `a { color: inherit }`, nothing up the tree declares a colour, and lucide's
  // stroke="currentColor" then resolves to the UA default black on the #0a0a0a
  // card — about 1.03:1. Found in story 11-1's review on the export row; the
  // same trap applies here.
  import { useState } from "react";
  import { Trash2 } from "lucide-react";
  import { PekuloSettingRow } from "@pekulo/ui";
  import { Text, View } from "@pekulo/ui/client";
  import { DeleteAccountConfirm } from "./delete-account-confirm";

  export interface DeleteAccountRowProps {
    label: string;
    sub: string;
    action: string;
    /** The signed-in account's email — retyped in the dialog to confirm. */
    email: string;
  }

  export function DeleteAccountRow({ label, sub, action, email }: DeleteAccountRowProps) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <PekuloSettingRow
          label={label}
          sub={sub}
          destructive
          action={
            <View
              render="button"
              onPress={() => setOpen(true)}
              // The visible word is « Supprimer ». Out of context — a
              // screen-reader controls rotor, or beside story 11-1's identically
              // shaped « Exporter » row directly above — that says nothing. The
              // full row label carries the meaning and contains the visible
              // text, so WCAG 2.5.3 (Label in Name) holds. Same reasoning as
              // export-data-row.tsx.
              aria-label={label}
              cursor="pointer"
              backgroundColor="transparent"
              borderWidth={0}
              padding={0}
              hoverStyle={{ opacity: 0.8 }}
              pressStyle={{ opacity: 0.6 }}
            >
              <Text
                display="flex"
                flexDirection="row"
                alignItems="center"
                gap="$2"
                color={"$danger" as never}
                fontSize="$caption"
              >
                <Trash2 size={14} strokeWidth={2} color="currentColor" aria-hidden />
                {action}
              </Text>
            </View>
          }
        />
        <DeleteAccountConfirm email={email} open={open} onOpenChange={setOpen} />
      </>
    );
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.tsx" && git commit -m "feat(#49): destructive « Supprimer mon compte » settings row (AC-8)"`

- [x] **T24 — Mount the row in « Vos données »** [AC: AC-8]

  `DataSection` is an RSC and needs the signed-in account's email to pass down. The three lines that read it are copied verbatim from the sibling `_account/_components/account-section.tsx`, which already does exactly this behind the same auth guard — one path to the value, not two.

  Replace the entire content of `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx` with:

  ```tsx
  // apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx
  // Story 11-1 (FR-49) + story 11-2 (FR-50). Server Component. Placement is
  // dictated by the ux-preview SSOT (docs/ux-preview/src/App.tsx →
  // SettingsScreen): the « Vos données » Section sits after « Intelligence
  // artificielle », and holds exactly two rows — export first, delete second.
  // Both rows are now built; the section matches the preview.
  import { getTranslations } from "next-intl/server";
  import { Section } from "@pekulo/ui";
  import { View } from "@pekulo/ui/client";
  import { createClient } from "@/lib/supabase/server";
  import { ExportDataRow } from "./export-data-row";
  import { DeleteAccountRow } from "./delete-account-row";

  export async function DataSection() {
    const t = await getTranslations("settings");
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // No session → no account to delete. The route is behind the proxy's auth
    // gate, so this is defence in depth rather than a reachable branch; it also
    // keeps the component renderable in tests that mount it without a session.
    const email = user?.email ?? "";

    return (
      <Section ariaLabel={t("data.title")} title={t("data.title")}>
        <View flexDirection="column">
          <ExportDataRow
            label={t("data.exportLabel")}
            sub={t("data.exportSub")}
            action={t("data.exportAction")}
          />
          {email && (
            <DeleteAccountRow
              label={t("data.deleteLabel")}
              sub={t("data.deleteSub")}
              action={t("data.deleteAction")}
              email={email}
            />
          )}
        </View>
      </Section>
    );
  }
  ```

  Run: `cd apps/web && bunx tsc --noEmit`
  Expected: exit 0, no output.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx" && git commit -m "feat(#49): mount the deletion row in « Vos données » (AC-8)"`

- [x] **T25 — Behaviour test for the dialog** [AC: AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.test.tsx` with exactly this content:

  ```tsx
  import { describe, expect, it, vi, beforeEach } from "vitest";
  import userEvent from "@testing-library/user-event";
  import { DeleteAccountConfirm } from "./delete-account-confirm";
  import { renderWithTamagui } from "../../../../../../test/setup";
  import fr from "../../../../../../messages/fr.json";

  // Story 11-2, AC-8. The typed-email gate is the behaviour worth proving here:
  // without it the destructive button is one stray click away, and with it
  // wrong, the user can be refused by the server after believing they confirmed.
  const mutate = vi.fn();
  const push = vi.fn();
  const refresh = vi.fn();
  const purge = vi.fn(async () => undefined);

  vi.mock("../_hooks/use-delete-account", () => ({
    useDeleteAccount: () => ({ mutate, isPending: false, error: null, reset: vi.fn() }),
  }));
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
  vi.mock("@/lib/offline/cache-db", () => ({ purgeOfflineCache: purge }));

  const EMAIL = "alex@pekulo.local";

  beforeEach(() => {
    mutate.mockReset();
    push.mockReset();
    refresh.mockReset();
    purge.mockClear();
  });

  describe("DeleteAccountConfirm (story 11-2, AC-8)", () => {
    it("keeps the destructive button disabled until the email matches", async () => {
      const user = userEvent.setup();
      const { getByRole, getByLabelText } = renderWithTamagui(
        <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
      );
      const confirm = getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) });
      expect(confirm).toBeDisabled();

      await user.type(getByLabelText(fr.settings.data.deleteConfirmLabel), "wrong@example.test");
      expect(confirm).toBeDisabled();
      expect(mutate).not.toHaveBeenCalled();
    });

    it("enables on an exact match and sends the typed email", async () => {
      const user = userEvent.setup();
      const { getByRole, getByLabelText } = renderWithTamagui(
        <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
      );
      await user.type(getByLabelText(fr.settings.data.deleteConfirmLabel), EMAIL);
      const confirm = getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) });
      expect(confirm).toBeEnabled();

      await user.click(confirm);
      expect(mutate).toHaveBeenCalledTimes(1);
      expect(mutate.mock.calls[0]![0]).toEqual({ confirmationEmail: EMAIL });
    });

    it("accepts a case- and whitespace-different match, like the server does", async () => {
      // The client gate must not be STRICTER than the server rule, or a user
      // typing their own address with a capital letter is stuck on a disabled
      // button with no explanation.
      const user = userEvent.setup();
      const { getByRole, getByLabelText } = renderWithTamagui(
        <DeleteAccountConfirm email={EMAIL} open onOpenChange={() => {}} />,
      );
      await user.type(getByLabelText(fr.settings.data.deleteConfirmLabel), ` ${EMAIL.toUpperCase()} `);
      expect(getByRole("button", { name: new RegExp(fr.settings.data.deleteConfirm) })).toBeEnabled();
    });
  });
  ```

  Run: `cd apps/web && bunx vitest run "src/app/(cap)/dashboard/_data/_components/delete-account-confirm.test.tsx"`
  Expected: `3 passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.test.tsx" && git commit -m "test(#49): typed-email gate on the deletion dialog (AC-8)"`

- [x] **T26 — Accessibility coverage for the row and the two-row section** [AC: AC-8]

  Create `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.a11y.test.tsx` with exactly this content:

  ```tsx
  import { describe, expect, it, vi } from "vitest";
  import { axe } from "vitest-axe";
  import { Section } from "@pekulo/ui";
  import { DeleteAccountRow } from "./delete-account-row";
  import { ExportDataRow } from "./export-data-row";
  import { renderWithTamagui } from "../../../../../../test/setup";
  import fr from "../../../../../../messages/fr.json";
  import en from "../../../../../../messages/en.json";

  // Story 11-2, AC-8. Mirrors export-data-row.a11y.test.tsx, plus the check that
  // only exists once there are TWO rows: the export and delete controls must be
  // distinguishable by accessible name, because their visible verbs
  // (« Exporter » / « Supprimer ») are meaningless side by side in a rotor.
  vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
  vi.mock("@/lib/offline/cache-db", () => ({ purgeOfflineCache: vi.fn(async () => undefined) }));

  const EMAIL = "alex@pekulo.local";

  describe("DeleteAccountRow a11y (story 11-2)", () => {
    it("has no axe violations", async () => {
      const { container } = renderWithTamagui(
        <DeleteAccountRow
          label={fr.settings.data.deleteLabel}
          sub={fr.settings.data.deleteSub}
          action={fr.settings.data.deleteAction}
          email={EMAIL}
        />,
      );
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("has no axe violations in the two-row « Vos données » landmark", async () => {
      const { container } = renderWithTamagui(
        <Section ariaLabel={fr.settings.data.title} title={fr.settings.data.title}>
          <ExportDataRow
            label={fr.settings.data.exportLabel}
            sub={fr.settings.data.exportSub}
            action={fr.settings.data.exportAction}
          />
          <DeleteAccountRow
            label={fr.settings.data.deleteLabel}
            sub={fr.settings.data.deleteSub}
            action={fr.settings.data.deleteAction}
            email={EMAIL}
          />
        </Section>,
      );
      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("exposes the control under the full row label, not the bare verb", async () => {
      const { getByRole } = renderWithTamagui(
        <DeleteAccountRow
          label={fr.settings.data.deleteLabel}
          sub={fr.settings.data.deleteSub}
          action={fr.settings.data.deleteAction}
          email={EMAIL}
        />,
      );
      // Contains the visible text « Supprimer », so WCAG 2.5.3 holds.
      const control = getByRole("button", { name: fr.settings.data.deleteLabel });
      expect(control).toBeInTheDocument();
    });

    it("gives the export and delete controls distinct accessible names", async () => {
      const { getByRole } = renderWithTamagui(
        <Section ariaLabel={fr.settings.data.title} title={fr.settings.data.title}>
          <ExportDataRow
            label={fr.settings.data.exportLabel}
            sub={fr.settings.data.exportSub}
            action={fr.settings.data.exportAction}
          />
          <DeleteAccountRow
            label={fr.settings.data.deleteLabel}
            sub={fr.settings.data.deleteSub}
            action={fr.settings.data.deleteAction}
            email={EMAIL}
          />
        </Section>,
      );
      expect(getByRole("link", { name: fr.settings.data.exportLabel })).toBeInTheDocument();
      expect(getByRole("button", { name: fr.settings.data.deleteLabel })).toBeInTheDocument();
    });

    it("ships every settings.data key in both fr and en", () => {
      // The setup mock backs getTranslations with the FR catalogue only, so the
      // en rendering cannot be asserted directly. Key parity is the real guard:
      // a key present in one catalogue and missing from the other is a runtime
      // next-intl error for half the users.
      const frKeys = Object.keys(fr.settings.data).sort();
      const enKeys = Object.keys(en.settings.data).sort();
      expect(enKeys).toEqual(frKeys);
      for (const key of frKeys) {
        const value = (en.settings.data as Record<string, string>)[key];
        expect(value, `en.settings.data.${key} is empty`).toBeTruthy();
      }
    });
  });
  ```

  Run: `cd apps/web && bunx vitest run "src/app/(cap)/dashboard/_data/_components/delete-account-row.a11y.test.tsx"`
  Expected: `5 passed`, exit 0.
  Commit: `git add "apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.a11y.test.tsx" && git commit -m "test(#49): a11y coverage for the deletion row and the two-row section (AC-8)"`

- [x] **T27 — Update the documentation the change invalidates** [AC: AC-1, AC-5, AC-6]

  The 2026-05-31 lesson: doc debt created by a change lands in the same pass, not later.

  **`docs/security.md`** — add this section immediately after the `## Encryption at rest (NFR-14, DR-11)` section and before `## Encryption strategy — what we deliberately do NOT do`:

  ```markdown
  ## Account erasure (FR-50, story 11-2)

  - **Order is fail-closed and fixed:** Bridge first (revoke each item, then
    `DELETE /v3/aggregation/users/{uuid}`), then every user-scoped Postgres table
    in one transaction, then `auth.admin.deleteUser`. A Bridge failure aborts the
    whole deletion with nothing touched — the user retries with their session
    intact. Erasing locally first would destroy the `bridge_users` mapping any
    later provider-side erasure needs.
  - **There is no deferred-erasure queue.** A permanently unreachable Bridge
    blocks the deletion and must be completed by the controller by hand. The
    alternative — retaining an erased user's identifiers in a pending table —
    was rejected for V1 (a) at proches scale.
  - **`SUPABASE_SERVICE_ROLE_KEY`** is required by `apps/api` and lives in Dokploy
    env only. It is the Auth Admin API key, distinct from `SUPABASE_JWT_SECRET`
    (verification only) and from the Postgres connection in `DATABASE_URL`. It is
    never read on the web side.
  - **Raw SQL exception.** `purgeVaultSecrets` in
    `apps/api/src/modules/settings/settings.deletion.ts` is the ONE `$executeRaw`
    against user data in the codebase — `vault.secrets` lives outside Prisma's
    schema so there is no delegate. The query is parameterised, never
    interpolated. The FK from `bank_connections` is `ON DELETE SET NULL`, so
    without this purge a written vault secret would outlive the account that owned
    it. The columns are vestigial NULL today (ADR-0015).
  - **Cascade reachability is gated.** `db:rls-migration-audit` fails the build if
    any user-data table cannot reach `auth.users` through an `ON DELETE CASCADE`
    path, directly or through a cascading parent. Migration
    `20260915120000_add_missing_auth_users_fk` closed the four tables that had no
    path at all (`compass_history`, `milestones`, `user_pref`,
    `dashboard_layout`) — three of which carried a migration comment claiming
    otherwise.
  - Verification: add a `CREATE TABLE "tmp_y" ("user_id" UUID NOT NULL)` with RLS
    DDL but no FK to a scratch migration → the gate must exit 1 naming `tmp_y`.
  ```

  **`docs/rgpd-readiness.md`** — replace this existing line:

  ```markdown
  - [ ] **Erasure** → delete account, cascade across **every** user-scoped table + erase the Supabase Auth user — **#49 / story 11-2** (`pending`). Cascade must cover: accounts, holdings, holding_lots, transactions, kpis, monthly_tracking, monthly_records, hypotheses, milestones, real_estate(+mortgage/rental/valuations), compass_history, account_balance_log, **bank_connections, bridge_users**. ⚠️ Erasure must also **revoke the Bridge connection** (the proche's bank link) — not just drop local rows.
  ```

  with:

  ```markdown
  - [x] **Erasure** → delete account, cascade across **every** user-scoped table + erase the Supabase Auth user — **#49 / story 11-2**. Covers all **21** user-scoped tables via an explicit `DELETION_NODES` fan-out in one transaction (not the FK cascade alone: `compass_history`, `milestones`, `user_pref` and `dashboard_layout` had no FK to `auth.users` at all until migration `20260915120000`). Bridge erasure runs FIRST and is fail-closed: every item is revoked and the Bridge user is deleted (`DELETE /v3/aggregation/users/{uuid}`) before a single local row is touched; if Bridge is unreachable, nothing is deleted and the user retries. Vault secret references are purged before `bank_connections` goes. `EXPORT_NODES` and `DELETION_NODES` are asserted equal by a build-failing test, so a future table cannot enter one without the other.
  ```

  **`docs/architecture.md`** — find the bullet that begins `- **RLS coverage automation: build-failing CI check**` (around line 145) and append this paragraph directly beneath it, as a new paragraph at the same indent level:

  ```markdown
  Story 11-2 added a second pass to the same script: **cascade reachability**. RLS
  proves who may read a row; it says nothing about whether the row dies when the
  account does. `auditCascadeReachability` walks the FK graph in the committed
  migration SQL and fails the build if any user-data table cannot reach
  `auth.users` through `ON DELETE CASCADE` — directly, or through a parent that
  can (the `account_balance_log → accounts` shape). This closes the gap that let
  four tables ship with no path to `auth.users` while three of their migrations
  carried a comment asserting the opposite.
  ```

  **`docs/epics.md`** — replace this existing line under `#### Story 11-2-account-deletion`:

  ```markdown
  **Summary:** Implement `settings.service.deleteAccount` (Prisma cascade via FK + Supabase Auth user erase) + `delete-account-confirm.tsx` (destructive variant). Honour the 60 s budget (NFR-7).
  ```

  with:

  ```markdown
  **Summary:** Implement `settings.service.deleteAccount` — Bridge erasure first (fail-closed), then an explicit `DELETION_NODES` fan-out over all 21 user-scoped tables in one transaction, then `auth.admin.deleteUser` — plus `delete-account-row.tsx` + `delete-account-confirm.tsx` (destructive variant, typed-email confirmation). Adds the four missing `auth.users` FK cascades and a static gate that keeps them. Honour the 60 s budget (NFR-7).
  ```

  Run: `bash .aped/scripts/validate-epics.sh docs/epics.md`
  Expected: exits 0.
  Commit: `git add docs/security.md docs/rgpd-readiness.md docs/architecture.md docs/epics.md docs/epics-context/epic-11-context.md && git commit -m "docs(#49): erasure posture, cascade gate, RGPD readiness, epic summary"`

- [x] **T28 — Full gate sweep and live visual verification** [AC: AC-1, AC-5, AC-8]

  Run every gate the PR will run:

  Run: `cd /Users/fredyaba/Documents/Saas-projects/pekulo && bun run lint && bun run typecheck && bun --filter=@pekulo/api test && bun --filter=@pekulo/api run db:rls-migration-audit && bun --filter=@pekulo/web test && bun --filter=@pekulo/ui test`
  Expected: every command exits 0. `db:rls-migration-audit` prints `all RLS-guarded and all reachable by the auth.users cascade`.

  Then the live visual pass. **This is not optional and it is not covered by the tests above.** Story 11-1 shipped « Vos données » without one (react-grab-mcp timed out in both sessions), so the section this story extends has *never been seen rendered*. Verify **both** rows, not only the new one.

  Start the stack from the repo root and browse the tunnel, never localhost:

  ```bash
  cd /Users/fredyaba/Documents/Saas-projects/pekulo && bun run dev
  ```

  Open `https://pekulo-dev.trafijs.com/dashboard/parametres` and use `mcp__react-grab-mcp__get_element_context` on the « Vos données » section. Confirm, in both `fr` and `en`:

  1. The section sits **after** « Intelligence artificielle » and **before** the compass settings, matching the ux-preview SSOT.
  2. Row 1 « Exporter mes données » renders in the DS font (not serif) with a visible `Download` glyph — this is the 11-1 row nobody has ever looked at.
  3. Row 2 « Supprimer mon compte » renders its label in `$danger`, with a `Trash2` glyph that is the **same colour as its label** (the 11-1 review found an uncoloured icon at ~1.03:1 on this exact card).
  4. Activating row 2 opens the dialog; the confirm button is visibly disabled until the account email is typed.
  5. Sub-labels read « JSON complet · conforme RGPD » and « Cascade sur toutes les tables · irréversible ».

  Record what you saw in the Dev Agent Record, including the measured contrast of the `Trash2` glyph against the card. If react-grab-mcp fails to connect, say so explicitly and take a screenshot instead — do **not** mark this task done on a deferred visual pass.

  Finally, exercise the real deletion end to end against the dev database with a throwaway account (sign up, create one account and one transaction, then delete), and confirm: the row counts come back non-zero, signing in again is rejected, and `SELECT count(*) FROM compass_history WHERE user_id = '<id>'` returns 0 for each of the four tables T1 fixed.

  Expected: every gate green, the five visual points confirmed, the end-to-end deletion verified.
  Commit: `git add docs/stories/11-2-account-deletion.md && git commit -m "docs(#49): record the visual + end-to-end verification in the Dev Agent Record"`

## Dev Notes

### Existing code at write time

**`apps/api/src/modules/settings/settings.service.ts`** (current, complete — T15 replaces it):

```ts
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
```

The `createSettingsService` signature gains three ports. Every existing caller breaks until T17 updates the module — that is expected and is why T16/T17 commit together.

**`apps/api/src/modules/settings/settings.routes.ts`** (current handler block — T16 appends to it):

```ts
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

The oRPC context is already typed `{ userId: string; email: string | null }` at the top of that file, so `context.email` needs no change to reach the handler.

**`apps/api/src/platform/security/require-user-context.ts`** (current return, unchanged by this story):

```ts
export interface UserContext {
  userId: string;
  email: string | null;
}
```

`email` is nullable. That is why the service refuses rather than assumes when the claim is absent (T15, `assertConfirmation`).

**`apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`** (current `revokeConnection`, unchanged — T11 adds a sibling next to it):

```ts
    async revokeConnection(userId, connectionId) {
      const found = await deps.repository.findByIdForUser(userId, connectionId);
      if (!found) throw bankConnectionNotFound(connectionId);
      // Idempotent: a connection that is already 'revoked' needs no Bridge
      // call and no re-write — return ok so a double-confirm is harmless.
      if (found.connection.status !== "revoked") {
        const userUuid = await deps.repository.findProviderUserUuid(userId, "bridge");
        if (userUuid) {
          try {
            await deps.provider.revokeItem({
              userUuid,
              providerItemId: found.connection.providerItemId,
            });
          } catch (err) {
            throw bankProviderUnavailable(err instanceof Error ? err.message : "revoke failed");
          }
        }
        await deps.repository.setStatus(userId, connectionId, "revoked");
      }
      return { ok: true as const };
    },
```

`eraseUserAtProvider` deliberately does **not** call `setStatus`: the rows are about to be deleted, and writing a status on a row we are erasing is work that cannot matter.

**`apps/api/src/modules/bank-aggregator/services/bridge-client.ts`** (current `revokeItem` — T10 adds `deleteUser` after it):

```ts
    async revokeItem({ userUuid, providerItemId }) {
      const bearer = await mintUserAccessToken(userUuid);
      await reqJson<{ ok: true }>(`/v3/aggregation/items/${providerItemId}`, {
        method: "DELETE",
        bearer,
      });
    },
```

The `req` helper already supports `allowStatuses` and returns `{ data, status }`; `reqJson` is the thin wrapper that drops the status. `deleteUser` uses `req` because it needs `allowStatuses: [404]`.

**`apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx`** (current, complete — T24 replaces it):

```tsx
import { getTranslations } from "next-intl/server";
import { Section } from "@pekulo/ui";
import { View } from "@pekulo/ui/client";
import { ExportDataRow } from "./export-data-row";

export async function DataSection() {
  const t = await getTranslations("settings");
  return (
    <Section ariaLabel={t("data.title")} title={t("data.title")}>
      <View flexDirection="column">
        <ExportDataRow
          label={t("data.exportLabel")}
          sub={t("data.exportSub")}
          action={t("data.exportAction")}
        />
      </View>
    </Section>
  );
}
```

Its header comment already says the second row "belongs to story 11-2 and is deliberately absent here" — T24 makes that comment obsolete and rewrites it.

**`packages/ui` `PekuloSettingRow` props** (unchanged — consumed as-is):

```ts
export interface PekuloSettingRowProps {
  label: string;
  value?: string;
  sub?: string;
  action?: ReactNode;
  destructive?: boolean;
}
```

`destructive` already exists and colours the label `$danger`. Nothing in `@pekulo/ui` needs to change for this story.

**`apps/api/src/config/env.ts`** (current Supabase block — T6 appends to it):

```ts
  SUPABASE_JWT_SECRET: z
    .string()
    .min(32, "SUPABASE_JWT_SECRET must be ≥ 32 chars (read it from `bunx supabase status`)"),
  SUPABASE_URL: z.string().url(),
```

There is no service-role key anywhere in the repo today — not in `env.ts`, not in `.env.example`, not on the web side. T6 introduces the first one.

**`apps/api/scripts/rls-audit.ts` `EXPECTED_POLICY_COUNTS`** — 20 entries for 21 user-scoped tables; `dashboard_layout` is absent. T3 restores it. `EXPORT_NODES` and `DELETION_NODES` still derive from the Prisma DMMF, never from this map.

**The four tables with no `auth.users` FK** — verified on 2026-09-15 by `grep -rn 'REFERENCES auth\.users\|REFERENCES "auth"\.' apps/api/prisma/migrations/`:

| Table | FK to `auth.users` | Notes |
|---|---|---|
| `compass_history` | **none** | migration comment claims a cascade that does not exist |
| `milestones` | **none** | no comment, no constraint |
| `user_pref` | **none** | migration comment claims a cascade that does not exist |
| `dashboard_layout` | **none** | migration comment claims a cascade that does not exist |
| `account_balance_log` | none directly | cascades via `accounts(id) ON DELETE CASCADE` — correct as-is |
| the other 16 | present | direct `ON DELETE CASCADE` |

### File decisions

| File | Single responsibility | Inputs / outputs |
|---|---|---|
| `apps/api/prisma/migrations/20260915120000_add_missing_auth_users_fk/migration.sql` | Add the four `auth.users` FK cascades that were never written. | In: nothing. Out: four constraints. |
| `apps/api/scripts/rls-migration-audit.ts` | Static gate over committed migration SQL: RLS presence **and** cascade reachability. | In: migration SQL text. Out: `RlsDrift[]`; exit 1 on drift. |
| `apps/api/src/modules/settings/settings.deletion.ts` | The ordered answer to "which of my rows go, and in what order". | In: `ExtendedPrismaClient`, `userId`. Out: `DELETION_NODES`, `purgeVaultSecrets`, `deleteUserData` → per-table counts. |
| `apps/api/src/modules/settings/settings.deletion-map.guard.test.ts` | Fail the build when the deletion map drifts from the DMMF or from the export map. | In: Prisma DMMF, `EXPORT_NODES`, `DELETION_NODES`. Out: pass/fail. |
| `apps/api/src/platform/auth/supabase-admin.ts` | The only place apps/api touches the Supabase Auth Admin API. | In: url + service-role key (or a delete callable). Out: `AuthAdminPort`. |
| `apps/api/src/modules/settings/settings.service.ts` | Settings domain rules, including the deletion order and the confirmation check. | In: repository + three erasure ports. Out: `SettingsService`. |
| `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` | Bank-aggregator domain, now including provider-side erasure. | In: repository + provider. Out: `eraseUserAtProvider` → `{ itemsRevoked, providerUserDeleted }`. |
| `packages/validators/src/settings/deletion.schemas.ts` | Shared shape of the deletion request and result. | In: nothing. Out: two Zod schemas + two types. |
| `apps/web/.../_data/_actions/delete-account-action.ts` | Call the procedure, then tear down the session. | In: `DeleteAccountInput`. Out: `DeleteAccountResult`. |
| `apps/web/.../_data/_hooks/use-delete-account.ts` | The ADR-0010 orchestration boundary. | In: nothing. Out: mutation handle. |
| `apps/web/.../_data/_components/delete-account-confirm.tsx` | Collect and gate the confirmation, then leave the app. | In: `email`, `open`, `onOpenChange`. Out: rendered dialog. |
| `apps/web/.../_data/_components/delete-account-row.tsx` | The destructive row and the dialog it owns. | In: `label`, `sub`, `action`, `email`. Out: rendered row. |
| `apps/web/.../_data/_components/data-section.tsx` | The « Vos données » section: export row + delete row. | In: locale + session. Out: rendered `Section`. |

### Architecture

- **oRPC, not Elysia-native** (ADR-0009). Story 11-1's `GET /v1/export` is Elysia-native only because a stream cannot travel through the RPC envelope. A deletion returns one small object, so it stays contract-first and the web tier reaches it through ADR-0010's component → hook → server action triad. `_appearance/` is the reference implementation of that triad on this page.
- **Tenant isolation is single-layer on the apps/api path** (ADR-0013, `docs/security.md`): the service role bypasses RLS, so `where: { userId }` plus the `pekulo/no-prisma-query-without-user-id` lint rule is the boundary. Every `DELETION_NODES` entry carries it. `.oxlintrc.json` sets `prismaIdentifier: ["prisma", "tx", "client"]`, which is why the transaction client must be named `tx` and the node parameter `client` — rename either and the rule silently stops inspecting those calls.
- **Module shape** (`architecture.md` § Structure Mapping): `settings` already is `<mod>.{module,routes,service,repository}.ts`. This story extends it and adds `settings.deletion.ts` as a sibling of `settings.export.ts` — the same "not owned by the service" pattern.
- **New route?** None. No new page, so the 2026-05-27 `(cap)/dashboard/*` rule does not apply.
- **Prisma model?** None added, so `id-prefixes.config.ts` needs no entry (2026-06-05 lesson does not bite here).

### Testing

- `apps/api`: `bun test` (bun's own runner). Integration suites boot a real Elysia app with a real jose verifier against a stubbed data layer and pick a distinct `PORT_BASE` per suite — the settings suite uses 15100 and the export suite 15300, so reuse 15100 rather than opening a third listener.
- `apps/web`: `bunx vitest run`. Components using Tamagui primitives must mount through `renderWithTamagui` from `apps/web/test/setup.tsx`; a bare `@testing-library/react` render throws on the missing Tamagui context. `getTranslations` is mocked there against the FR catalogue, which is why en coverage is asserted as key parity rather than by rendering.
- **Two tenants, always** (2026-05-27 lesson). Both the unit fan-out test and the HTTP boundary test seed A and B and assert on both. A single-tenant fixture cannot distinguish "filtered correctly" from "deleted everything".
- **Whole-package runs use the workspace name** (2026-05-19 lesson): `bun --filter=@pekulo/api`, never `--filter=api`. Targeted runs use `cd apps/api && bun test <path>`, which is what the sibling story 11-1 established.

### Dependencies

- `@supabase/supabase-js@^2.104.1` → added to `apps/api` in T7 (already an `apps/web` dependency at the same range).
- `SUPABASE_SERVICE_ROLE_KEY` → new required env var. **Provision it in Dokploy before deploying**, or apps/api will not boot. Locally, `bunx supabase status` prints it as `service_role key`; put it in the root `.env.local`.
- No new dependency on the web side.

### Commit prefix

`feat(#49): …` / `test(#49): …` / `docs(#49): …` / `chore(#49): …`. Final PR body carries `Closes #49`.

### Out of scope — do not build

- **A deferred-erasure queue.** No `pending_provider_erasure` table, no retry job. Decided at the step-04 gate: fail-closed instead. A permanently unreachable Bridge blocks the deletion and is completed by the controller by hand. Revisit if V1 (b) opens.
- **A soft-delete grace period.** `prd.md:201` lists it as optional; deletion is immediate and irreversible.
- **Field-level IBAN encryption.** `docs/security.md` records it as a follow-up story; this one only purges vault references that already exist.
- **Reworking `revokeConnection`.** The settings-page per-connection revoke flow is untouched.
- **`11-4` axe CI gates.** This story writes axe tests for its own components; wiring axe into `pr.yml` is story 11-4.
- **Backfilling the `tier/backlog` label on #49.** The label is stale for 11-1/11-2/11-4 per `docs/rgpd-readiness.md`; correcting the labels is a ticket-hygiene pass, not this story.

## File List

**Created**

- `apps/api/prisma/migrations/20260915120000_add_missing_auth_users_fk/migration.sql`
- `apps/api/src/platform/auth/supabase-admin.ts`
- `apps/api/src/platform/auth/supabase-admin.test.ts`
- `apps/api/src/platform/auth/index.ts`
- `apps/api/src/modules/settings/settings.deletion.ts`
- `apps/api/src/modules/settings/settings.deletion.test.ts`
- `apps/api/src/modules/settings/settings.deletion-map.guard.test.ts`
- `packages/validators/src/settings/deletion.schemas.ts`
- `apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts`
- `apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts`
- `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.tsx`
- `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-confirm.test.tsx`
- `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.tsx`
- `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-row.a11y.test.tsx`

**Modified**

- `apps/api/scripts/rls-migration-audit.ts`
- `apps/api/scripts/rls-migration-audit.test.ts`
- `apps/api/scripts/rls-audit.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/config/env.test.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/src/modules/settings/settings.service.ts`
- `apps/api/src/modules/settings/settings.service.test.ts`
- `apps/api/src/modules/settings/settings.routes.ts`
- `apps/api/src/modules/settings/settings.module.ts`
- `apps/api/src/modules/settings/settings.integration.test.ts`
- `apps/api/src/modules/bank-aggregator/bank-provider.ts`
- `apps/api/src/modules/bank-aggregator/services/bridge-client.ts`
- `apps/api/src/modules/bank-aggregator/services/bridge-client.test.ts`
- `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts`
- `apps/api/src/modules/bank-aggregator/bank-aggregator.service.test.ts`
- `apps/api/package.json`
- `bun.lock`
- `packages/validators/src/settings/index.ts`
- `packages/contracts/src/settings/settings.contract.ts`
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx`
- `apps/web/messages/fr.json`
- `apps/web/messages/en.json`
- `.env.example`
- `docs/security.md`
- `docs/rgpd-readiness.md`
- `docs/architecture.md`
- `docs/epics.md`
- `docs/epics-context/epic-11-context.md`
- `docs/state.yaml`

## Dev Agent Record

- **Model:** claude-fable-5-1
- **Started:** 2026-09-15T14:01:38Z
- **Completed:** 2026-09-15T15:40:00Z

### Summary

GDPR account deletion shipped end to end: the four missing `auth.users`
cascades plus a static gate that keeps every user table reachable, a typed
`settings.deleteAccount` procedure that erases at Bridge first (fail-closed),
then all 21 tables in one transaction, then the Supabase Auth user, and the
« Supprimer mon compte » row + typed-email dialog on Paramètres. Exercised
three times against the dev database and twice through the real UI: every
row gone, sign-in rejected, 0.7–1.5 s per deletion (NFR-7 budget is 60 s).

Two things the story did not foresee dominated the session. The story's
verbatim identifiers collided with the accounts domain (`deleteAccountInputSchema`
already means "delete a BANK account"), settled with the user as
`deleteUserAccount*`. And the web flow as written left the browser on a blank
page after a successful deletion — found only by the live pass, fixed with a
server-side `redirect()` in the action (see Deviations).

### Files changed

- `apps/api/prisma/migrations/20260915120000_add_missing_auth_users_fk/migration.sql` (NEW)
- `apps/api/scripts/rls-migration-audit.ts` + `.test.ts`
- `apps/api/scripts/rls-audit.ts`
- `apps/api/src/config/env.ts` + `env.test.ts`
- `apps/api/src/platform/observability/otel-sdk.test.ts` (fixture gained the new key)
- `apps/api/src/platform/auth/{index,supabase-admin,supabase-admin.test}.ts` (NEW)
- `apps/api/src/modules/bank-aggregator/bank-provider.ts`
- `apps/api/src/modules/bank-aggregator/services/bridge-client.ts` + `.test.ts`
- `apps/api/src/modules/bank-aggregator/bank-aggregator.service.ts` + `.test.ts`
- `apps/api/src/modules/bank-aggregator/bank-aggregator.{integration,security}.test.ts`, `services/bridge-webhook-router.test.ts` (stubs gained the new port methods)
- `apps/api/src/modules/settings/settings.deletion.ts` (NEW) + `settings.deletion.test.ts` (NEW) + `settings.deletion-map.guard.test.ts` (NEW)
- `apps/api/src/modules/settings/settings.{service,routes,module}.ts` + `settings.service.test.ts` + `settings.integration.test.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `apps/api/package.json`, `bun.lock` (`@supabase/supabase-js@^2.104.1`)
- `packages/validators/src/settings/deletion.schemas.ts` (NEW) + `index.ts`
- `packages/contracts/src/settings/settings.contract.ts`
- `apps/web/messages/{fr,en}.json`
- `apps/web/src/app/(cap)/dashboard/_data/_actions/delete-account-action.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/_data/_hooks/use-delete-account.ts` (NEW)
- `apps/web/src/app/(cap)/dashboard/_data/_components/delete-account-{row,confirm}.tsx` (NEW) + `delete-account-confirm.test.tsx` (NEW) + `delete-account-row.a11y.test.tsx` (NEW)
- `apps/web/src/app/(cap)/dashboard/_data/_components/data-section.tsx` + `export-data-row.a11y.test.tsx` (11-1 test mocks the SSR client the section now reads)
- `.env.example`
- `docs/security.md`, `docs/rgpd-readiness.md`, `docs/architecture.md`, `docs/epics.md`
- `docs/state.yaml`, `docs/epics-context/epic-11-context.md`, `docs/stories/11-2-account-deletion.md`

### Deviations

**Identifier collision (user decision).** `deleteAccountInputSchema` /
`DeleteAccountInput` already exist in the `accounts` validators domain
(removing a bank account, FR-10) and both ship through the same barrel — the
story's T4 names could not compile. Renamed to `deleteUserAccountInputSchema`,
`DeleteUserAccountInput`, `deleteUserAccountResultSchema`,
`DeleteUserAccountResult`; the web action and hook follow
(`deleteUserAccount`, `useDeleteUserAccount`) because `_accounts/` owns
`deleteAccount` / `useDeleteAccount` for the bank-account case. The oRPC
procedure stays `settings.deleteAccount`. File names are as the story wrote them.

**Blank page after deletion (found live, twice).** The story's
`router.push("/") + router.refresh()` left the browser on an empty
`/dashboard/parametres`: clearing the auth cookies in the action makes Next
re-render the current route inside the action response, that route cannot
render without a session (its sections call apps/api → `UNAUTHORIZED` in the
server log), and the action promise never settled on the client. A first fix
(hard `window.location.assign`) never ran for the same reason. The action now
ends with `redirect("/")`, which short-circuits the re-render (`POST … 303` →
`GET /` → `GET /login`), and the offline-cache purge moved BEFORE the call
since the action no longer returns. Verified with a third throwaway account:
lands on the login page, 0 rows left, no server error. The row counts are still
logged by apps/api; they no longer travel to the browser.

**Typed errors were missing from the contract.** oRPC collapses any
handler-thrown error that the contract does not declare to 500 before the
mount's error mapper runs, so the service's `FORBIDDEN` reached the wire as an
internal error and a Bridge outage was indistinguishable from a crash. Added
`FORBIDDEN` (403) and `BANK_PROVIDER_UNAVAILABLE` (503) to `deleteAccount` in
the contract and re-thrown them in the handler, plus a boundary test for the
503 path (AC-6). Without this, AC-6's "the caller receives a
`BANK_PROVIDER_UNAVAILABLE` error" and AC-7's 403 were both false in production.

**Verbatim test code that did not run as written.** (a) T2's tests used `it`
in a file that only imports `test` — import added. (b) T14's fake client
handed the bare `root` to the `$transaction` callback, so every delegate was
`undefined` inside the transaction — the callback now receives the proxy.
(c) T25's `vi.mock` factories closed over top-level `vi.fn()`s — hoisting
`ReferenceError`, lesson 2026-05-20, fixed with `vi.hoisted`. (d) T26 mounted
the row's dialog, which reaches the real mutation hook and asks for a
`QueryClient` — the hook is now mocked there too. (e) `createSettingsService`
gained three required ports, so the five pre-existing pref tests needed no-op
ports. (f) T9's new `BankProvider.deleteUser` and T11's `eraseUserAtProvider`
broke four more test stubs than the story listed
(`bank-aggregator.{integration,security}.test.ts`,
`bridge-webhook-router.test.ts`, `otel-sdk.test.ts` for the env key).

**Story 11-1's section test.** `DataSection` now reads the signed-in email
through the Supabase SSR client (`cookies()` throws outside a request), so
`export-data-row.a11y.test.tsx` mocks that client and asserts both rows render.

**Smaller corrections.** T2's expected output said 23 user-data tables; the
corpus has 21 (the count the epic cache also states). T3 needed no test of its
own (an inventory entry; verified by count + tsc). The env key was already
present in the root `.env` — the story pointed at `.env.local`, which does not
exist here; the repo convention is `.env`. `docs/architecture.md`'s FR-50 row
and the `settings-actions.ts` tree line still described the pre-story design
(FK cascade only, a global action) and were corrected in T27's commit.
`docs/epics-context/epic-11-context.md` was not hand-edited (its header
forbids it) — `aped-story` regenerates it.

**Tooling.** `bun --filter=@pekulo/ui test` runs Bun's own `bun test` across the
repo rather than the package's vitest script; the ui gate was run as
`cd packages/ui && bunx vitest run`. The root `bun run typecheck` fails with
exit 127 on `@pekulo/zod` and `@pekulo/oxlint-config` (no `typescript`
devDependency, pre-existing on `main`, lesson 2026-05-05 class); `bunx tsc
--noEmit` passes in both, and in api / web / contracts / validators. The
`react-grab-mcp` tool only returns an element the user selected in the browser,
so the visual pass was run with Chrome DevTools MCP against the tunnel instead
(see below). One a11y note left for review: the dialog's cancel control exposes
the accessible name "Dialog Close" (from `PekuloDialog.Close`) while its visible
text is « Annuler » — same as the immobilier dialog it mirrors; a `@pekulo/ui`
change, out of scope here.

**Not done from the story text.** T28's throwaway transaction: the
`transactions/create` procedure name differs (404); the fan-out was proven on
`accounts`, `hypotheses`, `compass_history`, `milestones`, `user_pref` and
`dashboard_layout` rows instead. `bun run typecheck` at the root (see Tooling).

### Test output

```
apps/api      bun test                    → 974 pass, 0 fail, 2712 expect() · 111 files · exit 0
apps/web      bunx vitest run             → 114 files passed, 385 tests passed · exit 0
packages/ui   bunx vitest run             → 158 files passed, 294 passed | 1 skipped · exit 0
apps/api      bun run db:rls-migration-audit → OK — 21 user-data tables, all RLS-guarded and all
                                             reachable by the auth.users cascade · exit 0
tsc --noEmit  apps/api, apps/web, packages/contracts, packages/validators, packages/zod,
              packages/oxlint-config     → exit 0, no output
bun run lint  (oxlint, 1007 files)       → 0 errors, 4 warnings (all pre-existing on main)
prisma migrate deploy                    → 20260915120000_add_missing_auth_users_fk applied
```

Story-owned suites: `rls-migration-audit.test.ts` +6 · `env.test.ts` +1 ·
`supabase-admin.test.ts` 3 · `bridge-client.test.ts` +3 ·
`bank-aggregator.service.test.ts` +4 · `settings.deletion-map.guard.test.ts` 6 ·
`settings.deletion.test.ts` 7 · `settings.service.test.ts` +7 ·
`settings.integration.test.ts` +5 · `delete-account-confirm.test.tsx` 3 ·
`delete-account-row.a11y.test.tsx` 5 = **50 tests**.

RED witnessed before each implementation (missing module / export, "is not a
function", tsc `Property 'deleteUser' is missing`, 500-instead-of-403 at the
boundary). Mutation checks: the cascade gate names `tmp_y` for a table with no
FK and names exactly the four T1 tables when the T1 migration is removed from the
corpus; dropping `where: { userId }` on one node fails AC-3; swapping
`holdings` before `holding_lots` fails the order guard.

End-to-end against the dev database (script, throwaway user):
`settings.deleteAccount` 200 in **1 492 ms**, `rowsDeleted` non-zero on
`accounts`, `hypotheses`, `compass_history`, `milestones`, `user_pref`,
`dashboard_layout`; sign-in afterwards `REJECTED (Invalid login credentials)`;
all 21 tables and `auth.users` at 0, the four T1 tables included.

Live visual pass (Chrome DevTools MCP over `https://pekulo-dev.trafijs.com`,
signed in as a throwaway user, fr then en): « Vos données » sits after the AI
sections and before the compass form; row 1 renders in Geist with the
`Download` glyph at the label's colour (rgb 161,161,161 on rgb 10,10,10 =
**7.66:1**); row 2 label and `Trash2` glyph both rgb(255,92,92) = **6.54:1**;
sub-labels « JSON complet · conforme RGPD » / « Cascade sur toutes les tables ·
irréversible »; the dialog opens with the confirm button disabled (opacity 0.5,
6.94:1 enabled colours), stays disabled on `wrong@example.test`, enables on the
exact address and on the upper-cased address; two real deletions through the UI
(api 833 ms and 725 ms) ended on the login page with 0 rows left.
