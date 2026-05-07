# Epic 0 — Foundations Context Cache

> Compiled at 2026-05-04. Reused by aped-dev for all Epic 0 stories. Re-aligned to v3 schema 2026-05-07 (numbered headings collapsed into the canonical six top-level sections).

## Scope from PRD

| FR ID                                          | Rationale                                                                                                                                                                                | Phase             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8 | Compass core (target capital + horizon, milestones, progress computation, audit trail, setup-incomplete state) — new `milestones` table, compass audit trail, compass UI readiness state | V1 (a)            |
| FR-9 to FR-20                                  | Accounts + holdings (brownfield extension for crypto holdings) — provider chain (4 tiers), cache, FX-adjusted portfolio                                                                  | V1 (a)            |
| FR-21 to FR-27                                 | Real-estate module (new tables `real_estate`, `real_estate_rental`, `real_estate_valuations`, audit history)                                                                             | V1 (a)            |
| FR-28 to FR-36                                 | Transactions + LLM categorisation (hybrid routing: Apple FoundationModels / Ollama / 3rd-party opt-in, transfer rule bypass, per-user opt-in, audit log)                                 | V1 (a)            |
| T1, T2, T3, T4                                 | Technical outcomes: monorepo (Bun + Turborepo), design system (Tamagui Core), RLS per-row, LLM hybrid topology                                                                           | V1 (a)            |
| NFR-1 to NFR-30                                | Non-functional requirements: latency (compass < 300 ms p95), RLS coverage (100 %), cache invalidation, offline read-only (PWA), migration discipline                                     | V1 (a) → V1.5 (b) |
| DR-1 to DR-12                                  | Domain requirements (no order routing, no advice, RLS enforcement, data export/deletion < 60 s, LLM opt-in, WCAG 2.2 AA, PSD2 gating, MiCA tracking-only, encryption at rest)            | V1 (a) → V1.5 (b) |

## Architecture references

**Phase 1 — Topology**

- **Monorepo**: Bun workspaces + Turborepo (`turbo.json` task graph)
- **Surfaces**: `apps/web` (Next.js 16 RSC PWA), `apps/api` (Bun + Elysia, new in 0-3), `apps/prices` (FastAPI, brownfield), `packages/*` (seven `@pekulo/*` workspaces for shared primitives, new in 0-1)
- **Geo**: France / EU only at V1; < €25/month infra for 100 concurrent users (b)
- **Postgres**: Supabase (RLS-only authz; web tier opens zero direct connections; `apps/api` is sole Postgres consumer aside from Supabase Auth)

**Phase 2 — Data Layer**

- **Query layer**: Prisma 7.8.0 + `@prisma/adapter-pg` direct connection (port 5432, long-running Bun process, no PgBouncer needed at V1)
- **Schema folder** (`apps/api/prisma/schema/`): one file per Elysia domain module (`_base.prisma`, `enums.prisma`, `accounts.prisma`, `holdings.prisma`, etc.) — Prisma 6+ preview feature `prismaSchemaFolder`
- **Prefixed IDs**: Trafi pattern via `Prisma.defineExtension` intercepting `create/createMany/upsert`, injecting `{prefix}_{base62_21chars}` (~125 bits entropy) when `id` undefined. Central registry at `apps/api/src/database/id-prefixes.config.ts`
- **Migrations**: Prisma Migrate (not Supabase CLI) — local: `prisma migrate dev`, production: `prisma migrate deploy` (Dokploy deploy hook). Forward-only. RLS policies appended manually to migration files (Prisma does not introspect RLS). `rls-audit` CI probe re-asserts after every deploy (ADR-0014 supersedes ADR-0006)
- **Brownfield table names**: retained via `@@map("kpis")` / `@@map("monthly_tracking")` / `@@map("holding_lots")`; new tables follow plural-snake-case (`milestones`, `compass_history`, `real_estate`, etc.)
- **Audit history**: sister tables (`compass_history`, `real_estate_valuations`, `llm_call_log`) append-only, RLS policies INSERT+SELECT only (no UPDATE/DELETE)

**Phase 3 — Process Rules**

