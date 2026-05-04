# Story: 0-4-prisma-setup — Prisma 7.8 schema folder + prefixed IDs + baseline migration

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** review-queued
**Ticket:** [#4](https://github.com/yabafre/pekulo/issues/4)
**Branch:** `feat/0-4-prisma-setup`
**Commit prefix:** `feat(#4): ...` (or `chore(#4):` / `fix(#4):` per task type)
**Closes:** #4
**Stepscompleted:**
**Reference ADRs:** [ADR-0012 — Prisma 7.8.0 + schema folder + prefixed IDs](../adr/0012-prisma-7-schema-folder-prefixed-ids.md), [ADR-0014 — Schema migrations via Prisma migrate](../adr/0014-prisma-migrations.md)
**Watch item:** W6 — `prismaSchemaFolder` is a Prisma preview feature. If it gets removed or breaking-changed before stable promotion, fall back to a single `schema.prisma` with stricter file ordering discipline.

---

## User Story

**As a** Pekulo developer, **I want** Prisma 7.8 wired in `apps/api` with the multi-file schema folder, the `@prisma/adapter-pg` driver adapter, the Trafi-pattern prefixed-IDs Prisma extension, a central `id-prefixes.config.ts` registry covering every Pekulo model from ADR-0012, and a baseline migration that collapses the 7 brownfield tables of `apps/web/supabase-schema.sql` into Prisma's migration toolchain, **so that** every domain story from epics 1–8 declares its tables in a single canonical place under `apps/api/prisma/schema/<module>.prisma`, every row carries an auditable prefixed ID (`acc_…`, `tx_…`), and `prisma migrate deploy` is the only schema-change mechanism going forward.

---

## Acceptance Criteria

- **AC-1 (baseline applies cleanly against a local Supabase Postgres):** **Given** the Prisma setup is complete, the dev has run `(cd apps/web && bunx supabase start)` to spin up a local Supabase Postgres on `127.0.0.1:54322`, and `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` is set in `apps/api/.env.local`, **When** I run `(cd apps/api && bun run prisma:migrate:deploy)`, **Then** the migration `0_baseline_brownfield` applies the 7 brownfield tables (`kpis`, `monthly_tracking`, `hypotheses`, `transactions`, `accounts`, `holdings`, `holding_lots`), the 4 enums (`transaction_type`, `account_type`, `holding_kind`, `lot_type`), and the RLS policies, and `(cd apps/api && bun run prisma:migrate:status)` reports `Database schema is up to date!` with `1 migration found` and `Following migration have been applied: 0_baseline_brownfield`.

- **AC-2 (prefix extension produces prefixed IDs at create time):** **Given** the `prefixed-ids.injector.ts` pure helper is wired into `prisma.service.ts` via `Prisma.defineExtension`, **When** I run `(cd apps/api && bun test src/database/prefixed-ids.injector.test.ts)`, **Then** all tests pass with at least the four assertions: (i) `injectPrefixedId("Account", { userId: "u" })` returns an object whose `id` matches the regex `^acc_[0-9A-Za-z]{21}$`, (ii) `injectPrefixedId("Account", { id: "explicit_id", userId: "u" })` returns the input unchanged (idempotence), (iii) `injectPrefixedId("FakeModel", {})` throws a `MissingPrefixError` with message containing `FakeModel`, (iv) `injectPrefixedId("Holding", {})` returns an `id` starting with `hld_`.

- **AC-3 (RLS audit script passes against the deployed baseline):** **Given** the baseline applied via AC-1, **When** I run `(cd apps/api && bun run db:rls-audit)`, **Then** the script connects to `DATABASE_URL`, asserts the 7 brownfield tables are RLS-enabled (`pg_tables.rowsecurity = true`), counts the policies per table, and exits 0 with the report `[rls-audit] OK — 7 tables checked: kpis (3 policies), monthly_tracking (3), hypotheses (3), transactions (4), accounts (4), holdings (4), holding_lots (4)`. (The 3-vs-4 split is intentional and mirrors the brownfield SQL — `kpis` / `monthly_tracking` / `hypotheses` ship without DELETE policies; the four newer tables have the full quartet.)

- **AC-4 (typecheck stays green with the generated client):** **Given** the Prisma client emitted under `apps/api/generated/prisma/`, the `@generated/prisma/client` path alias in `apps/api/tsconfig.json`, and the extended client exported by `prisma.service.ts`, **When** I run `(cd apps/api && bun run typecheck)`, **Then** `tsc --noEmit` exits 0 and produces no output.

- **AC-5 (Dockerfile builds with prisma generate; container `/health` returns 200):** **Given** the Dockerfile updated to copy `apps/api/prisma/`, run `bunx prisma generate`, and stage the generated client into the runtime image, **When** I run `docker build -f apps/api/Dockerfile -t pekulo-api:dev .` from the repo root, then `docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev`, **Then** the container starts within 10 s, `curl -fsS http://127.0.0.1:3001/health` returns HTTP 200 with body `{"status":"ok"}`, and the build log contains the line `prisma:generate ✔ Generated Prisma Client`.

- **AC-6 (id-prefixes registry is unique and well-formed):** **Given** the `id-prefixes.config.ts` registry, **When** I run `(cd apps/api && bun test src/database/id-prefixes.config.test.ts)`, **Then** all tests pass with at least the three assertions: (i) every prefix value matches the regex `^[a-z]{2,4}$`, (ii) the set of prefixes has no duplicates (the test computes `Object.values(ID_PREFIXES).length === new Set(Object.values(ID_PREFIXES)).size`), (iii) the registry contains exactly the 14 keys listed in ADR-0012's prefix table.

> **AC-1 dev preconditions reminder.** Supabase CLI is available as a `devDependency` in `apps/web` (`supabase ^2.95.4`). The local Supabase project lives at `apps/web/supabase/` (already exists; ships with three `migrations/` files from the brownfield era). `(cd apps/web && bunx supabase start)` provisions a Docker-backed Postgres + the `auth` schema with `auth.users` + `auth.uid()` on port 54322 — both required by the RLS DDL in the baseline. **Do NOT remove or rewrite `apps/web/supabase/migrations/*`** in this story (they are the brownfield seed; future stories may delete them once Prisma owns deployment fully).

---

## Dev Notes

### Existing code at write time

This story modifies five existing files and introduces 14 new files. The five existing files are quoted verbatim below so the dev's mental model matches reality before any edit.

#### `apps/api/package.json` (current — modified by Task 1)

```json
{
  "name": "@pekulo/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo domain API — Bun + Elysia + oRPC. See ADR-0009.",
  "main": "./src/main.ts",
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "start": "bun src/main.ts",
    "build": "bun build src/main.ts --target=bun --outdir=dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "elysia": "1.4.4",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@types/bun": "1.3.0",
    "typescript": "^5.6.0"
  }
}
```

#### `apps/api/tsconfig.json` (current — modified by Task 3)

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/apps.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": ["bun"]
  },
  "include": ["src/**/*.ts"]
}
```

#### `apps/api/src/config/env.ts` (current — modified by Task 2)

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly fieldErrors: Record<string, string[] | undefined>;
  constructor(fieldErrors: Record<string, string[] | undefined>) {
    super(`invalid env: ${JSON.stringify(fieldErrors)}`);
    this.fieldErrors = fieldErrors;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
```

#### `apps/api/src/database/index.ts` (current — replaced by Task 7)

```ts
// Placeholder for apps/api/src/database/. Prisma 7.8 + extensions land here in
// story 0-4-prisma-setup:
//
//   - prisma.service.ts             Prisma client + extension chain
//   - prefixed-ids.extension.ts     Trafi pattern (ADR-0012)
//   - id-prefixes.config.ts         Record<ModelName, prefix>
//   - prisma-error-mapper.ts        P2025 → RlsViolationError, etc.
//
// See ADR-0012 (prefixed IDs) + ADR-0014 (Prisma migrate, supersedes ADR-0006).
export {};
```

#### `apps/api/src/bootstrap/runtime-dependencies.ts` (current — modified by Task 8)

```ts
import type { Env } from "../config/env";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  return { env: input.env, readiness };
}
```

#### `apps/api/src/bootstrap/lifecycle.ts` (current — modified by Task 8)

```ts
import type { AnyElysia } from "elysia";

export interface LifecycleOptions {
  shutdownTimeoutMs: number;
}

export async function registerLifecycle(app: AnyElysia, options: LifecycleOptions): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    let exitCode = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), options.shutdownTimeoutMs);
      });
      const outcome = await Promise.race([app.stop().then(() => "stopped" as const), timeout]);
      if (outcome === "timeout") {
        console.error(`[api] shutdown timed out after ${options.shutdownTimeoutMs}ms`);
        exitCode = 1;
      }
    } catch (err) {
      console.error("[api] error during shutdown:", err);
      exitCode = 1;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      process.exit(exitCode);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
```

> Lesson 2026-05-04 (L2 in `docs/lessons.md`): Elysia 1.4 `Elysia` type is **invariant** — keep `app: AnyElysia` here; do NOT narrow to bare `Elysia` when wiring `prismaService.disconnect()`.

#### `apps/api/Dockerfile` (current — modified by Task 10)

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + ALL workspace manifests for cache-friendly frozen install.
# `bun install --frozen-lockfile` requires every workspace member declared in the
# root `workspaces` glob to have its package.json present, otherwise Bun reports
# "lockfile had changes" and aborts. apps/prices has no package.json (Python
# workspace, ignored by Bun's glob).
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages packages

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
RUN bun install --frozen-lockfile

# Copy app sources.
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

