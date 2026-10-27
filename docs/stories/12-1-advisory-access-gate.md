# Story: 12-1-advisory-access-gate — Allowlist + ban access gate for the private advisory surface

**Epic:** Epic 12 — Private internal AI advisory tool (internal / non-product)
**Status:** ready-for-dev
**Source:** ticket
**Ticket:** #114
**Ticket URL:** https://github.com/yabafre/pekulo/issues/114
**Origin:** aped-from-ticket
**Branch:** feature/114-12-1-advisory-access-gate

## User Story

**As the** advisory-surface owner, **I want** to authorize specific Pekulo users and ban them, **so that** the tool stays a closed private circle and the regulatory boundary of ADR-0016 is enforced in code, not by policy.

## Acceptance Criteria

- **AC-1 (deny before compute)** — **Given** a signed-in user who is neither an owner nor the holder of an `active` advisory_access row, **When** they call any `/rpc/v1/advisory/*` procedure, **Then** the API answers **403 `FORBIDDEN`** within the 100 ms gate budget, the procedure handler never runs, and no advisory data is read or computed.
- **AC-2 (active allowlisted caller proceeds)** — **Given** a signed-in user whose advisory_access row is `active`, **When** they call a gated advisory procedure, **Then** the gate resolves and the handler runs with the `userId` taken from the verified JWT.
- **AC-3 (ban is effective on the next request)** — **Given** an allowlisted `active` user, **When** the owner bans them, **Then** that user's **next** request — same token, no re-login — is rejected with 403, because the gate re-reads the row on every request and nothing caches the decision.
- **AC-4 (re-grant restores access)** — **Given** a user whose row is `banned`, **When** the owner calls `grant` for that user, **Then** the row becomes `active`, `banned_at` is cleared, and the user's next request succeeds.
- **AC-5 (schema + RLS)** — **Given** the migration is applied, **When** the schema is inspected, **Then** `advisory_access` exists with PK `user_id`, enum `advisory_access_status (active, banned)`, nullable `granted_by`, `granted_at`, `banned_at`, `updated_at`, `created_at`, an `ON DELETE CASCADE` FK to `auth.users(id)`, and the full RLS quartet (`auth.uid() = user_id` on SELECT/INSERT/UPDATE/DELETE).
- **AC-6 (registration gates)** — **Given** the new advisory access record type, **When** the repository's registration gates run, **Then** the model opts out of synthetic-ID injection, the record appears in both the user-data export and account-deletion inventories, the RLS inventory counts four policies for it, and the ID-prefix, export-map, deletion-map, RLS static and cascade-reachability gates all pass.
- **AC-7 (platform guard)** — **Given** the access-decision guard, **When** its injected reader returns `active`, `banned` or no record, **Then** it resolves only for `active` and otherwise raises the platform's 403 forbidden error; it depends on the injected reader and the platform layer does not import feature modules.
- **AC-8 (owner operations)** — **Given** an owner configured in the environment, **When** they call `status`, `list`, `grant` or `ban`, **Then** the calls succeed; an active non-owner calling `list`, `grant` or `ban` gets 403; granting or banning an owner returns 400 `BAD_REQUEST`; the owner is implicitly allowed without a record; and `granted_by` is the owner from the JWT, never a client-supplied value.
- **AC-9 (verification)** — **Given** the story is complete, **When** the API's full test, typecheck, lint, static RLS audit and live RLS audit commands are run, **Then** each exits 0 and the HTTP boundary suite covers AC-1 through AC-4.

## Tasks

- [x] **T1 — Register the table everywhere the repository's gates demand** [AC: AC-5, AC-6]
  This is one commit on purpose (lesson 2026-06-05): the Prisma model, its migration, the prefix opt-out, the export/deletion nodes and the RLS count map must land together, or the guard suites go red between commits.

  **Path:** `apps/api/prisma/schema/advisory.prisma` (create)

  ```prisma
  // apps/api/prisma/schema/advisory.prisma
  // Private internal advisory surface — access allowlist (story 12-1 / ADR-0016 §4).
  //
  // One row per user who has ever been granted access. `status` is the single
  // source of truth the request-time gate reads; a ban is effective on the
  // next request because nothing caches the decision (AC-3).
  //
  // PK is `user_id` (one row/user, no synthetic id), so the prefixed-ids
  // extension opts out via AdvisoryAccess:null in id-prefixes.config.ts.
  // RLS quartet (SELECT/INSERT/UPDATE/DELETE where user_id = auth.uid()) is
  // appended to the migration SQL by hand — Prisma does not introspect
  // policies (ADR-0013). The auth.users FK with ON DELETE CASCADE makes the
  // row die with the account (GDPR erasure, story 11-2).
  //
  // granted_by / granted_at are nullable because an owner may ban a user who
  // was never granted a row: that insert records the ban, not a grant.

  enum AdvisoryAccessStatus {
    active
    banned

    @@map("advisory_access_status")
  }

  model AdvisoryAccess {
    userId    String               @id @map("user_id") @db.Uuid
    status    AdvisoryAccessStatus @default(active)
    grantedBy String?              @map("granted_by") @db.Uuid
    grantedAt DateTime?            @map("granted_at") @db.Timestamptz
    bannedAt  DateTime?            @map("banned_at") @db.Timestamptz
    updatedAt DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz
    createdAt DateTime             @default(now()) @map("created_at") @db.Timestamptz

    @@map("advisory_access")
  }
  ```

  **Path:** `apps/api/prisma/migrations/20261027130000_create_advisory_access/migration.sql` (create)

  ```sql
  -- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
  -- dev` against the Supabase pooler). Apply via
  -- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
  -- Story 12-1 (ADR-0016 §2/§4): allowlist + ban gate for the private advisory
  -- surface. One row per user; the request-time gate reads `status` on every
  -- call (no cache, AC-3).

  -- CreateEnum
  DO $$ BEGIN
    CREATE TYPE "advisory_access_status" AS ENUM ('active', 'banned');
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  -- CreateTable: advisory_access (one row/user — PK user_id).
  CREATE TABLE IF NOT EXISTS "advisory_access" (
      "user_id" UUID NOT NULL,
      "status" "advisory_access_status" NOT NULL DEFAULT 'active',
      "granted_by" UUID,
      "granted_at" TIMESTAMPTZ,
      "banned_at" TIMESTAMPTZ,
      "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "advisory_access_pkey" PRIMARY KEY ("user_id")
  );

  -- FK to auth.users with ON DELETE CASCADE (GDPR erasure, story 11-2).
  -- ADD CONSTRAINT is not idempotent on its own, so guard it with a catalog
  -- check; a re-run on an already-migrated database must be a no-op.
  DO $$ BEGIN
    ALTER TABLE "advisory_access"
      ADD CONSTRAINT "advisory_access_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN null;
  END $$;

  -- RLS quartet (manually appended — Prisma does not introspect policies, ADR-0013).
  -- The table is user-scoped and mutable: the owner of the row may read,
  -- insert, update and delete it. apps/api connects with the service role and
  -- bypasses RLS; these policies guard the anon/direct path only (defence in
  -- depth).
  ALTER TABLE "advisory_access" ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "advisory_access_select_own" ON "advisory_access";
  CREATE POLICY "advisory_access_select_own" ON "advisory_access"
    FOR SELECT USING (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_access_insert_own" ON "advisory_access";
  CREATE POLICY "advisory_access_insert_own" ON "advisory_access"
    FOR INSERT WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_access_update_own" ON "advisory_access";
  CREATE POLICY "advisory_access_update_own" ON "advisory_access"
    FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  DROP POLICY IF EXISTS "advisory_access_delete_own" ON "advisory_access";
  CREATE POLICY "advisory_access_delete_own" ON "advisory_access"
    FOR DELETE USING (user_id = auth.uid());
  ```

  **Path:** `apps/api/src/database/id-prefixes.config.ts` (modify — append before the closing `} as const`)

  ```ts
    // AdvisoryAccess (story 12-1, ADR-0016 §4) — PK is `user_id` (UUID FK to
    // auth.users), one row per user, no synthetic id column. Same opt-out shape
    // as UserPref: the prefixed-ids extension MUST NOT inject, or the grant
    // upsert's create branch throws MissingPrefixError.
    AdvisoryAccess: null,
  } as const satisfies Record<string, string | null>;
  ```

  **Path:** `apps/api/src/database/id-prefixes.config.test.ts` (modify the count test)

  ```ts
    it("exposes exactly 24 model entries (23 existing + 12-1 AdvisoryAccess:null)", () => {
      expect(Object.keys(ID_PREFIXES)).toHaveLength(24);
    });
  ```

  **Path:** `apps/api/src/modules/settings/settings.export.ts` (modify — append after the `dashboard_layout` node)

  ```ts
    {
      key: "advisory_access",
      model: "AdvisoryAccess",
      read: (client, userId) => client.advisoryAccess.findMany({ where: { userId } }),
    },
  ];
  ```

  **Path:** `apps/api/src/modules/settings/settings.deletion.ts` (modify — append after the `dashboard_layout` node)

  ```ts
    {
      key: "advisory_access",
      model: "AdvisoryAccess",
      remove: (client, userId) => client.advisoryAccess.deleteMany({ where: { userId } }),
    },
  ];
  ```

  **Path:** `apps/api/scripts/rls-audit.ts` (modify — append inside `EXPECTED_POLICY_COUNTS`)

  ```ts
    // advisory_access — private advisory allowlist (story 12-1, ADR-0016 §4).
    // Mutable per-user row with a full RLS quartet: the row owner can read it,
    // and the insert/update/delete branches keep the quartet symmetric even
    // though only apps/api writes it today.
    advisory_access: 4,
  };
  ```

  **Run:**
  ```bash
  bun --filter='@pekulo/api' run prisma:format
  bun --filter='@pekulo/api' run prisma:check
  bun --filter='@pekulo/api' run prisma:generate
  bun --filter='@pekulo/api' run prisma:migrate:deploy
  bun --filter='@pekulo/api' run db:rls-migration-audit
  bun --filter='@pekulo/api' run test src/database/id-prefixes.config.test.ts src/modules/settings/settings.export-map.guard.test.ts src/modules/settings/settings.deletion-map.guard.test.ts
  ```

  **Expected:** `prisma:check` prints that the schema is valid; `prisma:generate` regenerates the client; `prisma:migrate:deploy` applies exactly one migration; the static audit prints `OK — 22 user-data tables, all RLS-guarded and all reachable by the auth.users cascade`; the three guard suites pass. If `DATABASE_URL` is not reachable from this machine, defer only `prisma:migrate:deploy` to deploy time and say so in the completion notes — the static audit and the guard suites still run.

  **Commit:** `git commit -m "feat(#114): advisory_access table, RLS quartet and registration gates (AC-5, AC-6)"`

- [ ] **T2 — Publish the wire schemas** [AC: AC-4, AC-8]
  **Path:** `packages/validators/src/advisory/advisory.schemas.ts` (create)

  ```ts
  // Zod source of truth for the private advisory access gate (story 12-1,
  // ADR-0016 §4). Consumed by @pekulo/contracts (oRPC I/O), the apps/api
  // service, and (from 12-4) the web tier.
  import { z } from "@pekulo/zod";

  // Postgres enum advisory_access_status is bound 1:1; "none" is the wire-only
  // state for a caller with no row (only reachable by an owner, because the
  // gate rejects everyone else before the handler runs).
  export const ADVISORY_ACCESS_STATES = ["active", "banned", "none"] as const;
  export const advisoryAccessStateSchema = z.enum(ADVISORY_ACCESS_STATES);
  export type AdvisoryAccessState = z.infer<typeof advisoryAccessStateSchema>;

  // Persisted states only — the repository never returns "none".
  export const advisoryAccessStatusSchema = z.enum(["active", "banned"]);
  export type AdvisoryAccessStatus = z.infer<typeof advisoryAccessStatusSchema>;

  export const advisoryTargetInputSchema = z.object({
    userId: z.string().uuid(),
  });
  export type AdvisoryTargetInput = z.infer<typeof advisoryTargetInputSchema>;

  // Timestamps are ISO strings on the wire (the repository maps Date →
  // toISOString), matching the llmCallLogEntrySchema convention.
  export const advisoryAccessEntrySchema = z.object({
    userId: z.string().uuid(),
    status: advisoryAccessStatusSchema,
    grantedBy: z.string().uuid().nullable(),
    grantedAt: z.string().nullable(),
    bannedAt: z.string().nullable(),
    updatedAt: z.string(),
  });
  export type AdvisoryAccessEntry = z.infer<typeof advisoryAccessEntrySchema>;

  export const advisoryStatusSchema = z.object({
    access: advisoryAccessStateSchema,
    owner: z.boolean(),
  });
  export type AdvisoryStatus = z.infer<typeof advisoryStatusSchema>;

  export const advisoryAccessListSchema = z.array(advisoryAccessEntrySchema);
  export type AdvisoryAccessList = z.infer<typeof advisoryAccessListSchema>;
  ```

  **Path:** `packages/validators/src/advisory/index.ts` (create)

  ```ts
  export * from "./advisory.schemas";
  ```

  **Path:** `packages/validators/src/index.ts` (modify — insert after `export * from "./accounts";`)

  ```ts
  export * from "./advisory";
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0 (the package is consumed through the workspace barrel).

  **Commit:** `git commit -m "feat(#114): advisory access wire schemas (AC-4, AC-8)"`