- **RLS enforcement (NFR-8, DR-4)**: `apps/api` mandatory `requireUserContext(request)` helper verifies Supabase JWT, every Prisma query includes `where: { userId: ctx.userId }`. Defense in depth: RLS stays active even if `apps/api` omits guard (ADR-0013). Build-failing CI check asserts 100 % RLS coverage
- **Schema migration discipline**: Prisma Migrate owns all schema changes. `apps/api/prisma/migrations/<timestamp>_<verb_noun>/` forward-only. Baseline collapses `apps/web/supabase-schema.sql` via `prisma db pull` + `prisma migrate diff`
- **Prefixed-IDs discipline**: central `id-prefixes.config.ts` is the single source of truth; every model gets a 2-4-char prefix; lint rule `no-prisma-query-without-user-id` enforces user-context guards
- **Cache invalidation**: `setTagRegistry` in `src/lib/zapaction/keys.ts` maps mutation tags to invalidation keys; every new feature wires both keys and tags
- **Secrets topology**: V1 (a) single root `.env/.env.local` gitignored; pre-(b) Vercel project secrets for `apps/web`, Dokploy env for `apps/api`/`apps/prices`/Ollama; `SUPABASE_SERVICE_ROLE_KEY` only in Dokploy (never web); pre-commit `gitleaks` hook enforces no secrets in git

**Architecture Watch Items (W1, W6)**

- **W1 — Prisma version pinning**: Prisma is `7.8.0` exact-pinned. Minor/patch bumps via `bun add -u prisma`. Major bumps require an `aped-course` correction (deferred)
- **W6 — `prismaSchemaFolder` preview feature**: Prisma 6+ preview feature. If removed/breaking-changed before stable, fall back to single `schema.prisma` with stricter file ordering discipline (ADR-0012, story 0-4 note)

**ADR-0009 — Domain API on Bun + Elysia + oRPC**

- **Decision**: `apps/api` exposes domain operations via **oRPC** under `/rpc/v1/<module>/<method>`. Web tier (`apps/web`) keeps `'use server'` thin wrappers calling oRPC client, retained zapaction for React Query bridge. Hard layering: `Component → Custom Hook → Server Action → oRPC client → Elysia handler → service → Prisma`. Mount layout: `/rpc/v1/auth`, `/rpc/v1/compass`, `/rpc/v1/milestones`, `/rpc/v1/accounts`, `/rpc/v1/holdings`, `/rpc/v1/realestate`, `/rpc/v1/transactions`, `/rpc/v1/monthly`, `/rpc/v1/dashboard`, `/rpc/v1/settings`, `/rpc/v1/hypothesis`, `/rpc/v1/llm`, plus `/health`, `/ready` (public), `/internal/llm/attest` (private JWT-verified). All-lowercase no-separator convention — DB tables stay `real_estate*` (snake_case for SQL), contract/URL surface stays `realestate`.
- **Why**: logic centralisation, contract-first type safety, brownfield zapaction ergonomics preserved, modular shape matches Elysia module factories

**ADR-0011 — Packages reorg under `@pekulo/*` namespace**

- **Decision**: seven workspaces under `packages/`, five new + two reused: `@pekulo/zod` (helpers + re-exports), `@pekulo/types` (shared TS types), `@pekulo/validators` (Zod schemas, camelCase + `Schema` suffix), `@pekulo/contracts` (oRPC contracts), `@pekulo/tsconfig` (shared presets: `base.json`, `apps.json`, `packages.json`, `next.json`), `@pekulo/oxlint-config` (shared rules), `@pekulo/ui` (Tamagui Core-based Design System)
- **Import hierarchy**: strict downward flow enforced — `@pekulo/zod` → `@pekulo/validators` → `@pekulo/contracts` → apps ; `@pekulo/types` bidirectional (consumed by all, re-exports only definitions)

**ADR-0012 — Prisma 7.8.0 + schema folder + prefixed IDs**