# Drop privileges. `oven/bun:slim` ships a non-root `bun` user (uid=1000).
# chown is run as root before the USER switch so the runtime can read installed deps.
RUN chown -R bun:bun /app
USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]
```

> Lesson 2026-05-04 (L1 in `docs/lessons.md`): Bun `--frozen-lockfile` Docker scope. The current Dockerfile already copies `apps/api/`, `apps/web/`, and `packages/` workspace manifests before `bun install`. Task 10 adds a Prisma generate step **after** the workspace install but **before** copying sources — `prisma generate` reads `apps/api/prisma/schema/` and writes to `apps/api/generated/prisma/`, both of which must be COPYed into the image first. **Do NOT** restructure the existing workspace-manifest copy block — it is load-bearing per L1.

### Existing reference: `apps/web/supabase-schema.sql` (NOT modified)

The seven brownfield tables that the baseline migration must reproduce. The file is ~270 LOC and lives at `apps/web/supabase-schema.sql`. Key specifics the dev MUST preserve in the Prisma schema + the baseline SQL:

- **`kpis`** — UUID PK, FK `user_id → auth.users(id) ON DELETE CASCADE`, `UNIQUE(user_id)`, NUMERIC defaults (`net_reel=3700`, `pouvoir_achat=3943`, `epargne_mois=1210`, `capital_projete=145738`, `objectif=100000`), `created_at`/`updated_at` defaulting to `now()`. **3 RLS policies** (SELECT, INSERT, UPDATE — no DELETE).
- **`monthly_tracking`** — UUID PK, FK to `auth.users`, `UNIQUE(user_id, month_num, year)`, `month_num INTEGER`, `year INTEGER`, `month_label TEXT`, plus the 11 numeric tracking columns (`net`, `avantages=243`, `depenses=2490`, `credit=0`, `remote=0`, `freelance=0`, `epargne_mois`, `perf_marche=0`, `epargne_cumul`, `capital_total`). **3 RLS policies** (SELECT, INSERT, UPDATE).
- **`hypotheses`** — UUID PK, FK to `auth.users`, `UNIQUE(user_id)`, the 25 hypothesis columns including `horizon_years SMALLINT NOT NULL DEFAULT 5` and `objectif NUMERIC NOT NULL DEFAULT 100000`. **3 RLS policies** (SELECT, INSERT, UPDATE).
- **`transactions`** — UUID PK, FK to `auth.users`, `occurred_on DATE`, `label TEXT`, `amount NUMERIC CHECK (amount >= 0)`, `type transaction_type NOT NULL` (enum), `category TEXT`, `is_imprevu BOOLEAN DEFAULT false`, `notes TEXT`, indexed on `(user_id, occurred_on DESC)`. **4 RLS policies** (SELECT, INSERT, UPDATE, DELETE).
- **`accounts`** — UUID PK, FK to `auth.users`, `label TEXT`, `type account_type NOT NULL` (enum), `currency TEXT DEFAULT 'EUR'`, `cash_balance NUMERIC DEFAULT 0 CHECK (cash_balance >= 0)`, `notes TEXT`. **4 RLS policies**.
- **`holdings`** — UUID PK, FK to `auth.users` AND FK to `accounts(id) ON DELETE CASCADE`, `kind holding_kind NOT NULL` (enum), `ticker TEXT`, `isin TEXT`, `label TEXT`, `currency TEXT DEFAULT 'EUR'`, `quantity` / `avg_cost` / `last_price` numeric checks `>= 0`, `last_price_at DATE`, `notes TEXT`, indexed on `(user_id, account_id)`. **4 RLS policies**.
- **`holding_lots`** — UUID PK, FK to `auth.users` AND FK to `holdings(id) ON DELETE CASCADE`, `type lot_type NOT NULL` (enum), `occurred_on DATE`, `quantity NUMERIC CHECK (quantity > 0)`, `price_unit NUMERIC CHECK (price_unit >= 0)`, `fees NUMERIC DEFAULT 0 CHECK (fees >= 0)`, `notes TEXT`, indexed on `(user_id, holding_id, occurred_on)`. **4 RLS policies**.

**Brownfield enums:** `transaction_type` = `('inflow', 'outflow')` ; `account_type` = `('livret', 'pea', 'cto', 'av', 'autre')` ; `holding_kind` = `('etf', 'action', 'autre')` ; `lot_type` = `('buy', 'sell')`.

**Important:** `holding_kind` does NOT include `'crypto'` yet (the V1 crypto extension is owned by story 3-1-holdings-orpc-port). Do NOT add it preemptively in 0-4 — match the brownfield enum exactly.

### File decisions (3-bullet template per file)

**Greenfield — `apps/api/prisma/schema/`**

#### `apps/api/prisma/schema/_base.prisma` — new

- **Single responsibility:** declare the Prisma `datasource db` (postgresql + driver-adapter), the `generator client` with `previewFeatures = ["prismaSchemaFolder", "driverAdapters"]` and `output = "../generated/prisma"`, and bind `apps/api/prisma/schema/` as the canonical schema folder. No models live here.
- **Inputs:** environment variable `DATABASE_URL`.
- **Outputs:** Prisma metadata consumed by `prisma migrate`, `prisma generate`, every other `*.prisma` file in the folder.

#### `apps/api/prisma/schema/enums.prisma` — new

- **Single responsibility:** declare the four brownfield enums (`AccountType`, `HoldingKind`, `TransactionType`, `LotType`) with `@@map` directives binding them to the lower-case Postgres enum names (`account_type`, `holding_kind`, `transaction_type`, `lot_type`).
- **Inputs:** none.
- **Outputs:** enum types referenced by `accounts.prisma` and `transactions.prisma`.

#### `apps/api/prisma/schema/accounts.prisma` — new

- **Single responsibility:** declare the three brownfield models that share an account-as-aggregate-root concern: `Account`, `Holding`, `HoldingLot`. Map them to the snake_case brownfield tables via `@@map("accounts")`, `@@map("holdings")`, `@@map("holding_lots")`. Reproduce the FK chain (`Holding.accountId → Account.id`, `HoldingLot.holdingId → Holding.id`) and the brownfield indexes (`(user_id, account_id)` on holdings, `(user_id, holding_id, occurred_on)` on lots).
- **Inputs:** `AccountType`, `HoldingKind`, `LotType` from `enums.prisma`.
- **Outputs:** TS types `Account`, `Holding`, `HoldingLot` available via the generated client at `apps/api/generated/prisma/`.

#### `apps/api/prisma/schema/transactions.prisma` — new

- **Single responsibility:** declare the brownfield `Transaction` model mapped to `transactions`, with the `(user_id, occurred_on DESC)` index preserved.
- **Inputs:** `TransactionType` from `enums.prisma`.
- **Outputs:** TS type `Transaction` from the generated client.

#### `apps/api/prisma/schema/monthly.prisma` — new

- **Single responsibility:** declare the two brownfield models that share a "snapshot per month" concern: `Kpi` (singleton per user, mapped to `kpis`) and `MonthlyTracking` (one row per user-month-year, mapped to `monthly_tracking`).
- **Inputs:** none.
- **Outputs:** TS types `Kpi`, `MonthlyTracking` from the generated client.

#### `apps/api/prisma/schema/hypothesis.prisma` — new

- **Single responsibility:** declare the brownfield `Hypothesis` model mapped to `hypotheses`. The 25 columns are reproduced verbatim including the `horizon_years` and `objectif` columns the V1 compass reuses (per ADR-0012 + grill-summary).
- **Inputs:** none.
- **Outputs:** TS type `Hypothesis` from the generated client.

#### `apps/api/prisma/migrations/migration_lock.toml` — new (Prisma-generated)

- **Single responsibility:** record the migration provider so Prisma fails loud on accidental provider drift (e.g. someone setting `provider = "sqlite"` in a future migration).
- **Inputs:** none.
- **Outputs:** consumed by Prisma migrate.

#### `apps/api/prisma/migrations/0_baseline_brownfield/migration.sql` — new

- **Single responsibility:** the SQL collapse of the brownfield `apps/web/supabase-schema.sql`. Two halves: (1) DDL generated by `prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema --script` (tables, enums, indexes, FKs); (2) RLS-policy DDL appended manually below a clearly-marked comment marker. The 3-vs-4 policy split is preserved verbatim from the brownfield file.
- **Inputs:** the `*.prisma` files in `prisma/schema/`.
- **Outputs:** consumed by `prisma migrate deploy`. Per ADR-0014, manual edits AFTER initial collapse are forbidden.

**Greenfield — `apps/api/src/database/`**

#### `apps/api/src/database/id-prefixes.config.ts` — new

- **Single responsibility:** the canonical `Record<ModelName, Prefix>` registry of every Pekulo prefixed-ID. Contains all 14 entries from ADR-0012's prefix table — including future models (`CompassHistory`, `Milestone`, `RealEstate`, `RealEstateRental`, `RealEstateValuation`, `LlmCallLog`, `LlmOptIn`) registered upfront so subsequent stories cannot drift the convention. Exports `ID_PREFIXES`, `ModelName`, and `getPrefix(model: string): string`.
- **Inputs:** none.
- **Outputs:** consumed by `prefixed-ids.injector.ts` and indirectly by every Prisma `create` call through the extension.

#### `apps/api/src/database/id-prefixes.config.test.ts` — new

- **Single responsibility:** prove the registry's invariants — every prefix matches `^[a-z]{2,4}$`, no two models share a prefix, exactly 14 keys (catches drift if a model is removed without a story).
- **Inputs:** `ID_PREFIXES` from sibling.
- **Outputs:** Bun test pass/fail.

#### `apps/api/src/database/base62.ts` — new

- **Single responsibility:** generate a base62 random string of length N. Single export `generateBase62Id(length: number): string`. Uses Web Crypto's `crypto.getRandomValues` (available in Bun without import).
- **Inputs:** desired length (call sites pass `21` for ~125 bits of entropy).
- **Outputs:** a base62 string composed only of `[0-9A-Za-z]`.

#### `apps/api/src/database/base62.test.ts` — new

- **Single responsibility:** prove (a) length is honoured, (b) every character is in the base62 alphabet, (c) two consecutive calls produce different IDs (probabilistic — the ~125-bit entropy makes collision astronomically unlikely).
- **Inputs:** `generateBase62Id`.
- **Outputs:** Bun test pass/fail.

#### `apps/api/src/database/prefixed-ids.injector.ts` — new

- **Single responsibility:** the **pure** logic the Prisma extension delegates to. Single export `injectPrefixedId<T extends { id?: unknown }>(model: string, data: T): T` — if `data.id` is already set, return `data` unchanged; otherwise look up `model` in `ID_PREFIXES`, throw `MissingPrefixError` if absent, and return a new object with `id: ${prefix}_${generateBase62Id(21)}`. Also exports `class MissingPrefixError extends Error`.
- **Inputs:** `ID_PREFIXES`, `generateBase62Id`.
- **Outputs:** a transformed `data` object or a thrown `MissingPrefixError`.

#### `apps/api/src/database/prefixed-ids.injector.test.ts` — new

- **Single responsibility:** prove the four behaviours called out in AC-2 — happy path produces `acc_<21>`, idempotence returns input unchanged, unregistered model throws `MissingPrefixError`, second model produces correct prefix (`hld_…`).
- **Inputs:** `injectPrefixedId`, `MissingPrefixError`.
- **Outputs:** Bun test pass/fail.

#### `apps/api/src/database/prefixed-ids.extension.ts` — new

- **Single responsibility:** wire `injectPrefixedId` into a `Prisma.defineExtension` that intercepts `query.$allModels.{create, createMany, createManyAndReturn, upsert}`. The thin wrapper delegates ID injection to the pure helper and forwards via `query(args)`. No business logic lives here — the extension is integration glue only.
- **Inputs:** `Prisma` namespace from the generated client; `injectPrefixedId`, `MissingPrefixError`.
- **Outputs:** the `prefixedIdsExtension` constant consumed by `prisma.service.ts`.

#### `apps/api/src/database/prisma.service.ts` — new

- **Single responsibility:** construct the Prisma client with the `PrismaPg` driver adapter and apply the `prefixedIdsExtension`. Exposes `createPrismaService({ databaseUrl }: { databaseUrl: string }): PrismaService` where `PrismaService` is the typed-extended client plus `connect()` / `disconnect()` shims that call Prisma's underlying `$connect()` / `$disconnect()`.
- **Inputs:** `DATABASE_URL` (passed by `runtime-dependencies.ts`).
- **Outputs:** an extended Prisma client used by every domain repository in epics 1–8.

#### `apps/api/src/database/index.ts` — replace placeholder

- **Single responsibility:** the public entry of the `database/` layer. Re-exports `createPrismaService`, type `PrismaService`, `ID_PREFIXES`, `getPrefix`, `MissingPrefixError`. Story 0-5 will add `prisma-error-mapper.ts` re-exports here; do not pre-bake them.
- **Inputs:** sibling files in this directory.
- **Outputs:** the surface consumed by `bootstrap/runtime-dependencies.ts`.

**Greenfield — `apps/api/scripts/`**

#### `apps/api/scripts/rls-audit.ts` — new

- **Single responsibility:** a minimal SQL probe that connects to `DATABASE_URL` via `pg`, queries `pg_tables` and `pg_policies` for the 7 brownfield tables, asserts each is `rowsecurity = true`, and counts policies per table. Exit 0 with a one-line `[rls-audit] OK — ...` summary on success; exit 1 with a per-table diff on any drift. This is the V1 (a) personal version of the CI `rls-audit` job that lands in story 0-8.
- **Inputs:** `DATABASE_URL`, `pg` driver (pulled in transitively via `@prisma/adapter-pg`'s `pg` peer).
- **Outputs:** stdout audit report; exit code (0 ok, 1 drift).

**Modified — root + `apps/api/`**

#### `apps/api/package.json` — modified by Task 1

- **Diff:** add three runtime deps (`@prisma/client`, `@prisma/adapter-pg`, `pg`), one devDep (`prisma`, `@types/pg`), and seven scripts (`prisma:generate`, `prisma:migrate:dev`, `prisma:migrate:deploy`, `prisma:migrate:status`, `prisma:format`, `prisma:validate`, `db:rls-audit`). Tells Prisma where the schema folder is via the `"prisma": { "schema": "prisma/schema" }` block (Prisma 7 reads the manifest config).
- **Inputs:** existing manifest.
- **Outputs:** Bun resolves the new deps; CLI entries for the dev.

#### `apps/api/tsconfig.json` — modified by Task 3

- **Diff:** add `compilerOptions.paths = { "@generated/prisma/*": ["./generated/prisma/*"] }`, and extend `include` to `["src/**/*.ts", "generated/prisma/**/*.ts"]` so the generated client compiles. Keep `rootDir: "src"` — `noEmit` is true so `rootDir` is informational; the generated dir is included only to type-check imports.
- **Inputs:** the existing tsconfig.
- **Outputs:** typechecker resolves the `@generated/prisma/client` alias, and the generated client's `.ts` files are visible.

#### `apps/api/.gitignore` — modified by Task 3

- **Diff:** append `generated/` so the Prisma generator output stays out of git. The `.env.local` / `.env.*.local` lines from story 0-3 stay.
- **Inputs:** existing gitignore.
- **Outputs:** generated artefacts excluded.

#### `apps/api/src/config/env.ts` — modified by Task 2

- **Diff:** add `DATABASE_URL: z.string().url()` to the Zod schema (no default — fail fast if absent).
- **Inputs:** existing env loader.
- **Outputs:** `Env.DATABASE_URL: string` consumed downstream.

#### `apps/api/src/bootstrap/runtime-dependencies.ts` — modified by Task 8

- **Diff:** create `prismaService` via `createPrismaService({ databaseUrl: input.env.DATABASE_URL })`, register a readiness probe under name `"prisma"` that runs `await prismaService.$queryRaw\`SELECT 1\`` and returns `{ ok: true }` (or `{ ok: false, reason }` on throw), and add `prismaService` to `RuntimeDeps`.
- **Inputs:** `Env`, `Readiness`, `createPrismaService`.
- **Outputs:** an enriched `RuntimeDeps` consumed by `app.ts` and `lifecycle.ts`.