- [ ] **T3 — Publish the oRPC contract** [AC: AC-8]
  **Path:** `packages/contracts/src/advisory/advisory.contract.ts` (create)

  ```ts
  // Private advisory-surface access contract (story 12-1, ADR-0016 §4).
  // Mounted under /rpc/v1/advisory by ADR-0009's oRPC mount.
  //
  // Every procedure both (a) passes the access gate — an owner-only middleware
  // in apps/api — and (b) maps the service's FORBIDDEN/BAD_REQUEST to a typed
  // error. UNAUTHORIZED is declared for the defensive missing-context branch;
  // mountOrpc already rejects a request without a valid JWT with 401.
  import { oc } from "@orpc/contract";
  import {
    advisoryAccessEntrySchema,
    advisoryAccessListSchema,
    advisoryStatusSchema,
    advisoryTargetInputSchema,
  } from "@pekulo/validators";

  const forbiddenError = {
    status: 403 as const,
    message: "advisory surface is restricted to allowlisted users",
  };
  const badRequestError = {
    status: 400 as const,
    message: "cannot change advisory access of an owner",
  };
  const unauthorizedError = {
    status: 401 as const,
    message: "authentication required",
  };

  const advisoryErrors = {
    FORBIDDEN: forbiddenError,
    BAD_REQUEST: badRequestError,
    UNAUTHORIZED: unauthorizedError,
  } as const;

  export const advisoryContractV1 = {
    status: oc.output(advisoryStatusSchema).errors(advisoryErrors),
    grant: oc
      .input(advisoryTargetInputSchema)
      .output(advisoryAccessEntrySchema)
      .errors(advisoryErrors),
    ban: oc
      .input(advisoryTargetInputSchema)
      .output(advisoryAccessEntrySchema)
      .errors(advisoryErrors),
    list: oc.output(advisoryAccessListSchema).errors(advisoryErrors),
  } as const;

  export const advisoryContract = advisoryContractV1;
  export const advisoryContractMeta = {
    moduleKey: "advisory",
    mountPath: "/rpc/v1/advisory",
    version: "v1",
  } as const;
  ```

  **Path:** `packages/contracts/src/advisory/index.ts` (create)

  ```ts
  export * from "./advisory.contract";
  ```

  **Path:** `packages/contracts/src/index.ts` (modify — three insertion points: re-export, import, router literal)

  ```ts
  export { advisoryContract, advisoryContractV1, advisoryContractMeta } from "./advisory";

  import { advisoryContract } from "./advisory";

  export const pekuloContract = {
    auth: authContract,
    compass: compassContract,
    milestones: milestonesContract,
    accounts: accountsContract,
    holdings: holdingsContract,
    realestate: realestateContract,
    transactions: transactionsContract,
    monthly: monthlyContract,
    dashboard: dashboardContract,
    settings: settingsContract,
    hypothesis: hypothesisContract,
    llm: llmContract,
    bankaggregator: bankAggregatorContract,
    advisory: advisoryContract,
  } as const;
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0. `PekuloRpcRouter` now accepts an `advisory` key because it is derived from `pekuloContract`.

  **Commit:** `git commit -m "feat(#114): advisory oRPC contract (AC-8)"`

- [ ] **T4 — Add the platform guard** [AC: AC-1, AC-7]
  **Path:** `apps/api/src/platform/security/advisory-access-guard.ts` (create)

  ```ts
  // apps/api/src/platform/security/advisory-access-guard.ts
  // ADR-0016 §4 — private advisory-surface access gate (cross-cutting infra;
  // consumed by the advisory module's service). Takes an injected reader so
  // platform/ does NOT import modules/ (one-way layering). The advisory
  // repository satisfies AdvisoryAccessReader structurally. The client's
  // claimed allowlist state is NEVER trusted; only the row decides, and it is
  // read on every request (no cache — AC-3).
  import { PekuloError } from "../../common/errors";

  export type AdvisoryAccessStatus = "active" | "banned";

  export interface AdvisoryAccessReader {
    getAccessStatus(userId: string): Promise<AdvisoryAccessStatus | null>;
  }

  export async function requireAdvisoryAccess(
    reader: AdvisoryAccessReader,
    userId: string,
  ): Promise<void> {
    const status = await reader.getAccessStatus(userId);
    if (status !== "active") {
      // "banned" and "no row" are the same answer to the caller: the surface
      // is private, and telling a non-allowlisted user which of the two
      // applies would leak the allowlist's shape.
      throw new PekuloError("FORBIDDEN", "advisory surface is restricted to allowlisted users");
    }
  }
  ```

  **Path:** `apps/api/src/platform/security/index.ts` (modify — append)

  ```ts
  export * from "./advisory-access-guard";
  ```

  **Path:** `apps/api/src/platform/security/advisory-access-guard.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import { PekuloError } from "../../common/errors";
  import { requireAdvisoryAccess, type AdvisoryAccessReader } from "./advisory-access-guard";

  function reader(status: "active" | "banned" | null): AdvisoryAccessReader {
    return { getAccessStatus: async () => status };
  }

  describe("requireAdvisoryAccess", () => {
    test("AC-2 — an active row resolves", async () => {
      await expect(requireAdvisoryAccess(reader("active"), "u1")).resolves.toBeUndefined();
    });

    test("AC-1 — a user with no row is FORBIDDEN", async () => {
      const error = await requireAdvisoryAccess(reader(null), "u1").catch(
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(PekuloError);
      expect((error as PekuloError).code).toBe("FORBIDDEN");
    });

    test("AC-3 — a banned row is FORBIDDEN", async () => {
      const error = await requireAdvisoryAccess(reader("banned"), "u1").catch(
        (reason: unknown) => reason,
      );
      expect(error).toBeInstanceOf(PekuloError);
      expect((error as PekuloError).code).toBe("FORBIDDEN");
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/platform/security/advisory-access-guard.test.ts`

  **Expected:** 3 pass.

  **Commit:** `git commit -m "feat(#114): advisory access guard (AC-1, AC-7)"`

- [ ] **T5 — Parse the owner allowlist from env** [AC: AC-8]
  **Path:** `apps/api/src/config/advisory-owner-ids.ts` (create)

  ```ts
  // apps/api/src/config/advisory-owner-ids.ts
  // Parses ADVISORY_OWNER_USER_IDS (story 12-1, ADR-0016 §4). The owner set is
  // the root of trust for granting/banning advisory access: it lives in env,
  // not in the database, so there is no bootstrap problem and an owner cannot
  // be locked out (or ban themselves) through the API.
  //
  // Optional: unset/empty → nobody is an owner and the surface is locked down
  // to allowlisted users only. A malformed UUID fails boot instead of silently
  // dropping an owner.
  import { ConfigError } from "./env";

  // RFC 4122 shape; version/variant nibbles are not enforced because Supabase
  // user IDs are UUID v4 in practice but the exact version is not ours to police.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  export function parseAdvisoryOwnerUserIds(raw: string | undefined): ReadonlySet<string> {
    if (!raw || raw.trim() === "") return new Set();
    const ids = raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value !== "");
    const invalid = ids.filter((value) => !UUID_RE.test(value));
    if (invalid.length > 0) {
      throw new ConfigError({
        ADVISORY_OWNER_USER_IDS: [
          `invalid UUID(s): ${invalid.join(", ")} (expected comma-separated Supabase user IDs)`,
        ],
      });
    }
    return new Set(ids.map((value) => value.toLowerCase()));
  }
  ```

  **Path:** `apps/api/src/config/advisory-owner-ids.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import { ConfigError } from "./env";
  import { parseAdvisoryOwnerUserIds } from "./advisory-owner-ids";

  const OWNER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  describe("parseAdvisoryOwnerUserIds", () => {
    test("unset and empty values lock the owner set down", () => {
      expect(parseAdvisoryOwnerUserIds(undefined).size).toBe(0);
      expect(parseAdvisoryOwnerUserIds("   ").size).toBe(0);
    });

    test("parses, trims, lowercases and de-duplicates comma-separated IDs", () => {
      const result = parseAdvisoryOwnerUserIds(`${OWNER_A.toUpperCase()} , ${OWNER_A} ,`);
      expect([...result]).toEqual([OWNER_A]);
    });

    test("a malformed ID fails boot with a named field", () => {
      let error: unknown;
      try {
        parseAdvisoryOwnerUserIds("not-a-uuid");
      } catch (reason) {
        error = reason;
      }
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).fieldErrors.ADVISORY_OWNER_USER_IDS?.[0]).toContain("not-a-uuid");
    });
  });
  ```

  **Path:** `apps/api/src/config/env.ts` (modify — append inside `envSchema`, after `BRANDFETCH_LOGO_CLIENT_ID`)

  ```ts
    // Private advisory surface (story 12-1 — ADR-0016 §4). Comma-separated
    // Supabase user IDs that own the surface: they are implicitly allowlisted
    // and are the only callers allowed to grant/ban. Optional — unset locks
    // the owner set down and leaves only explicit advisory_access rows.
    // Parsed into a Set at boot by config/advisory-owner-ids.ts; an invalid
    // UUID fails boot rather than silently dropping an owner.
    ADVISORY_OWNER_USER_IDS: optionalString(z.string()),
  ```

  **Path:** `.env.example` (modify — append)

  ```bash
  # ---------- Advisory access gate (story 12-1 — ADR-0016 §4) ----------
  # Comma-separated Supabase user IDs (UUIDs) that own the private advisory
  # surface. Owners are implicitly allowlisted and are the only callers
  # allowed to grant/ban other users. Leave empty to lock the surface to
  # explicit allowlist rows only. apps/api only — never expose to apps/web.
  ADVISORY_OWNER_USER_IDS=
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/config/advisory-owner-ids.test.ts`

  **Expected:** 3 pass.

  **Commit:** `git commit -m "feat(#114): advisory owner allowlist env parser (AC-8)"`

- [ ] **T6 — Persist access decisions** [AC: AC-3, AC-4]
  **Path:** `apps/api/src/modules/advisory/advisory.repository.ts` (create)

  ```ts
  // Prisma layer for the advisory access allowlist (story 12-1, ADR-0016 §4).
  //   - getAccessStatus(userId) → "active" | "banned" | null (the gate's read)
  //   - getEntry(userId)        → row shaped for the wire, dates as ISO strings
  //   - list()                  → owner-only, cross-user by design
  //   - grant(userId, by)       → upsert active, clears banned_at
  //   - ban(userId)             → upsert banned, stamps banned_at
  // Every user-scoped query carries an explicit where: { userId } (ADR-0013,
  // defence in depth). list() is the one cross-user read in this module and
  // carries the documented lint exception.
  import type { ExtendedPrismaClient } from "../../database";
  import type {
    AdvisoryAccessEntry,
    AdvisoryAccessStatus,
  } from "@pekulo/validators";

  export interface AdvisoryAccessRepository {
    getAccessStatus(userId: string): Promise<AdvisoryAccessStatus | null>;
    getEntry(userId: string): Promise<AdvisoryAccessEntry | null>;
    list(): Promise<AdvisoryAccessEntry[]>;
    grant(userId: string, grantedBy: string): Promise<AdvisoryAccessEntry>;
    ban(userId: string): Promise<AdvisoryAccessEntry>;
  }

  interface EntryRow {
    userId: string;
    status: AdvisoryAccessStatus;
    grantedBy: string | null;
    grantedAt: Date | null;
    bannedAt: Date | null;
    updatedAt: Date;
  }

  const ENTRY_SELECT = {
    userId: true,
    status: true,
    grantedBy: true,
    grantedAt: true,
    bannedAt: true,
    updatedAt: true,
  } as const;

  function rowToEntry(row: EntryRow): AdvisoryAccessEntry {
    return {
      userId: row.userId,
      status: row.status,
      grantedBy: row.grantedBy,
      grantedAt: row.grantedAt ? row.grantedAt.toISOString() : null,
      bannedAt: row.bannedAt ? row.bannedAt.toISOString() : null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  export function createAdvisoryRepository(deps: {
    client: ExtendedPrismaClient;
  }): AdvisoryAccessRepository {
    return {
      async getAccessStatus(userId) {
        const row = await deps.client.advisoryAccess.findUnique({
          where: { userId },
          select: { status: true },
        });
        return row ? (row.status as AdvisoryAccessStatus) : null;
      },

      async getEntry(userId) {
        const row = await deps.client.advisoryAccess.findUnique({
          where: { userId },
          select: ENTRY_SELECT,
        });
        return row ? rowToEntry(row) : null;
      },

      async list() {
        // Owner-only, cross-user by design: the allowlist IS the whole table.
        // The service asserts owner membership before calling this method.
        // oxlint-disable-next-line pekulo/no-prisma-query-without-user-id -- owner-only allowlist listing
        const rows = await deps.client.advisoryAccess.findMany({
          orderBy: { updatedAt: "desc" },
          select: ENTRY_SELECT,
        });
        return rows.map(rowToEntry);
      },

      async grant(userId, grantedBy) {
        const now = new Date();
        const row = await deps.client.advisoryAccess.upsert({
          where: { userId },
          update: {
            status: "active",
            grantedBy,
            grantedAt: now,
            bannedAt: null,
          },
          create: {
            userId,
            status: "active",
            grantedBy,
            grantedAt: now,
          },
          select: ENTRY_SELECT,
        });
        return rowToEntry(row);
      },

      async ban(userId) {
        const now = new Date();
        const row = await deps.client.advisoryAccess.upsert({
          where: { userId },
          update: {
            status: "banned",
            bannedAt: now,
          },
          create: {
            userId,
            status: "banned",
            bannedAt: now,
          },
          select: ENTRY_SELECT,
        });
        return rowToEntry(row);
      },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.repository.test.ts` (create)

  ```ts
  // bun:test — advisory repository. Uses a mock Prisma client to assert the
  // query shapes and the upsert payloads. There is no Postgres test harness in
  // this repo; RLS coverage is asserted by the live db:rls-audit probe.
  import { describe, expect, mock, test } from "bun:test";
  import type { ExtendedPrismaClient } from "../../database";
  import { createAdvisoryRepository } from "./advisory.repository";

  const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const OWNER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ROW = {
    userId: USER,
    status: "active" as const,
    grantedBy: OWNER,
    grantedAt: new Date("2026-10-27T10:00:00.000Z"),
    bannedAt: null,
    updatedAt: new Date("2026-10-27T10:00:00.000Z"),
  };

  function makeClient() {
    const findUnique = mock(async (_args: unknown) => ROW);
    const findMany = mock(async (_args: unknown) => [ROW]);
    const upsert = mock(async (_args: unknown) => ROW);
    const client = {
      advisoryAccess: { findUnique, findMany, upsert },
    } as unknown as ExtendedPrismaClient;
    return { client, findUnique, findMany, upsert };
  }

  describe("createAdvisoryRepository", () => {
    test("getAccessStatus reads the row with where: { userId }", async () => {
      const { client, findUnique } = makeClient();
      const repo = createAdvisoryRepository({ client });
      expect(await repo.getAccessStatus(USER)).toBe("active");
      const args = findUnique.mock.calls[0]![0] as { where: { userId: string } };
      expect(args.where.userId).toBe(USER);
    });

    test("getEntry maps every Date to an ISO string", async () => {
      const { client } = makeClient();
      const repo = createAdvisoryRepository({ client });
      expect(await repo.getEntry(USER)).toEqual({
        userId: USER,
        status: "active",
        grantedBy: OWNER,
        grantedAt: "2026-10-27T10:00:00.000Z",
        bannedAt: null,
        updatedAt: "2026-10-27T10:00:00.000Z",
      });
    });

    test("list maps every row (owner-only caller is asserted upstream)", async () => {
      const { client } = makeClient();
      const repo = createAdvisoryRepository({ client });
      const rows = await repo.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.userId).toBe(USER);
    });

    test("grant upserts active and clears banned_at", async () => {
      const { client, upsert } = makeClient();
      const repo = createAdvisoryRepository({ client });
      await repo.grant(USER, OWNER);
      const args = upsert.mock.calls[0]![0] as {
        update: { status: string; grantedBy: string; grantedAt: Date; bannedAt: null };
        create: { userId: string; status: string; grantedBy: string; grantedAt: Date };
      };
      expect(args.update.status).toBe("active");
      expect(args.update.grantedBy).toBe(OWNER);
      expect(args.update.bannedAt).toBeNull();
      expect(args.update.grantedAt).toBeInstanceOf(Date);
      expect(args.create.userId).toBe(USER);
      expect(args.create.status).toBe("active");
    });

    test("ban upserts banned and stamps banned_at", async () => {
      const { client, upsert } = makeClient();
      const repo = createAdvisoryRepository({ client });
      await repo.ban(USER);
      const args = upsert.mock.calls[0]![0] as {
        update: { status: string; bannedAt: Date };
        create: { userId: string; status: string; bannedAt: Date };
      };
      expect(args.update.status).toBe("banned");
      expect(args.update.bannedAt).toBeInstanceOf(Date);
      expect(args.create.userId).toBe(USER);
      expect(args.create.status).toBe("banned");
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.repository.test.ts`

  **Expected:** 5 pass.

  **Commit:** `git commit -m "feat(#114): advisory access repository (AC-3, AC-4)"`

- [ ] **T7 — Own the access decisions** [AC: AC-2, AC-3, AC-4, AC-8]
  **Path:** `apps/api/src/modules/advisory/advisory.service.ts` (create)

  ```ts
  // Domain service for the advisory access gate (story 12-1, ADR-0016 §4).
  // Owns the allowlist decisions; the repository owns persistence and the
  // platform guard owns "is this user allowed". Owner membership lives in env
  // (config/advisory-owner-ids.ts), never in the database: an owner cannot be
  // banned through the API and cannot lock themselves out.
  import type {
    AdvisoryAccessEntry,
    AdvisoryAccessList,
    AdvisoryStatus,
  } from "@pekulo/validators";
  import { PekuloError } from "../../common/errors";
  import { requireAdvisoryAccess } from "../../platform/security";
  import type { AdvisoryAccessRepository } from "./advisory.repository";

  export interface AdvisoryAccessService {
    isOwner(userId: string): boolean;
    assertAllowed(userId: string): Promise<void>;
    getStatus(userId: string): Promise<AdvisoryStatus>;
    list(actorUserId: string): Promise<AdvisoryAccessList>;
    grant(actorUserId: string, targetUserId: string): Promise<AdvisoryAccessEntry>;
    ban(actorUserId: string, targetUserId: string): Promise<AdvisoryAccessEntry>;
  }

  export function createAdvisoryService(deps: {
    repository: AdvisoryAccessRepository;
    ownerUserIds: ReadonlySet<string>;
  }): AdvisoryAccessService {
    const isOwner = (userId: string): boolean =>
      deps.ownerUserIds.has(userId.trim().toLowerCase());

    function assertOwner(actorUserId: string): void {
      if (!isOwner(actorUserId)) {
        throw new PekuloError("FORBIDDEN", "advisory access management is owner-only");
      }
    }

    function assertNotOwner(targetUserId: string): void {
      if (isOwner(targetUserId)) {
        throw new PekuloError("BAD_REQUEST", "cannot change advisory access of an owner");
      }
    }

    return {
      isOwner,

      async assertAllowed(userId) {
        if (isOwner(userId)) return;
        await requireAdvisoryAccess(deps.repository, userId);
      },

      async getStatus(userId) {
        if (isOwner(userId)) return { access: "active", owner: true };
        const status = await deps.repository.getAccessStatus(userId);
        return { access: status ?? "none", owner: false };
      },

      async list(actorUserId) {
        assertOwner(actorUserId);
        return deps.repository.list();
      },

      async grant(actorUserId, targetUserId) {
        assertOwner(actorUserId);
        assertNotOwner(targetUserId);
        return deps.repository.grant(targetUserId, actorUserId);
      },

      async ban(actorUserId, targetUserId) {
        assertOwner(actorUserId);
        assertNotOwner(targetUserId);
        return deps.repository.ban(targetUserId);
      },
    };
  }
  ```

  **Path:** `apps/api/src/modules/advisory/advisory.service.test.ts` (create)

  ```ts
  import { describe, expect, test } from "bun:test";
  import type { AdvisoryAccessEntry } from "@pekulo/validators";
  import { PekuloError } from "../../common/errors";
  import type { AdvisoryAccessRepository } from "./advisory.repository";
  import { createAdvisoryService } from "./advisory.service";

  const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const MEMBER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const BANNED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function entry(userId: string, status: "active" | "banned"): AdvisoryAccessEntry {
    return {
      userId,
      status,
      grantedBy: OWNER,
      grantedAt: "2026-10-27T10:00:00.000Z",
      bannedAt: status === "banned" ? "2026-10-27T11:00:00.000Z" : null,
      updatedAt: "2026-10-27T11:00:00.000Z",
    };
  }

  function fakeRepository(rows: Map<string, AdvisoryAccessEntry>) {
    const calls: string[] = [];
    const repository: AdvisoryAccessRepository = {
      async getAccessStatus(userId) {
        calls.push(`status:${userId}`);
        return rows.get(userId)?.status ?? null;
      },
      async getEntry(userId) {
        calls.push(`entry:${userId}`);
        return rows.get(userId) ?? null;
      },
      async list() {
        calls.push("list");
        return [...rows.values()];
      },
      async grant(userId, grantedBy) {
        calls.push(`grant:${userId}:${grantedBy}`);
        const next = entry(userId, "active");
        rows.set(userId, next);
        return next;
      },
      async ban(userId) {
        calls.push(`ban:${userId}`);
        const next = entry(userId, "banned");
        rows.set(userId, next);
        return next;
      },
    };
    return { repository, calls };
  }

  function serviceWith(rows: Map<string, AdvisoryAccessEntry>) {
    const { repository, calls } = fakeRepository(rows);
    const service = createAdvisoryService({
      repository,
      ownerUserIds: new Set([OWNER]),
    });
    return { service, calls };
  }

  describe("createAdvisoryService", () => {
    test("AC-1 — a non-owner with no row is FORBIDDEN", async () => {
      const { service } = serviceWith(new Map());
      const error = await service.assertAllowed(MEMBER).catch((reason: unknown) => reason);
      expect(error).toBeInstanceOf(PekuloError);
      expect((error as PekuloError).code).toBe("FORBIDDEN");
    });

    test("AC-2 — an active non-owner is allowed", async () => {
      const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
      await expect(service.assertAllowed(MEMBER)).resolves.toBeUndefined();
    });

    test("AC-3 — a banned non-owner is FORBIDDEN", async () => {
      const { service } = serviceWith(new Map([[BANNED, entry(BANNED, "banned")]]));
      const error = await service.assertAllowed(BANNED).catch((reason: unknown) => reason);
      expect((error as PekuloError).code).toBe("FORBIDDEN");
    });

    test("AC-8 — an owner is allowed without a row and never read", async () => {
      const { service, calls } = serviceWith(new Map());
      await expect(service.assertAllowed(OWNER)).resolves.toBeUndefined();
      expect(calls).toEqual([]);
      expect(await service.getStatus(OWNER)).toEqual({ access: "active", owner: true });
    });

    test("AC-8 — status reports the stored state, and none when no row exists", async () => {
      const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
      expect(await service.getStatus(MEMBER)).toEqual({ access: "active", owner: false });
      expect(await service.getStatus("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).toEqual({
        access: "none",
        owner: false,
      });
    });

    test("AC-8 — a non-owner cannot list, grant or ban", async () => {
      const { service } = serviceWith(new Map([[MEMBER, entry(MEMBER, "active")]]));
      for (const action of [
        () => service.list(MEMBER),
        () => service.grant(MEMBER, BANNED),
        () => service.ban(MEMBER, BANNED),
      ]) {
        const error = await action().catch((reason: unknown) => reason);
        expect((error as PekuloError).code).toBe("FORBIDDEN");
      }
    });

    test("AC-8 — the owner grants with their own id as granted_by", async () => {
      const { service, calls } = serviceWith(new Map());
      const result = await service.grant(OWNER, MEMBER);
      expect(result.userId).toBe(MEMBER);
      expect(result.status).toBe("active");
      expect(calls).toContain(`grant:${MEMBER}:${OWNER}`);
    });

    test("AC-8 — an owner cannot be granted or banned", async () => {
      const { service } = serviceWith(new Map());
      const grant = await service.grant(OWNER, OWNER).catch((reason: unknown) => reason);
      const ban = await service.ban(OWNER, OWNER).catch((reason: unknown) => reason);
      expect((grant as PekuloError).code).toBe("BAD_REQUEST");
      expect((ban as PekuloError).code).toBe("BAD_REQUEST");
    });

    test("AC-4 — a grant clears the ban state", async () => {
      const rows = new Map([[BANNED, entry(BANNED, "banned")]]);
      const { service } = serviceWith(rows);
      const result = await service.grant(OWNER, BANNED);
      expect(result.status).toBe("active");
      expect(rows.get(BANNED)?.status).toBe("active");
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.service.test.ts`

  **Expected:** 9 pass.

  **Commit:** `git commit -m "feat(#114): advisory access service (AC-2, AC-3, AC-4, AC-8)"`

- [ ] **T8 — Gate every advisory procedure** [AC: AC-1, AC-3, AC-4, AC-8]
  **Path:** `apps/api/src/modules/advisory/advisory.routes.ts` (create)

  ```ts
  // oRPC handlers for the private advisory access gate (story 12-1, ADR-0016 §4).
  // Every procedure is gated by the same .use() middleware: the gate runs
  // before any handler, so a non-allowlisted caller cannot compute advisory
  // data (AC-1) and a ban is effective on the next request with no cache to
  // invalidate (AC-3). Future procedures added to this router inherit the
  // gate by construction.
  import { implement } from "@orpc/server";
  import { advisoryContract } from "@pekulo/contracts";
  import { isPekuloError, PekuloError } from "../../common/errors";
  import type { AdvisoryAccessService } from "./advisory.service";

  const impl = implement(advisoryContract).$context<{
    userId: string;
    email: string | null;
  }>();

  function requireUserId(userId: string | undefined): asserts userId is string {
    if (!userId || !userId.trim()) {
      throw new PekuloError("UNAUTHORIZED", "user context missing");
    }
  }

  export function createAdvisoryRouter(deps: { service: AdvisoryAccessService }) {
    const gated = impl.use(async ({ context, errors, next }) => {
      requireUserId(context.userId);
      try {
        await deps.service.assertAllowed(context.userId);
      } catch (err) {
        // Re-thrown as the contract's typed errors: oRPC collapses any other
        // throw to 500 inside handler.handle(), before the mount's mapper runs.
        if (isPekuloError(err) && err.code === "FORBIDDEN") {
          throw errors.FORBIDDEN({ message: err.message });
        }
        if (isPekuloError(err) && err.code === "UNAUTHORIZED") {
          throw errors.UNAUTHORIZED({ message: err.message });
        }
        throw err;
      }
      return next();
    });

    return gated.router({
      status: gated.status.handler(async ({ context }) => {
        requireUserId(context.userId);
        return deps.service.getStatus(context.userId);
      }),

      grant: gated.grant.handler(async ({ context, input, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.grant(context.userId, input.userId);
        } catch (err) {
          if (isPekuloError(err) && err.code === "FORBIDDEN") {
            throw errors.FORBIDDEN({ message: err.message });
          }
          if (isPekuloError(err) && err.code === "BAD_REQUEST") {
            throw errors.BAD_REQUEST({ message: err.message });
          }
          throw err;
        }
      }),

      ban: gated.ban.handler(async ({ context, input, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.ban(context.userId, input.userId);
        } catch (err) {
          if (isPekuloError(err) && err.code === "FORBIDDEN") {
            throw errors.FORBIDDEN({ message: err.message });
          }
          if (isPekuloError(err) && err.code === "BAD_REQUEST") {
            throw errors.BAD_REQUEST({ message: err.message });
          }
          throw err;
        }
      }),

      list: gated.list.handler(async ({ context, errors }) => {
        requireUserId(context.userId);
        try {
          return await deps.service.list(context.userId);
        } catch (err) {
          if (isPekuloError(err) && err.code === "FORBIDDEN") {
            throw errors.FORBIDDEN({ message: err.message });
          }
          throw err;
        }
      }),
    });
  }
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0. The middleware is exercised end to end by T10.

  **Commit:** `git commit -m "feat(#114): gated advisory routes (AC-1, AC-3, AC-4, AC-8)"`

- [ ] **T9 — Wire the module at the composition root** [AC: AC-1, AC-8]
  **Path:** `apps/api/src/modules/advisory/advisory.module.ts` (create)

  ```ts
  // Module factory wiring repository + service + router for the private
  // advisory access gate (story 12-1, ADR-0016 §4). Mirrors ADR-0009
  // (createXxxModule(deps) → { service, router }).
  import type { PrismaService } from "../../database";
  import { createAdvisoryRepository } from "./advisory.repository";
  import { createAdvisoryService, type AdvisoryAccessService } from "./advisory.service";
  import { createAdvisoryRouter } from "./advisory.routes";

  export interface AdvisoryModule {
    service: AdvisoryAccessService;
    router: ReturnType<typeof createAdvisoryRouter>;
  }

  export function createAdvisoryModule(deps: {
    prismaService: PrismaService;
    ownerUserIds: ReadonlySet<string>;
  }): AdvisoryModule {
    const repository = createAdvisoryRepository({ client: deps.prismaService.client });
    const service = createAdvisoryService({
      repository,
      ownerUserIds: deps.ownerUserIds,
    });
    const router = createAdvisoryRouter({ service });
    return { service, router };
  }
  ```

  **Path:** `apps/api/src/bootstrap/runtime-dependencies.ts` (modify — import, construction, router literal)

  ```ts
  import { parseAdvisoryOwnerUserIds } from "../config/advisory-owner-ids";
  import { createAdvisoryModule } from "../modules/advisory/advisory.module";

  // Story 12-1 (ADR-0016 §4) — private advisory access gate. The owner set is
  // parsed from env here, at the composition root; the module itself never
  // reads process.env.
  const advisoryModule = createAdvisoryModule({
    prismaService,
    ownerUserIds: parseAdvisoryOwnerUserIds(input.env.ADVISORY_OWNER_USER_IDS),
  });

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
    settings: settingsModule.router,
    advisory: advisoryModule.router,
  };
  ```

  **Run:** `bun --filter='@pekulo/api' run typecheck`

  **Expected:** exit 0. Boot now mounts `/rpc/v1/advisory`; an empty `ADVISORY_OWNER_USER_IDS` is valid and locks the owner set down.

  **Commit:** `git commit -m "feat(#114): mount advisory module (AC-1, AC-8)"`

- [ ] **T10 — Prove the gate at the HTTP boundary** [AC: AC-1, AC-2, AC-3, AC-4, AC-8]
  **Path:** `apps/api/src/modules/advisory/advisory.integration.test.ts` (create)

  ```ts
  // oRPC HTTP-boundary proof for the private advisory access gate (story 12-1,
  // ADR-0016 §4). Boots a real Elysia app with the real mountOrpc + RPCHandler
  // + jose HS256 verifier + the real advisory router and service, pointed at
  // an in-memory repository.
  //
  // Why a fake repository (no real DB): the repo's integration-test convention
  // is a boundary test; the repository's `where: { userId }` guard is enforced
  // by pekulo/no-prisma-query-without-user-id and RLS is asserted by the live
  // db:rls-audit probe. What this catches that the unit tests do not:
  //   - the gate runs before every handler (AC-1, AC-3)
  //   - the ban is effective on the NEXT request, with no cached pass (AC-3)
  //   - the JWT subject reaches the service (AC-2, AC-4)
  //   - each error crosses the RPC envelope as a typed 403/400
  import { afterAll, beforeAll, describe, expect, test } from "bun:test";
  import { Elysia } from "elysia";
  import { SignJWT } from "jose";
  import type { AdvisoryAccessEntry } from "@pekulo/validators";
  import { extractRequestId } from "../../common/errors";
  import { mapErrorToOrpcResponse } from "../../platform/http/error-mapper";
  import { mountOrpc, type PekuloRpcRouter } from "../../platform/http/orpc-mount";
  import { createJwtVerifier } from "../../platform/security";
  import type { AdvisoryAccessRepository } from "./advisory.repository";
  import { createAdvisoryRouter } from "./advisory.routes";
  import { createAdvisoryService } from "./advisory.service";

  const SECRET = "integration-secret-at-least-32-chars-long-aaaa";
  const ISSUER = "https://integration.supabase.co/auth/v1";
  const AUDIENCE = "authenticated";
  // RFC 4122 v4 — version nibble `4`, variant nibble `8`.
  const OWNER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const USER_ACTIVE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const USER_BANNED = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const USER_MEMBER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const USER_UNKNOWN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  // PORT_BASE picked clear of sibling suites (hypothesis 13900, accounts 14160,
  // llm 14360, holdings 14500, compass 14700, milestones 14900, settings 15100,
  // settings export 15300).
  const PORT_BASE = 15500;

  function entry(userId: string, status: "active" | "banned"): AdvisoryAccessEntry {
    const stamp = "2026-10-27T10:00:00.000Z";
    return {
      userId,
      status,
      grantedBy: status === "active" ? OWNER : null,
      grantedAt: status === "active" ? stamp : null,
      bannedAt: status === "banned" ? stamp : null,
      updatedAt: stamp,
    };
  }

  class InMemoryAdvisoryRepository implements AdvisoryAccessRepository {
    readonly rows = new Map<string, AdvisoryAccessEntry>();
    statusReads = 0;

    async getAccessStatus(userId: string): Promise<"active" | "banned" | null> {
      this.statusReads += 1;
      return this.rows.get(userId)?.status ?? null;
    }

    async getEntry(userId: string): Promise<AdvisoryAccessEntry | null> {
      return this.rows.get(userId) ?? null;
    }

    async list(): Promise<AdvisoryAccessEntry[]> {
      return [...this.rows.values()];
    }

    async grant(userId: string, grantedBy: string): Promise<AdvisoryAccessEntry> {
      const base = entry(userId, "active");
      const row = { ...base, grantedBy, grantedAt: base.updatedAt };
      this.rows.set(userId, row);
      return row;
    }

    async ban(userId: string): Promise<AdvisoryAccessEntry> {
      const previous = this.rows.get(userId);
      const row = {
        ...entry(userId, "banned"),
        grantedBy: previous?.grantedBy ?? null,
        grantedAt: previous?.grantedAt ?? null,
      };
      this.rows.set(userId, row);
      return row;
    }
  }

  const repository = new InMemoryAdvisoryRepository();

  async function signFor(userId: string): Promise<string> {
    return new SignJWT({ email: `${userId}@pekulo.local` })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
      .sign(new TextEncoder().encode(SECRET));
  }

  let appHandle: { stop: () => Promise<void> } | undefined;
  let baseUrl = "";

  async function call(method: string, body: unknown, token?: string): Promise<Response> {
    return fetch(`${baseUrl}/rpc/v1/advisory/${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ json: body }),
    });
  }

  beforeAll(async () => {
    repository.rows.set(USER_ACTIVE, entry(USER_ACTIVE, "active"));
    repository.rows.set(USER_MEMBER, entry(USER_MEMBER, "active"));
    repository.rows.set(USER_BANNED, entry(USER_BANNED, "banned"));

    const jwtVerifier = createJwtVerifier({ secret: SECRET, issuer: ISSUER, audience: AUDIENCE });
    const service = createAdvisoryService({
      repository,
      ownerUserIds: new Set([OWNER]),
    });
    const router = createAdvisoryRouter({ service });
    const orpcRouter: PekuloRpcRouter = { advisory: router };
    const port = PORT_BASE + Math.floor(Math.random() * 200);
    const app = new Elysia().onError(({ error, set }) => {
      const requestId = extractRequestId(error) ?? crypto.randomUUID();
      const mapped = mapErrorToOrpcResponse(error, requestId);
      set.status = mapped.status;
      return mapped.body;
    });
    mountOrpc(app, { jwtVerifier, orpcRouter });
    await new Promise<void>((resolve) => {
      app.listen({ port, hostname: "127.0.0.1" }, () => resolve());
    });
    baseUrl = `http://127.0.0.1:${port}`;
    appHandle = { stop: async () => void (await app.stop()) };
  });

  afterAll(async () => {
    await appHandle?.stop();
    appHandle = undefined;
  });

  describe("advisory /rpc/v1/advisory HTTP boundary (story 12-1)", () => {
    test("AC-1 — non-allowlisted caller is 403 in < 100 ms and the handler never runs", async () => {
      const token = await signFor(USER_UNKNOWN);
      const before = repository.statusReads;
      const started = performance.now();
      const res = await call("status", {}, token);
      const elapsed = performance.now() - started;

      expect(res.status).toBe(403);
      const body = (await res.json()) as { json: { code: string } };
      expect(body.json.code).toBe("FORBIDDEN");
      expect(elapsed).toBeLessThan(100);
      // One read is the gate. A second read would mean getStatus ran and the
      // request computed access data after the gate had already said no.
      expect(repository.statusReads - before).toBe(1);
    });

    test("AC-2 — an active allowlisted caller passes the gate", async () => {
      const res = await call("status", {}, await signFor(USER_ACTIVE));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: { access: string; owner: boolean } };
      expect(body.json).toEqual({ access: "active", owner: false });
    });

    test("AC-3 — a ban rejects the very next request with the same token", async () => {
      const token = await signFor(USER_ACTIVE);
      const allowed = await call("status", {}, token);
      expect(allowed.status).toBe(200);

      const banned = await call("ban", { userId: USER_ACTIVE }, await signFor(OWNER));
      expect(banned.status).toBe(200);

      const denied = await call("status", {}, token);
      expect(denied.status).toBe(403);
      const body = (await denied.json()) as { json: { code: string } };
      expect(body.json.code).toBe("FORBIDDEN");
    });

    test("AC-4 — re-granting restores access on the next request", async () => {
      const token = await signFor(USER_BANNED);
      const denied = await call("status", {}, token);
      expect(denied.status).toBe(403);

      const granted = await call("grant", { userId: USER_BANNED }, await signFor(OWNER));
      expect(granted.status).toBe(200);

      const restored = await call("status", {}, token);
      expect(restored.status).toBe(200);
      const body = (await restored.json()) as { json: { access: string; owner: boolean } };
      expect(body.json).toEqual({ access: "active", owner: false });
    });

    test("AC-8 — the owner is implicitly allowed and sees their own status", async () => {
      const res = await call("status", {}, await signFor(OWNER));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: { access: string; owner: boolean } };
      expect(body.json).toEqual({ access: "active", owner: true });
    });

    test("AC-8 — the owner can list the allowlist", async () => {
      const res = await call("list", {}, await signFor(OWNER));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { json: AdvisoryAccessEntry[] };
      expect(body.json.map((row) => row.userId)).toContain(USER_MEMBER);
    });

    test("AC-8 — an active non-owner cannot list or grant", async () => {
      const token = await signFor(USER_MEMBER);
      const list = await call("list", {}, token);
      expect(list.status).toBe(403);
      expect(((await list.json()) as { json: { code: string } }).json.code).toBe("FORBIDDEN");

      const grant = await call("grant", { userId: USER_UNKNOWN }, token);
      expect(grant.status).toBe(403);
    });

    test("AC-8 — the owner cannot grant or ban another owner", async () => {
      const res = await call("ban", { userId: OWNER }, await signFor(OWNER));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { json: { code: string } }).json.code).toBe("BAD_REQUEST");
    });

    test("AC-8 — no JWT is 401 before the gate reads anything", async () => {
      const before = repository.statusReads;
      const res = await call("status", {});
      expect(res.status).toBe(401);
      expect(((await res.json()) as { code: string }).code).toBe("UNAUTHORIZED");
      expect(repository.statusReads).toBe(before);
    });
  });
  ```

  **Run:** `bun --filter='@pekulo/api' run test src/modules/advisory/advisory.integration.test.ts`

  **Expected:** 9 pass. If the AC-1 latency assertion flakes on a loaded machine, rerun once before investigating; the measured work is one in-memory read plus the HTTP round trip.

  **Commit:** `git commit -m "test(#114): advisory HTTP boundary (AC-1, AC-2, AC-3, AC-4, AC-8)"`

- [ ] **T11 — Run the full gate set and fix what it surfaces** [AC: AC-9]
  **Path:** every file touched by T1 through T10 (verification only).

  No new code. Run the five gates below and fix any drift they surface. Per lesson 2026-06-15, also prove the lint rule still fires on the owner-only `list()` read: temporarily delete the `oxlint-disable-next-line pekulo/no-prisma-query-without-user-id` comment, run lint, confirm it fails naming `advisory.repository.ts`, then restore the comment.

  **Run:**
  ```bash
  bun --filter='@pekulo/api' run test
  bun --filter='@pekulo/api' run typecheck
  bun --filter='@pekulo/api' run lint
  bun --filter='@pekulo/api' run db:rls-migration-audit
  bun --filter='@pekulo/api' run db:rls-audit
  ```

  **Expected:** tests exit 0 with the new advisory suites included; typecheck exit 0; lint exit 0 (and the temporary removal of the disable exits 1); the static RLS audit prints `OK — 22 user-data tables`; the live audit prints `OK` with `advisory_access` at 4 policies. The live audit needs `DATABASE_URL`; if it is unavailable, record that in the completion notes and do not claim AC-9.

  **Commit:** no commit when the gates are green. If a fix is required, commit it as `fix(#114): <what the gate caught>`.

## Dev Notes

- **Architecture:** ADR-0016 §2/§4 is the requirement source. ADR-0009 fixes the mount path (`/rpc/v1/advisory`) and the module-factory shape. ADR-0013 fixes the two defence layers: `where: { userId }` on every user-scoped Prisma query (the oxlint rule enforces it) and RLS as the anon-path backstop. `apps/api` connects with the service role and bypasses RLS, so the gate is the actual authorization control; RLS is not what stops an API call. The guard lives in `apps/api/src/platform/security/` and takes an injected reader, exactly like `opt-in-guard.ts`, because `platform/` must not import `modules/`.
- **Why the middleware, not per-handler checks:** `implement(advisoryContract).$context<PekuloRpcContext>().use()` gates every procedure in the router, including the analysis procedures that 12-2 will add. A per-handler check would be one forgotten call away from an ungated advisory endpoint, and AC-1 is a compliance control.
- **No cache by design:** the gate performs one `findUnique` per request. Do not add memoisation, a request-scoped cache, or an in-process LRU: AC-3 requires a ban to bite on the very next request. The integration test proves it with the same JWT before and after the ban.
- **Owner semantics:** owners come from `ADVISORY_OWNER_USER_IDS` (env, parsed at boot), never from the table. They are implicitly allowed, so there is no bootstrap row to seed and an owner cannot be locked out. Granting/banning an owner is rejected with `BAD_REQUEST` so the env set stays the only authority over owner membership.
- **Grant vs reactivate:** `grant` is an upsert to `active` that clears `banned_at`. AC-4's "re-set to active" is the same operation; a separate `reactivate` procedure would be a second code path with no distinct semantics.
- **Nullable grant columns:** `granted_by`/`granted_at` are nullable because an owner may ban a user who never had a row. A ban-first row records `banned_at` and leaves the grant columns null rather than attributing a fictional grant.
- **Error mapping:** oRPC collapses undeclared throws to 500 inside `handler.handle()`, before the Elysia mapper runs (see `settings.routes.ts`). Every procedure therefore declares `FORBIDDEN`, `BAD_REQUEST` and `UNAUTHORIZED`, and both the middleware and the handlers re-throw through the contract's typed constructors.
- **CLI commands:** always use the workspace filter (for example `bun --filter='@pekulo/api' run test`), never a bare `bun test` (lesson 2026-05-19). Bun test path arguments follow the script name.
- **T1 is one atomic unit:** it touches seven registration points that the guard suites assert as a set. Splitting it would leave the tree red between commits because the export/deletion guards name the missing node, so it lands together despite spanning more than one file.
- **Test strategy:** unit tests cover the guard, the owner parser, the repository payloads and the service decisions. The integration test is the only one that boots HTTP; it uses an in-memory repository because the repo has no Postgres test harness, and the service is the real one so the gate/owner logic is exercised across the RPC envelope.
- **Latency assertion:** AC-1's 100 ms budget is measured around the HTTP call in the boundary test. It includes JWT verification, routing, one in-memory read and serialisation; it does not include a real Postgres round trip. The gate adds exactly one indexed primary-key read, so the production budget is this test plus one DB RTT.
- **Cross-user read:** `list()` is the only query in this module without `where: { userId }`. The service asserts owner membership first; the lint exception is documented inline and must stay narrow. If the rule fires on the comment's line layout, move the comment directly above the `findMany` call.
- **Export/deletion registration:** both node lists derive their expected model set from the Prisma DMMF in guard tests (`settings.export-map.guard.test.ts`, `settings.deletion-map.guard.test.ts`). Adding `AdvisoryAccess` to the schema without the two nodes fails those guards by name. The historical "21 tables" comments in those files describe the 11-1 state; do not rewrite them as part of this story.
- **RLS count:** `EXPECTED_POLICY_COUNTS` is checked by the live `db:rls-audit` probe. The quartet is intentional even though only the service role writes today: the table is user-scoped and mutable, and the 11-3 gate treats the quartet as the shape for a regular CRUD table. A 3-policy variant would need a documented reason (the audit-sister pattern), which this table is not.
- **Scope guardrails:** no UI (12-4), no analysis engine (12-2), no LLM calls (12-3). No new `PekuloErrorCode` is needed: `FORBIDDEN`, `BAD_REQUEST` and `UNAUTHORIZED` already exist with the correct HTTP statuses. Do not change `sprint.active_epic`; this story was registered outside the active sprint and the state flip below only moves the story to `ready-for-dev`.
- **Doc-debt flag:** `docs/prd.md` (DR-3/NFR-12) and `docs/architecture.md` still do not mention ADR-0016 or the advisory carve-out. The epic and the ADR do. This story does not edit those documents; flag it for a dedicated doc-sync pass rather than smuggling an architecture rewrite into a story commit.
- **Dependencies:** no new packages. `@orpc/server@1.14.1` already exposes `BuilderWithMiddlewares` with `.use()` and `.router()`; `jose`, `elysia`, `bun:test` and the Prisma client are already installed. `ADVISORY_OWNER_USER_IDS` is optional, so existing env fixtures and deployments boot unchanged.

### File responsibilities (3-bullet decision map)

- **`apps/api/prisma/schema/advisory.prisma`** — single responsibility: declare the advisory_access row shape and its status enum. Inputs: none. Outputs: the `AdvisoryAccess` model and `AdvisoryAccessStatus` enum consumed by the generated Prisma client.
- **`apps/api/prisma/migrations/20261027130000_create_advisory_access/migration.sql`** — single responsibility: create the table, its auth.users cascade FK and the RLS quartet idempotently. Inputs: none. Outputs: the applied schema plus policies read by the static and live RLS gates.
- **`packages/validators/src/advisory/advisory.schemas.ts`** — single responsibility: define the advisory access wire shapes. Inputs: `@pekulo/zod`. Outputs: state, target, entry, status and list schemas plus their inferred types.
- **`packages/validators/src/advisory/index.ts`** — single responsibility: barrel the advisory schemas. Inputs: `advisory.schemas`. Outputs: the same exports at the folder boundary.
- **`packages/contracts/src/advisory/advisory.contract.ts`** — single responsibility: declare the four procedures, their I/O and typed errors. Inputs: `@orpc/contract`, `@pekulo/validators`. Outputs: `advisoryContractV1`, `advisoryContract`, `advisoryContractMeta`.
- **`packages/contracts/src/advisory/index.ts`** — single responsibility: barrel the advisory contract. Inputs: `advisory.contract`. Outputs: the same exports at the folder boundary.
- **`apps/api/src/platform/security/advisory-access-guard.ts`** — single responsibility: decide whether a userId may use the advisory surface. Inputs: an injected `AdvisoryAccessReader` and a userId. Outputs: resolves or throws `FORBIDDEN`.
- **`apps/api/src/platform/security/advisory-access-guard.test.ts`** — single responsibility: prove the guard's three outcomes. Inputs: the guard. Outputs: pass/fail.
- **`apps/api/src/config/advisory-owner-ids.ts`** — single responsibility: parse and validate the owner env list. Inputs: the raw env string. Outputs: a normalized `ReadonlySet<string>` or `ConfigError`.
- **`apps/api/src/config/advisory-owner-ids.test.ts`** — single responsibility: prove parsing, normalization and fail-fast. Inputs: the parser. Outputs: pass/fail.
- **`apps/api/src/modules/advisory/advisory.repository.ts`** — single responsibility: persist and read access rows through Prisma. Inputs: `ExtendedPrismaClient`. Outputs: the `AdvisoryAccessRepository` surface.
- **`apps/api/src/modules/advisory/advisory.repository.test.ts`** — single responsibility: assert query and upsert payloads against a fake client. Inputs: the repository factory. Outputs: pass/fail.
- **`apps/api/src/modules/advisory/advisory.service.ts`** — single responsibility: own allowlist and owner decisions. Inputs: the repository and the owner set. Outputs: `AdvisoryAccessService`.
- **`apps/api/src/modules/advisory/advisory.service.test.ts`** — single responsibility: prove every decision branch. Inputs: the service factory. Outputs: pass/fail.
- **`apps/api/src/modules/advisory/advisory.routes.ts`** — single responsibility: expose the contract over oRPC with the gate middleware. Inputs: the service. Outputs: the router.
- **`apps/api/src/modules/advisory/advisory.module.ts`** — single responsibility: compose repository, service and router. Inputs: `PrismaService` and the owner set. Outputs: `AdvisoryModule`.
- **`apps/api/src/modules/advisory/advisory.integration.test.ts`** — single responsibility: prove the gate across the real HTTP boundary. Inputs: the router, service and a fake repository. Outputs: pass/fail.
- **`apps/api/src/database/id-prefixes.config.ts`** — single responsibility: register the prefix policy per model. Modification: `AdvisoryAccess: null`. Outputs: the registry the extension reads.
- **`apps/api/src/database/id-prefixes.config.test.ts`** — single responsibility: guard registry completeness. Modification: expect 24 entries. Outputs: pass/fail.
- **`apps/api/src/platform/security/index.ts`** — single responsibility: barrel platform security. Modification: re-export the guard. Outputs: the import surface used by the service.
- **`apps/api/src/config/env.ts`** — single responsibility: validate the process environment. Modification: accept optional `ADVISORY_OWNER_USER_IDS`. Outputs: the typed `Env`.
- **`apps/api/src/bootstrap/runtime-dependencies.ts`** — single responsibility: compose runtime dependencies. Modification: build the module and add its router. Outputs: the mounted `orpcRouter`.
- **`packages/validators/src/index.ts`** — single responsibility: barrel every validator domain. Modification: re-export advisory. Outputs: the package surface.
- **`packages/contracts/src/index.ts`** — single responsibility: aggregate every contract. Modification: re-export advisory and add it to `pekuloContract`. Outputs: the router shape consumed by the mount and the web client factory.
- **`apps/api/src/modules/settings/settings.export.ts`** — single responsibility: enumerate what a user's export contains. Modification: add the advisory_access node. Outputs: `EXPORT_NODES` consumed by the stream and its guard.
- **`apps/api/src/modules/settings/settings.deletion.ts`** — single responsibility: enumerate what account deletion removes. Modification: add the advisory_access node. Outputs: `DELETION_NODES` consumed by the erasure and its guard.
- **`apps/api/scripts/rls-audit.ts`** — single responsibility: hold the live RLS inventory. Modification: `advisory_access: 4`. Outputs: `EXPECTED_POLICY_COUNTS` consumed by the audit and the restore drill.
- **`.env.example`** — single responsibility: document the env surface. Modification: the owner list block. Outputs: operator-facing documentation.
- **`docs/state.yaml`** — single responsibility: pipeline state. Modification: story status to `ready-for-dev` after the file exists. Outputs: the state consumed by `aped-dev`.

### Existing code at write time (Step-0 quotes)

`apps/api/src/database/id-prefixes.config.ts` (tail — insert `AdvisoryAccess: null` before the registry closes):

```ts
  // UserPref (story 8-2, FR-51/FR-52) — PK is `user_id` (UUID FK to
  // auth.users), one row per user, no synthetic id column. Same opt-out
  // shape as DashboardLayout: the prefixed-ids extension MUST NOT inject,
  // or the getOrCreate upsert's create branch throws MissingPrefixError.
  UserPref: null,
} as const satisfies Record<string, string | null>;
```

`apps/api/src/database/id-prefixes.config.test.ts` (current count assertion — 23 becomes 24):

```ts
describe("id-prefixes.config", () => {
  it("exposes exactly 23 model entries (… + 8-2 UserPref:null)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(23);
  });
```

`apps/api/src/modules/settings/settings.export.ts` (last two nodes — advisory_access appends after dashboard_layout):

```ts
  {
    key: "user_pref",
    model: "UserPref",
    read: (client, userId) => client.userPref.findMany({ where: { userId } }),
  },
  {
    key: "dashboard_layout",
    model: "DashboardLayout",
    read: (client, userId) => client.dashboardLayout.findMany({ where: { userId } }),
  },
```

`apps/api/src/modules/settings/settings.deletion.ts` (last two nodes — advisory_access appends after dashboard_layout):

```ts
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
```

`apps/api/scripts/rls-audit.ts` (tail of the expected counts — advisory_access appends before the object closes):

```ts
  dashboard_layout: 3,
};

export interface RlsAuditResult {
  checked: number;
  summary: string[];
  drift: string[];
}
```

`apps/api/src/platform/security/index.ts` (current barrel — append the guard export):

```ts
export type { JwtVerifier } from "./jwt-verifier";
export { createJwtVerifier } from "./jwt-verifier";
export type { UserContext } from "./require-user-context";
export { requireUserContext } from "./require-user-context";
export * from "./opt-in-guard";
```

`apps/api/src/config/env.ts` (tail — the new optional key goes before the schema closes):

```ts
  BRANDFETCH_API_KEY: optionalString(z.string().min(1)),
  BRANDFETCH_SEARCH_BASE: z.string().url().default("https://api.brandfetch.io/v2/search"),
  BRANDFETCH_LOGO_BASE: z.string().url().default("https://cdn.brandfetch.io"),
  BRANDFETCH_LOGO_CLIENT_ID: optionalString(z.string().min(1)),
});

export type Env = z.infer<typeof envSchema>;
```

`apps/api/src/bootstrap/runtime-dependencies.ts` (settings construction and router literal — the advisory module mirrors both):

```ts
  const settingsModule = createSettingsModule({
    prismaService,
    jwtVerifier,
    providerErasure: {
      eraseUser: (userId) => bankAggregatorModule.service.eraseUserAtProvider(userId),
    },
    authAdmin: createSupabaseAuthAdmin({
      supabaseUrl: input.env.SUPABASE_URL,
      serviceRoleKey: input.env.SUPABASE_SERVICE_ROLE_KEY,
    }),
  });

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
    settings: settingsModule.router,
  };
```

`packages/validators/src/index.ts` (current barrel — advisory inserts after accounts):

```ts
export * from "./accounts";
export * from "./auth";
export * from "./bank-aggregator";
export * from "./compass";
export * from "./data-export";
export * from "./dashboard";
export * from "./holdings";
export * from "./hypothesis";
export * from "./llm";
export * from "./milestones";
export * from "./monthly";
export * from "./realestate";
export * from "./settings";
export * from "./transactions";
```

`packages/contracts/src/index.ts` (three insertion points — re-export, import and router literal):

```ts
export { settingsContract, settingsContractV1, settingsContractMeta } from "./settings";

import { settingsContract } from "./settings";

export const pekuloContract = {
  auth: authContract,
  compass: compassContract,
  milestones: milestonesContract,
  accounts: accountsContract,
  holdings: holdingsContract,
  realestate: realestateContract,
  transactions: transactionsContract,
  monthly: monthlyContract,
  dashboard: dashboardContract,
  settings: settingsContract,
  hypothesis: hypothesisContract,
  llm: llmContract,
  bankaggregator: bankAggregatorContract,
} as const;
```

`.env.example` (tail — the advisory block appends after the restore-drill block):

```bash
# ---------- Restore drill (story 11-6 — NFR-21) ----------
# Only read by `bun --filter=@pekulo/api db:restore-drill-check`. Point
# DATABASE_URL + SUPABASE_URL at the RESTORED staging project for the run.
# The email/password must belong to an auth.users row that survived the
# restore; the anon key is the staging project's public key.
RESTORE_DRILL_SUPABASE_ANON_KEY=
RESTORE_DRILL_EMAIL=
RESTORE_DRILL_PASSWORD=
RESTORE_DRILL_API_BASE_URL=http://127.0.0.1:3001
```

`docs/state.yaml` (current epic-12 entry — status flips after the story file exists):

```yaml
    12-1-advisory-access-gate: {status: pending, depends_on: [], ticket: "#114", worktree: null}
```

### Existing patterns to follow

- **Guard:** `apps/api/src/platform/security/opt-in-guard.ts` — injected reader interface, no `modules/` import, `PekuloError` with a stable code.
- **Module factory:** `apps/api/src/modules/settings/settings.module.ts` — `createXxxModule(deps) → { service, router }`, repository built from `prismaService.client`.
- **Routes + error mapping:** `apps/api/src/modules/settings/settings.routes.ts` — `requireUserId`, typed-error re-throw, service owns the rule.
- **Integration test:** `apps/api/src/modules/settings/settings.integration.test.ts` — real Elysia + `mountOrpc` + jose HS256, fake data layer, `PORT_BASE` clear of siblings.
- **RLS migration:** `apps/api/prisma/migrations/20260616120000_create_user_pref/migration.sql` — enum guard, idempotent table, hand-appended policies.
- **Prisma repository test:** `apps/api/src/modules/llm/llm.repository.test.ts` — `mock()` delegates cast through `PrismaService`.

## File List

**Creates**

- `apps/api/prisma/schema/advisory.prisma`
- `apps/api/prisma/migrations/20261027130000_create_advisory_access/migration.sql`
- `packages/validators/src/advisory/advisory.schemas.ts`
- `packages/validators/src/advisory/index.ts`
- `packages/contracts/src/advisory/advisory.contract.ts`
- `packages/contracts/src/advisory/index.ts`
- `apps/api/src/platform/security/advisory-access-guard.ts`
- `apps/api/src/platform/security/advisory-access-guard.test.ts`
- `apps/api/src/config/advisory-owner-ids.ts`
- `apps/api/src/config/advisory-owner-ids.test.ts`
- `apps/api/src/modules/advisory/advisory.repository.ts`
- `apps/api/src/modules/advisory/advisory.repository.test.ts`
- `apps/api/src/modules/advisory/advisory.service.ts`
- `apps/api/src/modules/advisory/advisory.service.test.ts`
- `apps/api/src/modules/advisory/advisory.routes.ts`
- `apps/api/src/modules/advisory/advisory.module.ts`
- `apps/api/src/modules/advisory/advisory.integration.test.ts`

**Modifies**

- `apps/api/src/database/id-prefixes.config.ts`
- `apps/api/src/database/id-prefixes.config.test.ts`
- `apps/api/src/platform/security/index.ts`
- `apps/api/src/config/env.ts`
- `apps/api/src/bootstrap/runtime-dependencies.ts`
- `packages/validators/src/index.ts`
- `packages/contracts/src/index.ts`
- `apps/api/src/modules/settings/settings.export.ts`
- `apps/api/src/modules/settings/settings.deletion.ts`
- `apps/api/scripts/rls-audit.ts`
- `.env.example`
- `docs/state.yaml`

## Dev Agent Record

### Summary

### Files changed

### Deviations

### Test output