- **Decision**: Prisma 7.8.0 with multi-file schema folder feature, `@prisma/adapter-pg` direct connection (port 5432), Trafi-pattern prefixed-IDs Prisma extension (Prisma.defineExtension intercepting `create`/`createMany`/`createManyAndReturn`/`upsert`), central `id-prefixes.config.ts` registry. Prefix mapping: `acc` Account, `hld` Holding, `lot` HoldingLot, `tx` Transaction, `kpi` Kpi, `mtr` MonthlyTracking, `hyp` Hypothesis, `cph` CompassHistory, `mst` Milestone, `res` RealEstate, `resr` RealEstateRental, `resv` RealEstateValuation, `llm` LlmCallLog, `llmo` LlmOptIn
- **Why**: pattern parity with Trafi (proven, tested), schema folder scales beyond 270-LOC SQL file, prefixed IDs improve debuggability and log readability

**ADR-0014 — Schema migrations via Prisma Migrate (supersedes ADR-0006)**

- **Decision**: Prisma Migrate owns every schema change. Local: `prisma migrate dev --name <verb_noun>` writes `apps/api/prisma/migrations/<timestamp>_<verb_noun>/`; production: `prisma migrate deploy` (Dokploy deploy hook). Baseline: brownfield `apps/web/supabase-schema.sql` collapsed via `prisma db pull` → `prisma migrate diff`. Forward-only (no down migrations). RLS policies appended manually to migration files (Prisma does not introspect policies); `rls-audit` CI job re-asserts after deploy
- **Why**: single source of truth (schema lives in `apps/api/prisma/schema/*.prisma`), type-safe codegen tied to migrations, operational toolchain alignment (Prisma Migrate is Dokploy-native deploy hook)

**Module factory pattern (ADR-0009)**

```typescript
// apps/api/src/modules/health/health.module.ts (exemplar)
export interface HealthModule {
  router: AnyElysia; // let TS infer the plugin type, never bare `Elysia`
}

export function createHealthModule(deps: { readiness: Readiness }): HealthModule {
  const router = new Elysia()
    .get("/health", () => ({ status: "ok" }))
    .get("/ready", async () => {
      const checks = await deps.readiness.check();
      // ...
    });
  return { router };
}
```

- **Implication**: every Elysia domain module exports a factory returning an object with `router: AnyElysia` (not bare `Elysia`). Factories are mounted in `apps/api/src/app.ts` via `.use(module.router)`

**Runtime dependencies + bootstrap shape (ADR-0009)**

```typescript
// apps/api/src/bootstrap/runtime-dependencies.ts
export interface RuntimeDeps {
  env: Env;
  readiness: Readiness;
}

export async function createRuntimeDependencies(input: { env: Env }): Promise<RuntimeDeps> {
  const readiness = createReadiness();
  return { env: input.env, readiness };
}

// apps/api/src/app.ts wires it
const deps = await createRuntimeDependencies({ env });
```

- **Implication**: every new feature story adds its service to the `RuntimeDeps` interface and instantiates it in the factory (v0-4 adds `prisma`; v0-7 adds `tracer` / `meter`; v0-8 adds `llmRouter`; etc.)

**Env loader Zod pattern (ADR-0009)**

```typescript
// apps/api/src/config/env.ts
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3001),
  HOST: z.string().min(1).default("127.0.0.1"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().max(60_000).default(10_000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}
```

- **Implication**: env loading is centralized at `src/config/env.ts`, Zod validates shape + types + defaults. New env vars in 0-4 (DATABASE*URL), 0-7 (OTEL*\*), 0-8 (GITHUB_TOKEN), etc. are added to the schema, not sprinkled inline

**Tsconfig extends discipline (@pekulo/tsconfig)**

```json
// apps/api/tsconfig.json (exemplar)
{
  "extends": "@pekulo/tsconfig/apps.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src/**/*.ts"]
}
```

- **Implication**: every workspace extends a preset from `@pekulo/tsconfig` (app = `apps.json`, package = `packages.json`, Next.js = `next.json`). Local overrides stay minimal (rootDir + include). Strict mode is inherited from `base.json` universally

**Prefixed IDs extension shape (ADR-0012)**