#### `apps/api/src/bootstrap/lifecycle.ts` — modified by Task 8

- **Diff:** the function signature gains a third parameter `deps: { prismaService: PrismaService }`. Inside the shutdown handler, between `outcome` resolution and `process.exit`, await `deps.prismaService.disconnect()` so the connection pool drains cleanly. Keep `app: AnyElysia` — do NOT narrow to `Elysia` (lesson L2).
- **Inputs:** the existing lifecycle.
- **Outputs:** clean shutdown including DB disconnect.

#### `apps/api/Dockerfile` — modified by Task 10

- **Diff:** add `COPY apps/api/prisma apps/api/prisma` after the workspace-manifest install (NOT before — bun install must succeed first), then `RUN cd apps/api && bunx prisma generate` to emit the client into `apps/api/generated/prisma/`. The existing `chown -R bun:bun /app` already covers the generated dir.
- **Inputs:** existing Dockerfile.
- **Outputs:** an image carrying the generated client; the runtime can `import { PrismaClient } from "@generated/prisma/client"` without ever calling `prisma generate` at boot.

#### `apps/api/.dockerignore` — modified by Task 10

- **Diff:** add `apps/api/generated/` so locally-generated client doesn't pollute the build context (the Dockerfile generates fresh inside the image). Re-include `apps/api/prisma/` is NOT required because no broader `apps/api/**` exclude exists.
- **Inputs:** existing `.dockerignore`.
- **Outputs:** smaller, deterministic build context.

#### `apps/api/README.md` — modified by Task 10

- **Diff:** add a "Database setup" section describing the local Supabase Postgres bootstrap (`(cd apps/web && bunx supabase start)`), the `DATABASE_URL` line in `apps/api/.env.local`, and the four day-to-day commands (`bun run prisma:generate`, `bun run prisma:migrate:dev`, `bun run prisma:migrate:deploy`, `bun run db:rls-audit`).
- **Inputs:** existing README.
- **Outputs:** clear onboarding for the next dev.

#### `.env.example` (root) — modified by Task 2

- **Diff:** append a new section `# ---------- apps/api (Prisma) ----------` with `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres` and a comment pointing at `(cd apps/web && bunx supabase start)`.
- **Inputs:** existing `.env.example`.
- **Outputs:** template for the dev's `.env.local`.

### Architecture references

- **ADR-0012** (`docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md`) — the binding decision for Prisma 7.8.0, schema folder, `@prisma/adapter-pg`, the prefixed-IDs Trafi pattern, the 14-entry prefix table, and the `@@map` retention for brownfield tables.
- **ADR-0014** (`docs/adr/0014-prisma-migrations.md`) — Prisma migrate as the schema-change toolchain (supersedes ADR-0006). Forward-only, baseline-collapsed, RLS DDL appended manually, `rls-audit` CI re-asserts.
- **`docs/architecture.md` § Phase 2 — Data Layer** — the prefix table, the schema-folder topology, the `@@map` retention, and the `Prefixed IDs propagate to every wire surface` consequence.
- **`docs/architecture.md` § Phase 3 — Process Rules → Schema migration discipline** — every schema-touching PR includes a Prisma migration generated by `prisma migrate dev` ; manual edits to the baseline collapse migration are forbidden after merge ; every new user-scoped table includes 4 RLS policies appended manually to the migration SQL ; audit tables include only INSERT + SELECT (append-only enforcement).
- **`docs/architecture.md` § Phase 3 — Process Rules → Prefixed-IDs discipline** — every new model registered in `id-prefixes.config.ts` BEFORE the first migration ; uniqueness asserted by `id-prefixes.config.test.ts` ; `{prefix}_{base62}` IDs propagate everywhere a userId is shown.
- **`docs/architecture.md` § Watch Items → W6** — `prismaSchemaFolder` is a Prisma preview feature; pin Prisma version exactly (no `^` range) and audit on every bump.

### Lesson-driven reminders (from `docs/lessons.md`)

- **L1 — Bun `--frozen-lockfile` Docker scope.** The Dockerfile already copies all workspace manifests + `packages/` before `bun install`. Task 10 adds `prisma generate` AFTER the install but BEFORE the source copy; the install step itself is unchanged. **Do NOT** restructure the workspace-manifest copy block.
- **L2 — Elysia `Elysia` is invariant.** `lifecycle.ts` currently uses `app: AnyElysia`. Keep it. Do NOT introduce bare `Elysia` type annotations on any new function exposed to the bootstrap layer.
- **L3, L4, L5** are oxlint-related and not directly relevant to story 0-4. Story 0-12 owns those rules.

### TypeScript and tooling pinning (binding for this story)

- **Prisma 7.8.0** (CLI + `@prisma/client` + `@prisma/adapter-pg`) — pin EXACT (`"prisma": "7.8.0"`, `"@prisma/client": "7.8.0"`, `"@prisma/adapter-pg": "7.8.0"`). No caret. W6 + W1 discipline.
- **`pg` 8.13.x** — Postgres driver consumed by `@prisma/adapter-pg`. Pin to `^8.13`.
- **`@types/pg`** — devDep, paired with `pg`.
- **Bun 1.3.13** — already pinned in root `package.json`. The Dockerfile uses `oven/bun:1.3.13-slim` ; do NOT bump.
- **TypeScript 5.x** — already pinned. The generated Prisma client is TS-first; `tsc --noEmit` validates it.

### Out of scope (explicit non-goals — do NOT do these in this story)

- ❌ Do NOT add domain models for `Compass`, `Milestone`, `RealEstate`, `RealEstateRental`, `RealEstateValuation`, `LlmCallLog`, `LlmOptIn`, or `CompassHistory` to the schema folder. Those are owned by their respective domain stories (1-1 compass-domain, 1-2 milestones-domain, 4-1 realestate-domain, 6-1 llm-routing-and-providers, etc.). The `id-prefixes.config.ts` registry registers their prefixes upfront — the schema files do NOT.
- ❌ Do NOT add the `'crypto'` value to the `holding_kind` enum. The crypto extension is owned by story 3-1 (holdings-orpc-port).
- ❌ Do NOT install `@orpc/*`, wire any oRPC contract, or touch `apps/api/src/modules/`. Owned by story 0-5.
- ❌ Do NOT install `@opentelemetry/*` or instrument Prisma queries. Owned by story 0-7 (Prisma instrumentation lives there).
- ❌ Do NOT implement `requireUserContext`, JWT verification, or any auth helper. Owned by story 0-5 / 0-6. Service-role key handling lands later.
- ❌ Do NOT add a `prisma-error-mapper.ts` (P2025 → `RlsViolationError`, etc.) — it lands with the first repository in story 2-1 (accounts-orpc-port).
- ❌ Do NOT modify `apps/web/supabase-schema.sql` or any file under `apps/web/supabase/migrations/`. They remain the brownfield seed; cleanup is a future story (likely under 0-8 once Prisma owns deployment).
- ❌ Do NOT switch the local DB strategy away from `bunx supabase start`. A future story may add a docker-compose substitute; for 0-4, supabase-CLI is the only documented path.
- ❌ Do NOT bump root `package.json` (no new root scripts, no new root deps). All Prisma-related additions live in `apps/api/package.json`.
- ❌ Do NOT add `import "server-only"` markers anywhere in `apps/api/`. The marker is a Next.js convention; `apps/api` is server-only by definition.
- ❌ Do NOT use `bun --cwd apps/api ...` in any documentation or commit message. The repo convention (per the 0-3 lesson) is `(cd apps/api && bun run <script>)`.

---

## Tasks

> Each task is intended to take 3–5 minutes and ends with a `git add` + `git commit`. The dev agent runs them in order.

### Task 1 — Add Prisma deps + scripts to `apps/api/package.json` [AC: AC-4, AC-5]

Replace `apps/api/package.json` with the version below. The diff is: three new `dependencies`, one new `devDependencies` (Prisma CLI + pg types), seven new `scripts`, and a top-level `"prisma"` block locking the schema folder path.

**1a. `apps/api/package.json`** (replace entire file):

```json
{
  "name": "@pekulo/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo domain API — Bun + Elysia + oRPC. See ADR-0009.",
  "main": "./src/main.ts",
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "start": "bun src/main.ts",
    "build": "bun build src/main.ts --target=bun --outdir=dist",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:migrate:status": "prisma migrate status",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "db:rls-audit": "bun run scripts/rls-audit.ts"
  },
  "prisma": {
    "schema": "prisma/schema"
  },
  "dependencies": {
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "elysia": "1.4.4",
    "pg": "^8.13.1",
    "zod": "4.3.6"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@types/bun": "1.3.0",
    "@types/pg": "^8.11.10",
    "prisma": "7.8.0",
    "typescript": "^5.6.0"
  }
}
```

Run: `bun install`
Expected output: contains `+ @prisma/client@7.8.0`, `+ @prisma/adapter-pg@7.8.0`, `+ prisma@7.8.0`, `+ pg@8.13.x` lines (or equivalent install summary); `bun.lock` is updated; exit 0.

Commit:

```bash
git add apps/api/package.json bun.lock
git commit -m "feat(#4): add Prisma 7.8.0 deps + scripts to @pekulo/api"
```

---

### Task 2 — Add `DATABASE_URL` to env loader and root `.env.example` [AC: AC-1]

Two file edits: extend the Zod env schema, and document the local Supabase URL in the root `.env.example`.

**2a. `apps/api/src/config/env.ts`** (replace entire file):

```ts
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export class ConfigError extends Error {
  override readonly name = "ConfigError";
  readonly fieldErrors: Record<string, string[] | undefined>;
  constructor(fieldErrors: Record<string, string[] | undefined>) {
    super(`invalid env: ${JSON.stringify(fieldErrors)}`);
    this.fieldErrors = fieldErrors;
  }
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
```

**2b. `.env.example`** (root — append the block below to the existing file; do NOT touch the existing Supabase / prices / Twelve Data sections):

```env

# ---------- apps/api (Prisma direct connection) ----------
# Local dev: spin up the Supabase Docker stack from apps/web — it ships a Postgres
# on port 54322 with the `auth` schema (auth.users + auth.uid()) populated.
#
#   (cd apps/web && bunx supabase start)
#
# Then copy this line into apps/api/.env.local (gitignored). Production uses the
# Supabase project's connection string set in Dokploy env, never committed here.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 with no output (the new `DATABASE_URL` field has no current consumer yet — typecheck only validates the schema syntax).

Commit:

```bash
git add apps/api/src/config/env.ts .env.example
git commit -m "feat(#4): require DATABASE_URL in apps/api env + document local supabase URL"
```

---

### Task 3 — Bootstrap the Prisma schema folder + tsconfig path alias + gitignore [AC: AC-1, AC-4]

Create the Prisma schema folder (two files), wire the TS path alias for the generated client, and gitignore the generator output. The full schema models land in Task 4 — this task sets up the skeleton.

**3a. `apps/api/prisma/schema/_base.prisma`** (new):

```prisma
// _base.prisma — datasource + generator. No models live here.
//
// `prismaSchemaFolder` enables multi-file schema (Prisma 6+).
// `driverAdapters` enables the @prisma/adapter-pg PrismaPg adapter.
// `output` emits the client to apps/api/generated/prisma so apps/api/src can
// import it via the @generated/prisma/* path alias declared in tsconfig.json.

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider        = "prisma-client-js"
  output          = "../generated/prisma"
  previewFeatures = ["prismaSchemaFolder", "driverAdapters"]
}
```

**3b. `apps/api/prisma/schema/enums.prisma`** (new):

```prisma
// enums.prisma — the four brownfield Postgres enums.
// Pekulo enum NAMES are PascalCase in TS (Prisma generated client) and bound to
// the lower-case Postgres enum names via @@map.

enum AccountType {
  livret
  pea
  cto
  av
  autre

  @@map("account_type")
}

enum HoldingKind {
  // V1 brownfield only — the 'crypto' extension is owned by story 3-1.
  etf
  action
  autre

  @@map("holding_kind")
}

enum TransactionType {
  inflow
  outflow

  @@map("transaction_type")
}

enum LotType {
  buy
  sell

  @@map("lot_type")
}
```

**3c. `apps/api/tsconfig.json`** (replace entire file):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/apps.json",
  "compilerOptions": {
    "rootDir": "src",
    "types": ["bun"],
    "paths": {
      "@generated/prisma/*": ["./generated/prisma/*"]
    }
  },
  "include": ["src/**/*.ts", "generated/prisma/**/*.ts"]
}
```

**3d. `apps/api/.gitignore`** (replace entire file):

```
node_modules/
dist/
generated/
.env.local
.env.*.local
```

Run: `(cd apps/api && bun run prisma:format)`
Expected output: contains `Formatted` for both `_base.prisma` and `enums.prisma` (or `Already formatted` on a second invocation); exit 0.

Commit:

```bash
git add apps/api/prisma/schema/_base.prisma apps/api/prisma/schema/enums.prisma apps/api/tsconfig.json apps/api/.gitignore
git commit -m "feat(#4): bootstrap prisma schema folder + tsconfig @generated alias"
```

---

### Task 4 — Declare the 5 brownfield Prisma models [AC: AC-1, AC-4]

Create the four `*.prisma` files that carry the 7 brownfield models (Account + Holding + HoldingLot share `accounts.prisma` because they are an aggregate-rooted unit). Every model maps to the brownfield snake_case table via `@@map`, every column to its snake_case DB name via `@map`, and every brownfield index/unique constraint is reproduced.

**4a. `apps/api/prisma/schema/accounts.prisma`** (new):

```prisma
// accounts.prisma — Account aggregate (Account → Holding → HoldingLot).
// Maps the three brownfield tables `accounts`, `holdings`, `holding_lots`.

model Account {
  id          String      @id
  userId      String      @map("user_id") @db.Uuid
  label       String
  type        AccountType
  currency    String      @default("EUR")
  cashBalance Decimal     @default(0) @map("cash_balance")
  notes       String?
  createdAt   DateTime?   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime?   @default(now()) @map("updated_at") @db.Timestamptz

  holdings    Holding[]

  @@map("accounts")
}

model Holding {
  id          String      @id
  userId      String      @map("user_id") @db.Uuid
  accountId   String      @map("account_id")
  kind        HoldingKind
  ticker      String?
  isin        String?
  label       String
  currency    String      @default("EUR")
  quantity    Decimal
  avgCost     Decimal     @map("avg_cost")
  lastPrice   Decimal     @default(0) @map("last_price")
  lastPriceAt DateTime?   @map("last_price_at") @db.Date
  notes       String?
  createdAt   DateTime?   @default(now()) @map("created_at") @db.Timestamptz
  updatedAt   DateTime?   @default(now()) @map("updated_at") @db.Timestamptz

  account     Account     @relation(fields: [accountId], references: [id], onDelete: Cascade)
  lots        HoldingLot[]

  @@index([userId, accountId], map: "holdings_user_account_idx")
  @@map("holdings")
}

model HoldingLot {
  id         String   @id
  userId     String   @map("user_id") @db.Uuid
  holdingId  String   @map("holding_id")
  type       LotType
  occurredOn DateTime @map("occurred_on") @db.Date
  quantity   Decimal
  priceUnit  Decimal  @map("price_unit")
  fees       Decimal  @default(0)
  notes      String?
  createdAt  DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime? @default(now()) @map("updated_at") @db.Timestamptz

  holding    Holding  @relation(fields: [holdingId], references: [id], onDelete: Cascade)

  @@index([userId, holdingId, occurredOn], map: "holding_lots_user_holding_idx")
  @@map("holding_lots")
}
```

**4b. `apps/api/prisma/schema/transactions.prisma`** (new):

```prisma
// transactions.prisma — brownfield Transaction model.

model Transaction {
  id         String          @id
  userId     String          @map("user_id") @db.Uuid
  occurredOn DateTime        @map("occurred_on") @db.Date
  label      String
  amount     Decimal
  type       TransactionType
  category   String
  isImprevu  Boolean         @default(false) @map("is_imprevu")
  notes      String?
  createdAt  DateTime?       @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime?       @default(now()) @map("updated_at") @db.Timestamptz

  @@index([userId, occurredOn(sort: Desc)], map: "transactions_user_date_idx")
  @@map("transactions")
}
```

**4c. `apps/api/prisma/schema/monthly.prisma`** (new):

```prisma
// monthly.prisma — Kpi (singleton-per-user) + MonthlyTracking (per user-month-year).

model Kpi {
  id              String    @id
  userId          String    @unique @map("user_id") @db.Uuid
  netReel         Decimal?  @default(3700) @map("net_reel")
  pouvoirAchat    Decimal?  @default(3943) @map("pouvoir_achat")
  epargneMois     Decimal?  @default(1210) @map("epargne_mois")
  capitalProjete  Decimal?  @default(145738) @map("capital_projete")
  objectif        Decimal?  @default(100000)
  createdAt       DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime? @default(now()) @map("updated_at") @db.Timestamptz

  @@map("kpis")
}

model MonthlyTracking {
  id            String   @id
  userId        String   @map("user_id") @db.Uuid
  monthNum      Int      @map("month_num")
  year          Int
  monthLabel    String   @map("month_label")
  net           Decimal
  avantages     Decimal  @default(243)
  depenses      Decimal  @default(2490)
  credit        Decimal  @default(0)
  remote        Decimal  @default(0)
  freelance     Decimal  @default(0)
  epargneMois   Decimal  @map("epargne_mois")
  perfMarche    Decimal  @default(0) @map("perf_marche")
  epargneCumul  Decimal  @map("epargne_cumul")
  capitalTotal  Decimal  @map("capital_total")
  createdAt     DateTime? @default(now()) @map("created_at") @db.Timestamptz

  @@unique([userId, monthNum, year], map: "monthly_tracking_user_id_month_num_year_key")
  @@map("monthly_tracking")
}
```

**4d. `apps/api/prisma/schema/hypothesis.prisma`** (new):