```typescript
// apps/api/src/database/prefixed-ids.extension.ts (exemplar, story 0-4)
const idExtension = Prisma.defineExtension({
  query: {
    $allModels: {
      create({ args, query }) {
        if (args.data.id === undefined) {
          args.data.id = `${getPrefix(args.model)}_${generateBase62(21)}`;
        }
        return query(args);
      },
      // createMany, createManyAndReturn, upsert also handled similarly
    },
  },
});

// apps/api/src/database/prisma.service.ts
export const prisma = new PrismaClient().$extends(idExtension);
```

- **Implication**: prefixed ID generation is transparent to service/handler code; every `await prisma.account.create({ data: { userId, ... } })` auto-injects `id: acc_<base62>`. No explicit ID passed unless overriding (idempotent)

**Watch items + residual gaps relevant to Epic 0**

| Item                                  | Risk                                                                                                                       | Status                                                      | Action by story                                                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **W1 — Prisma version pinning**       | Upgrade path (minor OK, major deferred)                                                                                    | pinned 7.8.0                                                | Check changelogs before minor bumps; major requires `aped-course` correction                                            |
| **W6 — `prismaSchemaFolder` preview** | If removed/breaking-changed before stable, fall back to single `schema.prisma` + stricter ordering                         | enabled as preview                                          | Story 0-4 to test stability; fallback documented in ADR-0012                                                            |
| **Bun `--cwd` form post-`run`**       | L1 fix: `bun --cwd <path> run <script>` was silently breaking; only works as global flag before subcommand                 | fixed in story 0-3 Dockerfile + 0-1 verified commands       | Always use `(cd <path> && bun run <script>)` form in shell invocations; Dockerfile uses `WORKDIR /app/apps/api` instead |
| **oxlint/oxfmt stability**            | L3–L5 teach-back from story 0-2: no `--staged`, no `_reason` on simple rules, SemVer-only React version                    | resolved                                                    | Story 0-11 lefthook + 0-12 oxlint-config must apply lessons; story 0-8 CI must validate                                 |
| **`@pekulo/ui` lib overrides**        | L finding from 0-1 review: `@pekulo/ui` currently has `lib: ["esnext"]` only, insufficient for Tamagui (needs DOM + `jsx`) | deferred to 0-10                                            | Story 0-10 must decide: local override in `packages/ui/tsconfig.json` or 5th preset `@pekulo/tsconfig/ui.json`          |
| **RLS audit CI automation**           | DR-4 + NFR-8: build must fail on any unprotected table; probe lives in story 0-4 (script) and 0-8 (CI step)                | script delivered 0-4, CI wiring 0-8                         | Story 0-8 to run `rls-audit` after `prisma migrate deploy` in Dokploy hook                                              |
| **Cascade delete < 60 s (NFR-7)**     | Scales past 50 k tx per user; synchronous `ON DELETE CASCADE` may become bottleneck                                        | plan: sync V1, tombstone + background purge at (b)→(c) ramp | Keep synchronous at V1 (a) under Persona #1's scale; revisit if adoption triggers (b) ramp                              |

## UX references

_(No UX bindings for Epic 0 — foundations layer ships without user-visible surface. UX wiring lands in Epic 1+ stories that consume `@pekulo/ui` primitives delivered by story 0-10.)_

## Project context (brownfield only)

**Tech Stack (per `docs/project-context.md`):**

- Monorepo: Bun 1.3.13 workspaces + Turborepo 2.9.6
- `apps/web`: Next.js 16.2.4 + React 19.2.4, Tailwind v4, shadcn (base-nova), zapaction + React Query, Zod v4
- `apps/prices`: Python ≥ 3.10, FastAPI 0.115, yfinance ≥ 0.2.55 (curl_cffi Chrome session), Pydantic 2.10
- Database: Supabase Postgres, single SQL file (`apps/web/supabase-schema.sql`, ~270 LOC), 7 tables, 4 enums, RLS per-row
- Auth: Supabase Auth (email + password), SSR cookie via `@supabase/ssr` v0.10
- Price providers: 4-tier fallback (prices-service → yahoo-finance2 → Boursorama → Twelve Data), 60 s in-memory cache
- **Brownfield gap**: no test framework installed (unit/integration/E2E all absent)

**Constraints affecting Epic 0:**