```prisma
// hypothesis.prisma — brownfield Hypothesis model. The horizon_years and objectif
// columns are reused as-is by the V1 compass per ADR-0012 + grill-summary.

model Hypothesis {
  id                    String    @id
  userId                String    @unique @map("user_id") @db.Uuid
  salaireNet            Decimal?  @default(3700) @map("salaire_net")
  ticketRestoJour       Decimal?  @default(14) @map("ticket_resto_jour")
  partEmployeurTr       Decimal?  @default(0.6) @map("part_employeur_tr")
  joursTravailles       Decimal?  @default(20) @map("jours_travailles")
  navigoCout            Decimal?  @default(90) @map("navigo_cout")
  partEmployeurNavigo   Decimal?  @default(0.5) @map("part_employeur_navigo")
  mutuelleEconomie      Decimal?  @default(30) @map("mutuelle_economie")
  loyer                 Decimal?  @default(1125)
  courses               Decimal?  @default(200)
  transport             Decimal?  @default(45)
  autresCharges         Decimal?  @default(150) @map("autres_charges")
  sorties               Decimal?  @default(250)
  divers                Decimal?  @default(120)
  voyageMois            Decimal?  @default(600) @map("voyage_mois")
  creditMensuel         Decimal?  @default(250) @map("credit_mensuel")
  dateDebutCredit       String?   @default("01/2027") @map("date_debut_credit")
  matelasCible          Decimal?  @default(10000) @map("matelas_cible")
  perfEtfAnnuelle       Decimal?  @default(0.07) @map("perf_etf_annuelle")
  augmentationSalaire   Decimal?  @default(0.03) @map("augmentation_salaire")
  partEtfMonde          Decimal?  @default(0.8) @map("part_etf_monde")
  partOpportunites      Decimal?  @default(0.2) @map("part_opportunites")
  economieRemoteMois    Decimal?  @default(1000) @map("economie_remote_mois")
  moisRemoteAn          Decimal?  @default(6) @map("mois_remote_an")
  revenuFreelanceMois   Decimal?  @default(300) @map("revenu_freelance_mois")
  horizonYears          Int       @default(5) @map("horizon_years") @db.SmallInt
  objectif              Decimal   @default(100000)
  createdAt             DateTime? @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime? @default(now()) @map("updated_at") @db.Timestamptz

  @@map("hypotheses")
}
```

Run: `(cd apps/api && bun run prisma:format && bun run prisma:validate)`
Expected output: `prisma format` reports `Formatted X files` (or all already formatted), then `prisma validate` reports `The schema at prisma/schema is valid 🚀` and exits 0.

Commit:

```bash
git add apps/api/prisma/schema/accounts.prisma apps/api/prisma/schema/transactions.prisma apps/api/prisma/schema/monthly.prisma apps/api/prisma/schema/hypothesis.prisma
git commit -m "feat(#4): declare 7 brownfield Prisma models with @@map + @map preserved"
```

---

### Task 5 — `id-prefixes.config.ts` registry + uniqueness test [AC: AC-2, AC-6]

The registry covers all 14 models from ADR-0012, including future ones not yet in the schema. The extension throws on lookup miss, so any future Prisma `create` against an unregistered model surfaces a clear error.

**5a. `apps/api/src/database/id-prefixes.config.ts`** (new):

```ts
// id-prefixes.config.ts — single source of truth for Pekulo prefixed IDs.
//
// Per ADR-0012 the registry is pre-populated for every Pekulo model — including
// future ones not yet declared in the schema folder. This guarantees every Prisma
// `create` either lands in a registered prefix or throws a clear MissingPrefixError,
// preventing prefix drift across stories.
//
// `User` carries no prefix (managed by Supabase Auth, native UUID).

export const ID_PREFIXES = {
  // Account aggregate (story 0-4 — this story)
  Account: "acc",
  Holding: "hld",
  HoldingLot: "lot",

  // Transactions (story 0-4)
  Transaction: "tx",

  // Monthly + KPI (story 0-4)
  Kpi: "kpi",
  MonthlyTracking: "mtr",

  // Hypothesis (story 0-4)
  Hypothesis: "hyp",

  // Compass + Milestones (story 1-1, 1-2 — registered upfront)
  CompassHistory: "cph",
  Milestone: "mst",

  // Real-estate (story 4-1, 4-2 — registered upfront)
  RealEstate: "res",
  RealEstateRental: "resr",
  RealEstateValuation: "resv",

  // LLM (story 6-1 — registered upfront)
  LlmCallLog: "llm",
  LlmOptIn: "llmo",
} as const satisfies Record<string, string>;

export type ModelName = keyof typeof ID_PREFIXES;
export type Prefix = (typeof ID_PREFIXES)[ModelName];

export class MissingPrefixError extends Error {
  override readonly name = "MissingPrefixError";
  readonly model: string;
  constructor(model: string) {
    super(`[prefixed-ids] no prefix registered for model "${model}" — register it in apps/api/src/database/id-prefixes.config.ts`);
    this.model = model;
  }
}

export function getPrefix(model: string): Prefix {
  if (model in ID_PREFIXES) {
    return ID_PREFIXES[model as ModelName];
  }
  throw new MissingPrefixError(model);
}
```

**5b. `apps/api/src/database/id-prefixes.config.test.ts`** (new):

```ts
import { describe, expect, it } from "bun:test";
import { ID_PREFIXES, MissingPrefixError, getPrefix } from "./id-prefixes.config";

describe("id-prefixes.config", () => {
  it("exposes exactly 14 model entries (ADR-0012)", () => {
    expect(Object.keys(ID_PREFIXES)).toHaveLength(14);
  });

  it("every prefix matches /^[a-z]{2,4}$/", () => {
    for (const [model, prefix] of Object.entries(ID_PREFIXES)) {
      expect(prefix, `prefix for ${model}`).toMatch(/^[a-z]{2,4}$/);
    }
  });

  it("every prefix is unique across the registry", () => {
    const values = Object.values(ID_PREFIXES);
    expect(new Set(values).size, "duplicate prefix in ID_PREFIXES").toBe(values.length);
  });

  it("contains the expected ADR-0012 keys", () => {
    const expected = [
      "Account",
      "Holding",
      "HoldingLot",
      "Transaction",
      "Kpi",
      "MonthlyTracking",
      "Hypothesis",
      "CompassHistory",
      "Milestone",
      "RealEstate",
      "RealEstateRental",
      "RealEstateValuation",
      "LlmCallLog",
      "LlmOptIn",
    ].sort();
    expect(Object.keys(ID_PREFIXES).sort()).toEqual(expected);
  });

  it("getPrefix returns the registered prefix for a known model", () => {
    expect(getPrefix("Account")).toBe("acc");
    expect(getPrefix("HoldingLot")).toBe("lot");
    expect(getPrefix("LlmOptIn")).toBe("llmo");
  });

  it("getPrefix throws MissingPrefixError on an unknown model", () => {
    expect(() => getPrefix("FakeModel")).toThrow(MissingPrefixError);
    expect(() => getPrefix("FakeModel")).toThrow(/FakeModel/);
  });
});
```

Run: `(cd apps/api && bun test src/database/id-prefixes.config.test.ts)`
Expected output: `6 pass`, `0 fail`, exit 0.

Commit:

```bash
git add apps/api/src/database/id-prefixes.config.ts apps/api/src/database/id-prefixes.config.test.ts
git commit -m "feat(#4): register 14 Pekulo ID prefixes with uniqueness + format invariants"
```

---

### Task 6 — `base62.ts` helper + `prefixed-ids.injector.ts` pure helper + their tests [AC: AC-2]

Two pure modules tested in isolation. The Prisma extension wiring lands in Task 7 — keeping the logic pure here means the test suite never needs a real DB.

**6a. `apps/api/src/database/base62.ts`** (new):

```ts
// base62.ts — random base62 string for prefixed IDs.
//
// 21 chars × log2(62) ≈ 125 bits of entropy. Modulo bias on `byte % 62` is
// negligible for ID purposes (slight overrepresentation of the first 8 chars
// of the alphabet by a factor of 5/4 vs the last 54). Acceptable trade-off
// vs rejection sampling for non-cryptographic ID generation.

const BASE62_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function generateBase62Id(length: number): string {
  if (length <= 0) {
    throw new RangeError(`generateBase62Id: length must be positive, got ${length}`);
  }
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let id = "";
  for (let i = 0; i < length; i++) {
    id += BASE62_ALPHABET[bytes[i]! % 62];
  }
  return id;
}
```

**6b. `apps/api/src/database/base62.test.ts`** (new):

```ts
import { describe, expect, it } from "bun:test";
import { generateBase62Id } from "./base62";

describe("generateBase62Id", () => {
  it("returns a string of the requested length", () => {
    expect(generateBase62Id(21)).toHaveLength(21);
    expect(generateBase62Id(8)).toHaveLength(8);
    expect(generateBase62Id(1)).toHaveLength(1);
  });

  it("emits only base62 characters", () => {
    const id = generateBase62Id(100);
    expect(id).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("two consecutive calls return different IDs (probabilistic)", () => {
    const a = generateBase62Id(21);
    const b = generateBase62Id(21);
    expect(a).not.toBe(b);
  });

  it("throws RangeError on non-positive length", () => {
    expect(() => generateBase62Id(0)).toThrow(RangeError);
    expect(() => generateBase62Id(-1)).toThrow(RangeError);
  });
});
```

**6c. `apps/api/src/database/prefixed-ids.injector.ts`** (new):

```ts
// prefixed-ids.injector.ts — pure logic the Prisma extension delegates to.
//
// Given a Prisma model name and the `data` argument of a create/createMany/upsert
// op, this helper:
//   - returns `data` unchanged if `data.id` is already set (idempotence);
//   - throws MissingPrefixError if the model has no entry in ID_PREFIXES;
//   - otherwise returns a new object with id = `${prefix}_${base62(21)}`.
//
// The function is pure (no I/O, no Prisma import) — it is unit-testable without
// a database. The Prisma extension wrapper in `prefixed-ids.extension.ts` is the
// integration glue that calls this helper inside `query.$allModels.create` etc.

import { ID_PREFIXES, MissingPrefixError, type ModelName } from "./id-prefixes.config";
import { generateBase62Id } from "./base62";

export { MissingPrefixError };

export function injectPrefixedId<T extends { id?: unknown }>(model: string, data: T): T {
  if (data.id !== undefined && data.id !== null) {
    return data;
  }
  if (!(model in ID_PREFIXES)) {
    throw new MissingPrefixError(model);
  }
  const prefix = ID_PREFIXES[model as ModelName];
  return { ...data, id: `${prefix}_${generateBase62Id(21)}` };
}
```

**6d. `apps/api/src/database/prefixed-ids.injector.test.ts`** (new):

```ts
import { describe, expect, it } from "bun:test";
import { MissingPrefixError, injectPrefixedId } from "./prefixed-ids.injector";

describe("injectPrefixedId", () => {
  it("injects a prefixed id when data.id is undefined (Account → acc_…)", () => {
    const out = injectPrefixedId("Account", { userId: "u" });
    expect(out).toMatchObject({ userId: "u" });
    expect((out as { id: string }).id).toMatch(/^acc_[0-9A-Za-z]{21}$/);
  });

  it("returns data unchanged when data.id is already set (idempotence)", () => {
    const data = { id: "explicit_id", userId: "u" };
    const out = injectPrefixedId("Account", data);
    expect(out).toBe(data);
    expect(out.id).toBe("explicit_id");
  });

  it("throws MissingPrefixError when the model is not registered", () => {
    expect(() => injectPrefixedId("FakeModel", {})).toThrow(MissingPrefixError);
    expect(() => injectPrefixedId("FakeModel", {})).toThrow(/FakeModel/);
  });

  it("uses the right prefix for a second model (Holding → hld_…)", () => {
    const out = injectPrefixedId("Holding", {});
    expect((out as { id: string }).id).toMatch(/^hld_[0-9A-Za-z]{21}$/);
  });

  it("treats null id like undefined (Prisma may pass either)", () => {
    const out = injectPrefixedId("Transaction", { id: null });
    expect((out as { id: string }).id).toMatch(/^tx_[0-9A-Za-z]{21}$/);
  });
});
```