- Compass schema reuses `hypotheses.objectif` / `hypotheses.horizon_years` (no migration needed for V1, but audit trail required)
- Real-estate is entirely new (no legacy schema footprint)
- Transactions + LLM route to a new schema (audit history, opt-in tracking needed)
- V1 (a) is single-user personal use; V1.5 (b) flips to < 100 concurrent users (20 k+ tx/month scale expected pre-production)
- No secrets in git, ever (pre-commit enforcement required in 0-11)
- Dokploy VPS is the target for `apps/prices` + future Ollama + long-running `apps/api`

## Lessons applicable

**L1 (2026-05-04, all) — Bun `--frozen-lockfile` in Docker requires every workspace member's package.json**

- **Scope**: aped-arch, aped-story, aped-dev — stories 0-3, 0-8, every apps/\* Dockerfile
- **Lesson**: Bun's frozen install reads the root `package.json` `workspaces` glob and requires every member's manifest to be present in the install root — otherwise the lockfile is out-of-sync. Two fixes: (1) copy every workspace manifest before `bun install --frozen-lockfile` (`COPY apps/api/package.json apps/api/`, `COPY apps/web/package.json apps/web/`, `COPY packages packages`), (2) `.dockerignore` exception for foreign manifests (`apps/web` exclusion stays, but add `!apps/web/package.json` immediately after to re-include just the manifest)

**L2 (2026-05-04, aped-arch, aped-story, aped-dev) — Elysia 1.4 `Elysia` type is invariant**

- **Scope**: aped-arch, aped-story, aped-dev — stories 0-3, 0-5, 0-6, 1-1, 2-1, 3-1, 4-1, 5-1, 6-1, 7-1, 7-3, 8-1
- **Lesson**: Elysia 1.4.4's `Elysia` type has invariant generic parameters (Singleton, Definitions, Metadata, Routes, Ephemeral, Volatile). Module factories return inferred chains (no `: Elysia` return annotations); boundaries that accept any Elysia use `AnyElysia` (import from elysia). Never bare `Elysia` on any variable or parameter

**L3 (2026-05-04, aped-dev) — oxlint + oxfmt have no `--staged` flag**

- **Scope**: aped-dev, aped-story — story 0-2 + 0-12
- **Lesson**: neither `oxlint@1.62.0` nor `oxfmt@0.47.0` exposes a `--staged` flag. Use lefthook's variable expansion (`{staged_files}`) and pass file paths as positional arguments: `oxlint --fix {staged_files}` and `oxfmt {staged_files}`

**L4 (2026-05-04, aped-dev) — oxlint rejects `_reason` annotation on rules without options-schema**

- **Scope**: aped-dev, aped-story — story 0-2 + 0-12
- **Lesson**: oxlint validates rule-option payloads against each rule's own option-schema. Rules without options (e.g. `react/react-in-jsx-scope`, `import/no-unassigned-import`) reject the `{ _reason: ... }` payload. For rules WITHOUT options-schema, use simple-string severity (`"off"` / `"error"` / `"warn"`); for rules WITH options, use the array-with-\_reason form

**L5 (2026-05-04, aped-dev) — oxlint `settings.react.version` requires SemVer string, no `"detect"`**

- **Scope**: aped-dev — story 0-12
- **Lesson**: oxlint's schema constrains `settings.react.version` with regex `^[1-9]\d*(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?$` (SemVer-only, no `"detect"` like eslint-plugin-react). Hard-code the React version in `.oxlintrc.json` and update it in lockstep with `apps/web/package.json` on every React bump

## Previous stories — outcomes

### Story 0-1 — Packages reorg under `@pekulo/*` namespace (DONE)

- **What shipped**: seven workspaces (`@pekulo/{zod,types,validators,contracts,tsconfig,oxlint-config,ui}`) with placeholder exports, `@pekulo/tsconfig` wired as shared TypeScript base (four presets: `base.json`, `apps.json`, `packages.json`, `next.json`), import hierarchy enforced (AC-3)
- **Key files**: `packages/{tsconfig,zod,types,validators,contracts,oxlint-config,ui}/{package.json,src/index.ts,tsconfig.json}`; deleted `packages/.gitkeep`
- **Lessons emerged**: L1 (Bun `--frozen-lockfile` workspace coverage), L2 (Elysia invariant type), plus forward-pointers: `target` asymmetry (ES2022 vs ES2017), `@pekulo/ui` lib needs DOM override, `@pekulo/tsconfig` lacks `"type": "module"`

### Story 0-2 — Oxc toolchain (oxlint + oxfmt) (DONE)

- **What shipped**: `oxlint@1.62.0` + `oxfmt@0.47.0` exact-pinned in root `devDependencies`, `.oxlintrc.json` at repo root, root scripts `lint` / `format` / `lint:fix` / `format:check` repointed to Oxc, `eslint-config-next` removed from `apps/web`, ESLint / Prettier physically deleted
- **Key files**: `package.json` (scripts + devDeps), `.oxlintrc.json`, `.oxfmtrc.json`, cleaned `apps/web/package.json`
- **Lessons emerged**: L3 (oxlint/oxfmt no `--staged` flag), L4 (oxlint rejects `_reason` on rules without options), L5 (oxlint `settings.react.version` SemVer-only)

### Story 0-3 — API scaffold on Bun + Elysia (DONE)

- **What shipped**: `apps/api` greenfield scaffold (Bun + Elysia entrypoint), bootstrap directory structure (`bootstrap/platform/database/common/config/modules/health`), `@pekulo/api` workspace registered, Dockerfile (L1-corrected with workspace manifest copying + `.dockerignore` exceptions), health module exposing `/health` + `/ready`, env validation (NODE_ENV, PORT, HOST, SHUTDOWN_TIMEOUT_MS), readiness registry, lifecycle hooks (SIGTERM/SIGINT)
- **Key files**: `apps/api/{package.json,tsconfig.json,src/main.ts,src/app.ts,src/config/env.ts,src/bootstrap/{readiness,lifecycle,runtime-dependencies}.ts,modules/health/health.module.ts,Dockerfile,.gitignore,.dockerignore}`
- **Lessons emerged**: L1 (Dockerfile workspace manifest coverage — applied immediately in 0-3 Task 10, pre-Lesson formalization), L2 (Elysia invariant type — observed in 0-3 Task 5 but fixed in early commit, then formalized as L2)

### Story 0-10 — `@pekulo/ui` Tamagui DS migration (DONE)

- **What shipped**: `@pekulo/ui` package on Tamagui Core 2.0.0-rc.41 as `apps/web`'s sole DS surface (ADR-0007). 41 `Pekulo*` components + 14 primitives, tokens 1:1-mirrored from `docs/ux-preview/` SSOT, 8 domain types extracted to `@pekulo/types` per arch L366. `apps/web` Path C decommission complete (Tailwind / shadcn / `@base-ui/react` / framer-motion all stripped). 52 test files / 81 inline snapshots / 64 a11y assertions / coverage gate 70/60 (current 92.85 %).
- **Key files**: `packages/{types,ui}/src/**/*`, `apps/web/src/{app/layout.tsx,components/{providers,auth-form}.tsx,app/dashboard/*,proxy.ts}`, `scripts/check-no-tailwind.sh`, `docs/ux-preview/src/{index.css,tokens/colors.ts}` (SSOT extended with `--warning` Pekulo extension).
- **Lessons emerged**: L13–L18 (Tamagui v2 prop renames, RSC `'use client'` discipline, styled.input/button StackStyle, vitest `--passWithNoTests`, Select.Content FocusScope, compound triggers `render="button"`), L19–L26 (review fix-cycle: `bun test` ≠ `vitest run` in CI, `package.json#exports` cannot reference `node_modules/`, barrel re-exports must be RSC-safe via sub-paths, Vercel Yarn 4.5 hoisting trips Next TS check, domain types in `@pekulo/types`, tokens 1:1-mirror not fork, TR-strict `$accent` reserved for ± deltas).

---

**Generated by aped-dev context compiler on 2026-05-04 for Epic 0 story sequencing (0-5 onward); re-aligned to v3 schema 2026-05-07.**