Run: `(cd apps/api && bun test src/database/base62.test.ts src/database/prefixed-ids.injector.test.ts)`
Expected output: `9 pass`, `0 fail`, exit 0.

Commit:

```bash
git add apps/api/src/database/base62.ts apps/api/src/database/base62.test.ts apps/api/src/database/prefixed-ids.injector.ts apps/api/src/database/prefixed-ids.injector.test.ts
git commit -m "feat(#4): add base62 helper + pure prefixed-ids injector with 9 tests"
```

---

### Task 7 — `prefixed-ids.extension.ts` + `prisma.service.ts` + replace `database/index.ts` [AC: AC-1, AC-4]

Wire the pure injector into a `Prisma.defineExtension` and construct the extended Prisma client. Generate the client first so the imports resolve.

**7a. Generate the Prisma client** (one-shot before writing the integration files — gives `tsc` the types to validate against):

Run: `(cd apps/api && bun run prisma:generate)`
Expected output: `✔ Generated Prisma Client (v7.8.0) to ./generated/prisma in <N>ms` (or similar Prisma success line); exit 0. The directory `apps/api/generated/prisma/` now exists with the client. No commit yet — the generated dir is gitignored.

**7b. `apps/api/src/database/prefixed-ids.extension.ts`** (new):

```ts
// prefixed-ids.extension.ts — Prisma extension wiring the pure injector.
//
// `query.$allModels.{create, createMany, createManyAndReturn, upsert}` is the
// minimum surface that produces new rows. `update`/`delete`/`findX` ops never
// generate IDs, so they pass through untouched. `upsert.create` is the implicit
// branch when no row matches `where`.

import { Prisma } from "@generated/prisma/client";
import { injectPrefixedId } from "./prefixed-ids.injector";

export const prefixedIdsExtension = Prisma.defineExtension({
  name: "pekulo-prefixed-ids",
  query: {
    $allModels: {
      async create({ model, args, query }) {
        args.data = injectPrefixedId(model, args.data as Record<string, unknown>);
        return query(args);
      },
      async createMany({ model, args, query }) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((row) => injectPrefixedId(model, row as Record<string, unknown>));
        } else {
          args.data = injectPrefixedId(model, args.data as Record<string, unknown>);
        }
        return query(args);
      },
      async createManyAndReturn({ model, args, query }) {
        if (Array.isArray(args.data)) {
          args.data = args.data.map((row) => injectPrefixedId(model, row as Record<string, unknown>));
        } else {
          args.data = injectPrefixedId(model, args.data as Record<string, unknown>);
        }
        return query(args);
      },
      async upsert({ model, args, query }) {
        args.create = injectPrefixedId(model, args.create as Record<string, unknown>);
        return query(args);
      },
    },
  },
});
```

**7c. `apps/api/src/database/prisma.service.ts`** (new):

```ts
// prisma.service.ts — Prisma 7.8 client with PrismaPg driver adapter + extension chain.
//
// Per ADR-0012:
//   - Direct connection on port 5432 (apps/api is a long-running Bun process on Dokploy)
//   - PrismaPg adapter from @prisma/adapter-pg
//   - prefixed-ids extension as the only extension at V1 (a)
//
// The exported PrismaService type is the *extended* client returned by `$extends`.
// Domain repositories in epics 1–8 import this type and depend on the extended shape.

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@generated/prisma/client";
import { prefixedIdsExtension } from "./prefixed-ids.extension";

function createExtendedClient(databaseUrl: string) {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const base = new PrismaClient({ adapter });
  return base.$extends(prefixedIdsExtension);
}

export type PrismaService = ReturnType<typeof createExtendedClient> & {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
};

export function createPrismaService(input: { databaseUrl: string }): PrismaService {
  const extended = createExtendedClient(input.databaseUrl);
  // The extended client exposes $connect / $disconnect on its inner symbol.
  // Wrap in connect/disconnect for ergonomic bootstrap usage.
  const service = extended as unknown as PrismaService;
  service.connect = () => (extended as unknown as { $connect: () => Promise<void> }).$connect();
  service.disconnect = () => (extended as unknown as { $disconnect: () => Promise<void> }).$disconnect();
  return service;
}
```

**7d. `apps/api/src/database/index.ts`** (replace entire file):

```ts
// database/ — Prisma client + extensions + ID conventions.
// See ADR-0012 (prefixed IDs) + ADR-0014 (Prisma migrate, supersedes ADR-0006).
//
// Story 0-5 will add prisma-error-mapper.ts re-exports here (P2025 → RlsViolationError).
// Do NOT pre-bake those exports.

export { createPrismaService, type PrismaService } from "./prisma.service";
export { ID_PREFIXES, getPrefix, MissingPrefixError, type ModelName, type Prefix } from "./id-prefixes.config";
export { generateBase62Id } from "./base62";
export { injectPrefixedId } from "./prefixed-ids.injector";
export { prefixedIdsExtension } from "./prefixed-ids.extension";
```

Run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 with no output. (If `@generated/prisma/client` cannot be resolved, re-run `bun run prisma:generate` from Task 7a — the alias is set in tsconfig but the dir must exist.)

Commit:

```bash
git add apps/api/src/database/prefixed-ids.extension.ts apps/api/src/database/prisma.service.ts apps/api/src/database/index.ts
git commit -m "feat(#4): wire PrismaPg adapter + prefixed-ids extension in prisma.service"
```

---

### Task 8 — Wire `PrismaService` into bootstrap (runtime-deps + readiness probe + lifecycle disconnect) [AC: AC-1, AC-4]

Three file edits — all in `apps/api/src/bootstrap/` — that lift the new `PrismaService` from "constructible" to "live, ready-checked, cleanly-disconnected".

**8a. `apps/api/src/bootstrap/runtime-dependencies.ts`** (replace entire file):

```ts
import type { Env } from "../config/env";
import { createPrismaService, type PrismaService } from "../database";
import { createReadiness, type Readiness } from "./readiness";

export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
  prismaService: PrismaService;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  const prismaService = createPrismaService({ databaseUrl: input.env.DATABASE_URL });

  readiness.register("prisma", async () => {
    try {
      await prismaService.$queryRaw`SELECT 1`;
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : String(err) };
    }
  });

  return { env: input.env, readiness, prismaService };
}
```

**8b. `apps/api/src/bootstrap/lifecycle.ts`** (replace entire file):

```ts
import type { AnyElysia } from "elysia";
import type { PrismaService } from "../database";

export interface LifecycleOptions {
  shutdownTimeoutMs: number;
}

export interface LifecycleDeps {
  prismaService: PrismaService;
}

export async function registerLifecycle(
  app: AnyElysia,
  options: LifecycleOptions,
  deps: LifecycleDeps,
): Promise<void> {
  const onShutdown = async (signal: NodeJS.Signals) => {
    console.log(`[api] received ${signal}, shutting down`);
    let exitCode = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), options.shutdownTimeoutMs);
      });
      const outcome = await Promise.race([app.stop().then(() => "stopped" as const), timeout]);
      if (outcome === "timeout") {
        console.error(`[api] shutdown timed out after ${options.shutdownTimeoutMs}ms`);
        exitCode = 1;
      }
      // Drain Prisma connection pool AFTER Elysia stops accepting new requests.
      await deps.prismaService.disconnect();
    } catch (err) {
      console.error("[api] error during shutdown:", err);
      exitCode = 1;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      process.exit(exitCode);
    }
  };
  process.once("SIGTERM", () => void onShutdown("SIGTERM"));
  process.once("SIGINT", () => void onShutdown("SIGINT"));
}
```

**8c. Locate the call site of `registerLifecycle` in `apps/api/src/main.ts` or `apps/api/src/app.ts`** (whichever wires the lifecycle — the 0-3 story put it in `main.ts`). The new `deps` parameter must receive `{ prismaService: runtimeDeps.prismaService }`. **Do NOT** reproduce a diff here — read the current call site, find the existing two-arg call, and add the third arg. The dev MUST grep first:

Run: `grep -n "registerLifecycle" apps/api/src/main.ts apps/api/src/app.ts`
Expected output: at least one line of the form `registerLifecycle(app, ...)` — patch that call to pass `{ prismaService: runtimeDeps.prismaService }` as the third argument.

After patching the call site, run: `(cd apps/api && bun run typecheck)`
Expected output: `tsc --noEmit` exits 0 with no output. If TS reports `Expected 3 arguments, got 2`, the call site has not been patched — re-grep and fix.

Commit:

```bash
git add apps/api/src/bootstrap/runtime-dependencies.ts apps/api/src/bootstrap/lifecycle.ts apps/api/src/main.ts apps/api/src/app.ts
git commit -m "feat(#4): wire prismaService into runtime-deps + lifecycle disconnect + readiness probe"
```

> If the grep shows `registerLifecycle` is called from only one of `main.ts` / `app.ts`, omit the other from the `git add` line. The commit description stays accurate either way.

---

### Task 9 — Generate baseline migration + append RLS policy DDL + apply against local Supabase [AC: AC-1, AC-3]

Three sub-steps. The first generates the Prisma-managed half of the SQL, the second appends the brownfield RLS DDL by hand, the third proves the result by deploying to a freshly-started local Supabase Postgres.

**9a. Pre-flight: ensure local Supabase is running.** This is a precondition for AC-1, not a write step. Run:

```bash
(cd apps/web && bunx supabase start)
```

Expected output: a multi-line summary ending with `Started supabase local development setup.` and an `API URL: http://127.0.0.1:54321` / `DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres` block. If the dev already has it running, the command reports `supabase local development setup is already running.` — also OK.

Then create `apps/api/.env.local` with the single line:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Verify connectivity (precondition for the Prisma steps below):

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1 AS up"
```

Expected: a single-row result `up=1`. If the command fails, the Supabase stack is not actually up — re-check `(cd apps/web && bunx supabase status)`.

**9b. Generate the migration directory + Prisma-managed SQL.** Prisma 7 expects `migrations/migration_lock.toml` adjacent to the migration directories. Create both:

```bash
mkdir -p apps/api/prisma/migrations/0_baseline_brownfield
```

Write `apps/api/prisma/migrations/migration_lock.toml` (new):

```toml
# Please do not edit this file manually
# It should be added in your version-control system (e.g., Git)
provider = "postgresql"
```

Then generate the Prisma half of the baseline SQL:

```bash
(cd apps/api && bunx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel ./prisma/schema \
  --script > prisma/migrations/0_baseline_brownfield/migration.sql)
```

Expected output: nothing on stdout (the `--script` flag writes to the redirected file); exit 0. Open `apps/api/prisma/migrations/0_baseline_brownfield/migration.sql` and verify it contains `CREATE TYPE "account_type" ...`, `CREATE TABLE "accounts" ...`, and the four enums. The file is the **Prisma-managed half** — no RLS, no `alter table ... enable row level security`, no policies (Prisma does not introspect those).

**9c. Append the brownfield RLS DDL to the same migration file.** Append the block below to `apps/api/prisma/migrations/0_baseline_brownfield/migration.sql` (after the Prisma-generated DDL — preserve everything Prisma wrote, then add this verbatim):

```sql

-- ============================================================
-- RLS policies (manually appended — Prisma does not introspect Postgres policies)
-- The 3-vs-4 split is preserved verbatim from apps/web/supabase-schema.sql:
--   - kpis / monthly_tracking / hypotheses ship without DELETE policies
--   - transactions / accounts / holdings / holding_lots have the full quartet
-- ============================================================

ALTER TABLE "kpis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hypotheses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holdings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "holding_lots" ENABLE ROW LEVEL SECURITY;

-- kpis (3 policies — no DELETE)
CREATE POLICY "Users can view their own KPIs" ON "kpis"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KPIs" ON "kpis"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KPIs" ON "kpis"
  FOR UPDATE USING (auth.uid() = user_id);

-- monthly_tracking (3 policies — no DELETE)
CREATE POLICY "Users can view their own tracking" ON "monthly_tracking"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own tracking" ON "monthly_tracking"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tracking" ON "monthly_tracking"
  FOR UPDATE USING (auth.uid() = user_id);

-- hypotheses (3 policies — no DELETE)
CREATE POLICY "Users can view their own hypotheses" ON "hypotheses"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own hypotheses" ON "hypotheses"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own hypotheses" ON "hypotheses"
  FOR UPDATE USING (auth.uid() = user_id);

-- transactions (4 policies)
CREATE POLICY "Users can view their own transactions" ON "transactions"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own transactions" ON "transactions"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own transactions" ON "transactions"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own transactions" ON "transactions"
  FOR DELETE USING (auth.uid() = user_id);

-- accounts (4 policies)
CREATE POLICY "Users can view their own accounts" ON "accounts"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own accounts" ON "accounts"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own accounts" ON "accounts"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own accounts" ON "accounts"
  FOR DELETE USING (auth.uid() = user_id);

-- holdings (4 policies)
CREATE POLICY "Users can view their own holdings" ON "holdings"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own holdings" ON "holdings"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own holdings" ON "holdings"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own holdings" ON "holdings"
  FOR DELETE USING (auth.uid() = user_id);

-- holding_lots (4 policies)
CREATE POLICY "Users can view their own lots" ON "holding_lots"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lots" ON "holding_lots"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lots" ON "holding_lots"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own lots" ON "holding_lots"
  FOR DELETE USING (auth.uid() = user_id);

-- FK to auth.users for ON DELETE CASCADE behaviour (re-asserted after Prisma's
-- table creation; Prisma 7 cannot model cross-schema FKs to the supabase auth
-- schema natively, so we rebuild them here).
ALTER TABLE "kpis"             ADD CONSTRAINT "kpis_user_id_fkey"             FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "monthly_tracking" ADD CONSTRAINT "monthly_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "hypotheses"       ADD CONSTRAINT "hypotheses_user_id_fkey"       FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "transactions"     ADD CONSTRAINT "transactions_user_id_fkey"     FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "accounts"         ADD CONSTRAINT "accounts_user_id_fkey"         FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "holdings"         ADD CONSTRAINT "holdings_user_id_fkey"         FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE "holding_lots"     ADD CONSTRAINT "holding_lots_user_id_fkey"     FOREIGN KEY ("user_id") REFERENCES auth.users(id) ON DELETE CASCADE;
```

**9d. Apply the baseline against the local Supabase Postgres.** The local DB started in 9a is empty (no `public.*` tables). The brownfield SQL file in `apps/web/supabase-schema.sql` was historically run against the remote Supabase project; the local dev DB has only the `auth` schema. So `prisma migrate deploy` is the first thing that creates the `public.*` tables locally:

```bash
(cd apps/api && bun run prisma:migrate:deploy)
```

Expected output: contains `Applying migration \`0_baseline_brownfield\``, then `The following migration(s) have been applied:`, then `0_baseline_brownfield`, then `All migrations have been successfully applied.`; exit 0.

Verify status:

```bash
(cd apps/api && bun run prisma:migrate:status)
```

Expected output: contains `Database schema is up to date!` AND a line listing `0_baseline_brownfield` as applied; exit 0.

Spot-check that the tables + policies actually landed:

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename"
```

Expected output: a 7-row table where every `rowsecurity` cell is `t` (true). Tables in order: `accounts`, `holding_lots`, `holdings`, `hypotheses`, `kpis`, `monthly_tracking`, `transactions`.

Commit:

```bash
git add apps/api/prisma/migrations
git commit -m "feat(#4): collapse brownfield supabase-schema.sql into 0_baseline_brownfield migration"
```

> The migration directory and the `migration_lock.toml` are committed. The directory `apps/api/prisma/migrations/` was new at the start of this task.

---

### Task 10 — `rls-audit` script + Dockerfile prisma-generate step + README onboarding [AC: AC-3, AC-5]

Three small artefacts that close out the story: an audit probe, a deployable container image, and an onboarding doc.

**10a. `apps/api/scripts/rls-audit.ts`** (new):

```ts
// rls-audit.ts — CLI probe that asserts brownfield RLS coverage.
//
// Connects to DATABASE_URL via `pg`, queries pg_tables + pg_policies for the
// 7 brownfield tables, and reports either OK (all RLS-enabled with the expected
// policy counts) or a diff. Exit 0 on success, 1 on drift.
//
// Usage: `bun run scripts/rls-audit.ts`
//        (registered as `db:rls-audit` script in package.json)
//
// Story 0-8 will lift this into a CI job; the V1 (a) personal-use version lives
// here to prove AC-3 of story 0-4.

import { Client } from "pg";
import { loadEnv } from "../src/config/env";

const EXPECTED_POLICY_COUNTS: Record<string, number> = {
  kpis: 3,
  monthly_tracking: 3,
  hypotheses: 3,
  transactions: 4,
  accounts: 4,
  holdings: 4,
  holding_lots: 4,
};

async function main(): Promise<number> {
  const env = loadEnv();
  const client = new Client({ connectionString: env.DATABASE_URL });
  await client.connect();
  try {
    const tableNames = Object.keys(EXPECTED_POLICY_COUNTS);
    const tables = await client.query<{ tablename: string; rowsecurity: boolean }>(
      `SELECT tablename, rowsecurity FROM pg_tables
       WHERE schemaname = 'public' AND tablename = ANY($1::text[])
       ORDER BY tablename`,
      [tableNames],
    );
    const policies = await client.query<{ tablename: string; count: string }>(
      `SELECT tablename, COUNT(*)::text AS count FROM pg_policies
       WHERE schemaname = 'public' AND tablename = ANY($1::text[])
       GROUP BY tablename
       ORDER BY tablename`,
      [tableNames],
    );

    const tablesByName = new Map(tables.rows.map((r) => [r.tablename, r.rowsecurity]));
    const policiesByName = new Map(policies.rows.map((r) => [r.tablename, Number(r.count)]));

    const drift: string[] = [];
    const summary: string[] = [];
    for (const table of tableNames) {
      const rls = tablesByName.get(table);
      const count = policiesByName.get(table) ?? 0;
      const expected = EXPECTED_POLICY_COUNTS[table]!;
      if (rls === undefined) {
        drift.push(`  ${table}: MISSING (table not found in public schema)`);
      } else if (rls !== true) {
        drift.push(`  ${table}: RLS DISABLED (rowsecurity=false)`);
      } else if (count !== expected) {
        drift.push(`  ${table}: ${count} policies (expected ${expected})`);
      } else {
        summary.push(`${table} (${count} policies)`);
      }
    }

    if (drift.length > 0) {
      console.error("[rls-audit] DRIFT:");
      for (const line of drift) console.error(line);
      return 1;
    }
    console.log(`[rls-audit] OK — ${tableNames.length} tables checked: ${summary.join(", ")}`);
    return 0;
  } finally {
    await client.end();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[rls-audit] error:", err);
    process.exit(1);
  });
```

Run (precondition: Task 9d already deployed the baseline):

```bash
(cd apps/api && bun run db:rls-audit)
```

Expected output: `[rls-audit] OK — 7 tables checked: accounts (4 policies), holding_lots (4 policies), holdings (4 policies), hypotheses (3 policies), kpis (3 policies), monthly_tracking (3 policies), transactions (4 policies)` ; exit 0.

**10b. `apps/api/Dockerfile`** (replace entire file):

```dockerfile
# syntax=docker/dockerfile:1.7
FROM oven/bun:1.3.13-slim

WORKDIR /app

# Install ca-certificates + curl for HEALTHCHECK + outbound TLS to Supabase / Ollama.
# `openssl` is required by Prisma's query engine on debian-slim.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy lockfile + ALL workspace manifests for cache-friendly frozen install.
# `bun install --frozen-lockfile` requires every workspace member declared in the
# root `workspaces` glob to have its package.json present, otherwise Bun reports
# "lockfile had changes" and aborts. apps/prices has no package.json (Python
# workspace, ignored by Bun's glob). Lesson 2026-05-04 (L1) — load-bearing.
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages packages

# Install ALL workspace deps (Bun resolves @pekulo/* via workspace:* protocol).
RUN bun install --frozen-lockfile

# Copy Prisma schema BEFORE generate so the generator can read it.
COPY apps/api/prisma apps/api/prisma

# Generate the Prisma client into apps/api/generated/prisma (gitignored locally,
# baked into the image here so the runtime never calls `prisma generate` itself).
RUN cd apps/api && bunx prisma generate

# Copy app sources.
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
EXPOSE 3001

WORKDIR /app/apps/api

# Drop privileges. `oven/bun:slim` ships a non-root `bun` user (uid=1000).
# chown is run as root before the USER switch so the runtime can read installed
# deps + the generated Prisma client.
RUN chown -R bun:bun /app
USER bun

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3001/health || exit 1

CMD ["bun", "src/main.ts"]
```

**10c. `apps/api/.dockerignore`** (replace entire file — current 0-3 file is short; reproducing it with the `generated/` exclude added):

```
**/node_modules
**/.git
**/.turbo
**/dist
**/.env
**/.env.local
**/.env.*.local
apps/api/generated/
apps/web
!apps/web/package.json
apps/prices
docs
.aped
```

**10d. `apps/api/README.md`** (replace entire file — assuming 0-3 wrote a baseline; if not, this is the first version):

```markdown
# @pekulo/api

Pekulo's domain API — Bun + Elysia + oRPC + Prisma 7.8 + PrismaPg adapter on Postgres.
See [ADR-0009](../../docs/adr/0009-elysia-orpc-with-zapaction-bridge.md) and [ADR-0012](../../docs/adr/0012-prisma-7-schema-folder-prefixed-ids.md).

## Onboarding

### 1. Install deps

```bash
bun install
```

### 2. Start the local Postgres (Supabase CLI)

The local dev DB is a Docker-backed Supabase Postgres on `127.0.0.1:54322`. It
ships the `auth` schema (`auth.users` + `auth.uid()`) the brownfield RLS DDL
references — no separate Postgres install is needed.

```bash
(cd apps/web && bunx supabase start)
```

### 3. Configure `apps/api/.env.local`

Create the file with this single line (gitignored):

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 4. Generate the Prisma client + apply migrations

```bash
(cd apps/api && bun run prisma:generate)
(cd apps/api && bun run prisma:migrate:deploy)
```

### 5. Verify RLS coverage

```bash
(cd apps/api && bun run db:rls-audit)
```

Expected: `[rls-audit] OK — 7 tables checked: …`.

### 6. Start the dev server

```bash
(cd apps/api && bun run dev)
```

Then `curl -fsS http://127.0.0.1:3001/health` — expected `{"status":"ok"}`.

## Day-to-day commands

| Command | What it does |
|---------|--------------|
| `bun run dev`                  | Hot-reload dev server (`bun --hot src/main.ts`). |
| `bun run typecheck`            | `tsc --noEmit` — strict TS pass. |
| `bun run prisma:generate`      | Regenerate the Prisma client into `apps/api/generated/prisma/`. |
| `bun run prisma:migrate:dev`   | Author a new migration locally — runs `prisma migrate dev`. |
| `bun run prisma:migrate:deploy`| Apply pending migrations to `DATABASE_URL` (production-safe). |
| `bun run prisma:format`        | Format every `*.prisma` file. |
| `bun run prisma:validate`      | Validate the schema folder. |
| `bun run db:rls-audit`         | Probe the deployed schema for RLS coverage on the 7 brownfield tables. |

## Schema migrations (ADR-0014)

- Forward-only. Reversal is a new forward migration.
- Every new user-scoped table includes 4 RLS policies appended manually to the migration SQL (Prisma does not introspect Postgres policies).
- Audit tables (future: `compass_history`, `real_estate_valuations`, `llm_call_log`) include only INSERT + SELECT policies (append-only enforcement).
- `prisma:migrate:deploy` runs in the Dokploy deploy hook; never `migrate dev` outside development.
```

Run (Docker build + container `/health` smoke):

```bash
docker build -f apps/api/Dockerfile -t pekulo-api:dev .
docker run --rm -d -p 3001:3001 --name pekulo-api-test pekulo-api:dev
sleep 8
curl -fsS http://127.0.0.1:3001/health
docker logs pekulo-api-test 2>&1 | grep -i 'generated prisma client'
docker stop pekulo-api-test
```

Expected output: build log contains `✔ Generated Prisma Client (v7.8.0)` ; `curl` returns `{"status":"ok"}` ; the `docker logs … grep` line confirms the generate step ran during build (the line is captured from the `RUN cd apps/api && bunx prisma generate` step's stdout). The container is then stopped.

> **AC-5 note:** the container will fail readiness if `DATABASE_URL` is not set (the Prisma readiness probe will report `ok: false`). For this story's `/health` smoke, `/health` is a Liveness probe that does NOT touch Prisma — the bootstrap completes, Elysia binds, and the container is "alive" even without a DB. AC-5 only asserts `/health` returns 200 — it does NOT require `/ready` to pass without DB env. The full `/ready`-against-DB test happens in AC-1 with the local Supabase running.

Commit:

```bash
git add apps/api/scripts/rls-audit.ts apps/api/Dockerfile apps/api/.dockerignore apps/api/README.md apps/api/package.json
git commit -m "feat(#4): rls-audit script + Dockerfile prisma generate + README onboarding"
```

> If `apps/api/package.json` already received the `db:rls-audit` script in Task 1, drop it from the `git add` line above.

---

## Definition of Done

- [x] All 6 ACs satisfied — verified by the literal `Run` / `Expected output` blocks in Tasks 1–10.
- [x] All 10 tasks committed on `feat/0-4-prisma-setup` with the `feat(#4): ...` prefix.
- [x] `(cd apps/api && bun run typecheck)` exits 0.
- [x] `(cd apps/api && bun test)` runs the three new test files (id-prefixes.config, base62, prefixed-ids.injector) and reports the expected pass counts (6 + 4 + 5 = 15 pass total).
- [x] `(cd apps/api && bun run prisma:format && bun run prisma:validate)` both exit 0.
- [x] `(cd apps/api && bun run prisma:migrate:status)` reports the baseline as applied against the local Supabase Postgres.
- [x] `(cd apps/api && bun run db:rls-audit)` reports OK on all 7 tables.
- [x] `docker build` succeeds and the resulting image responds 200 on `/health`.
- [x] `docs/state.yaml` shows `sprint.stories.0-4-prisma-setup.status: review-queued` after the dev hands off.

---

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-04T10:00:00Z
- **Completed:** 2026-05-04T11:30:00Z

### Implementation summary

All 10 tasks shipped in 10 commits on `feat/0-4-prisma-setup`. The Prisma 7.8 data layer is wired end-to-end: schema folder with 7 brownfield models + 4 enums, prefixed-IDs Trafi extension (14-entry registry, 15 unit tests), `PrismaPg` driver adapter inside `prisma.service.ts`, baseline migration `0_baseline_brownfield` applied against the local Supabase Postgres with the manual RLS DDL appended, the `rls-audit` script reporting OK on the expected 3-vs-4 policy split, and the Docker image builds with `prisma generate` and serves `/health` 200.

### Files changed (15 created, 7 modified)

```
A  apps/api/prisma.config.ts
A  apps/api/prisma/migrations/migration_lock.toml
A  apps/api/prisma/migrations/0_baseline_brownfield/migration.sql
A  apps/api/prisma/schema/_base.prisma
A  apps/api/prisma/schema/enums.prisma
A  apps/api/prisma/schema/accounts.prisma
A  apps/api/prisma/schema/transactions.prisma
A  apps/api/prisma/schema/monthly.prisma
A  apps/api/prisma/schema/hypothesis.prisma
A  apps/api/scripts/rls-audit.ts
A  apps/api/src/database/id-prefixes.config.ts
A  apps/api/src/database/id-prefixes.config.test.ts
A  apps/api/src/database/base62.ts
A  apps/api/src/database/base62.test.ts
A  apps/api/src/database/prefixed-ids.injector.ts
A  apps/api/src/database/prefixed-ids.injector.test.ts
A  apps/api/src/database/prefixed-ids.extension.ts
A  apps/api/src/database/prisma.service.ts
M  apps/api/src/database/index.ts                        (placeholder → re-exports)
M  apps/api/src/bootstrap/runtime-dependencies.ts        (+prismaService + readiness probe)
M  apps/api/src/bootstrap/lifecycle.ts                   (+deps param + Prisma disconnect)
M  apps/api/src/app.ts                                   (registerLifecycle 3rd arg)
M  apps/api/src/config/env.ts                            (+DATABASE_URL)
M  apps/api/package.json                                 (+5 deps, +7 scripts)
M  apps/api/tsconfig.json                                (+@generated/prisma alias)
M  apps/api/.gitignore                                   (+generated/)
M  apps/api/.dockerignore                                (+apps/api/generated/)
M  apps/api/Dockerfile                                   (+prisma config + generate step)
M  apps/api/README.md                                    (+Database setup section)
M  .env.example                                          (+DATABASE_URL block)
M  bun.lock
A  docs/epic-0-context.md                                (Epic 0 context cache compiled by aped-dev step 04, reused by stories 0-5..0-12)
```

### Deviations from the original plan

1. **Prisma 7.8 config layout.** The story was drafted assuming the `package.json#prisma` block + `datasource db { url = env("DATABASE_URL") }`. Prisma 7 rejects the inline URL with `P1012` and requires `prisma.config.ts` instead, with `previewFeatures = ["prismaSchemaFolder", "driverAdapters"]` no longer needed (now stable). Adapted: created `apps/api/prisma.config.ts` (+ added `dotenv ^16.4.5` to load `.env.local` then `.env`), dropped the package.json block, removed the preview features. Schema folder + adapter pattern + baseline approach all unchanged.
2. **`prisma migrate diff` flag rename.** `--to-schema-datamodel` was removed in Prisma 7; used `--to-schema` instead.
3. **Generator output path.** `output = "../generated/prisma"` resolves relative to the schema folder, not to `apps/api/`, which would have placed the client at `apps/api/prisma/generated/prisma/`. Used `"../../generated/prisma"` to match the `@generated/prisma/*` tsconfig alias.
4. **Local DB pre-state.** The story assumed the local Supabase Postgres is empty; in reality `bunx supabase start` auto-applies the legacy migrations under `apps/web/supabase/migrations/` (UUID-based, incompatible with Prisma's TEXT prefixed IDs). Documented in README the `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` workaround for local dev.
5. **`@prisma/client-runtime-utils` direct dep.** Bun's isolated install layout doesn't expose `@prisma/client`'s transitives at the resolution path the generated runtime needs (`apps/api/generated/prisma/runtime/client.js` couldn't find `@prisma/client-runtime-utils`). Added it as a direct dependency to surface it in `apps/api/node_modules/@prisma/`.
6. **TypeScript narrowing in `prefixed-ids.extension.ts`.** Prisma's tightly-typed `args.data` union doesn't accept `Record<string, unknown>` directly; cast through `unknown` at the boundary, then back to `typeof args.data` on assignment.
7. **Test argument shape.** Two injector tests needed an intermediate `Record<string, unknown>` / `{ id: unknown }` variable to bypass TS excess-property checks on object literals fed to a generic constrained by `{ id?: unknown }`. Behaviour assertions unchanged.

None of the deviations alter the AC contract: same models, same migration, same RLS DDL, same prefix registry, same adapter, same /health smoke. The changes are config-shape and type-plumbing adaptations.

### Verification (captured at 2026-05-04T11:30:00Z)

```text
$ bun test (apps/api)
 15 pass
 0 fail
 37 expect() calls
Ran 15 tests across 3 files.

$ bun run typecheck
$ tsc --noEmit
(exit 0, no output)

$ bun run prisma:validate
The schemas at prisma/schema are valid 🚀

$ bun run prisma:migrate:status
1 migration found in prisma/migrations
Database schema is up to date!

$ bun run db:rls-audit
[rls-audit] OK — 7 tables checked: kpis (3 policies), monthly_tracking (3 policies),
hypotheses (3 policies), transactions (4 policies), accounts (4 policies),
holdings (4 policies), holding_lots (4 policies)

$ docker build -f apps/api/Dockerfile -t pekulo-api:dev .
✔ Generated Prisma Client (v7.8.0) to ./generated/prisma in 51ms
… image built

$ docker run --rm -d -p 3001:3001 -e DATABASE_URL=… pekulo-api:dev
$ curl -fsS http://127.0.0.1:3001/health
{"status":"ok"}
```

### Debug Log

- Prisma `format` + `validate` initially failed with `P1012` due to inline `url = env(...)`. Diagnosed via context7 docs query. Switched to `prisma.config.ts` (Prisma 7 pattern). Pinned dotenv to load `.env.local` first.
- Generator output path landed inside the schema folder until corrected to `../../generated/prisma`.
- `bunx supabase start` populated `public.*` with UUID-based brownfield tables, blocking `prisma migrate deploy` with `P3005`. Resolved by `DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ...` then re-running `migrate deploy`.
- Container exited on first run: `Cannot find module '@prisma/client-runtime-utils'`. Reproduced locally — Bun's isolated install. Resolved by adding the package as a direct dependency.

### Completion Notes

- All 6 ACs satisfied, all 10 Definition-of-Done items checked.
- 10 commits on `feat/0-4-prisma-setup`, prefix `feat(#4): ...`.
- Local Supabase stack remains running for downstream stories. The README documents the schema-reset workaround for fresh checkouts.
- Watch item W6 still applies: `prismaSchemaFolder` is now stable in Prisma 7, but Prisma version remains pinned exactly to `7.8.0` per ADR-0012 + W1 discipline.

### File List
