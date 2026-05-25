---
artefact: architecture
project: Pekulo
created: 2026-05-03T00:00:00Z
last_updated: 2026-05-03T06:00:00Z
current_subphase: done
completed_subphases:
  - context-analysis
  - technology-decisions
  - council-dispatches
  - implementation-patterns
  - structure-mapping
  - validation
phases_planned:
  - context-analysis
  - technology-decisions
  - council-dispatches
  - implementation-patterns
  - structure-mapping
  - validation
---

# Architecture — Pekulo

> Built incrementally by `aped-arch`. Sections fill as each subphase is validated.

## Phase 1 — Context Analysis

> Validated 2026-05-03. Drives every decision in Phases 2–4.

### Functional drivers

- **Compass core (FR-1 → FR-8)** — new `milestones` table sibling of `hypotheses`; compass-progress computation; compass audit trail (FR-2); compass-incomplete state surfaced as a distinct UI mode, not a misleading 0 % (FR-8).
- **Provider chain (FR-16, FR-17)** — 4 tiers (`prices-service` → `yahoo-finance2` → Boursorama → Twelve Data) with 60 s in-memory cache keyed by `ticker|kind|currency`; already implemented in `apps/web/src/lib/services/prices.ts`; extended to `crypto` (Yahoo + Twelve Data both cover BTC/ETH).
- **LLM routing hybrid (FR-31 → FR-34)** — three transports (Apple FoundationModels iOS / Ollama Dokploy / 3rd-party API opt-in); rule-based transfer bypass (FR-30); manual override always wins (FR-33); per-user opt-in for 3rd-party path (FR-34).
- **Audit + GDPR (FR-2, FR-27, FR-35, FR-49, FR-50)** — three distinct audit trails (compass, real-estate valuations, LLM calls); one-action JSON export and cascade deletion within 60 s.
- **PWA + DS unification (FR-53 → FR-56)** — install affordance, offline read-only on dashboard/portefeuille/immobilier; from V1.5, _zero_ Tailwind ↔ NativeWind divergence via `packages/ui`.

### Non-functional drivers

- **Latency** — NFR-1 (compass p95 < 300 ms), NFR-2 (quote chain 1.5 s p95 cached / 4 s cold), NFR-3 (Lighthouse ≥ 90), NFR-4 (TTFMP < 2.5 s mid-Android 4G), NFR-5 (LLM per-route p95: 600 ms / 1.5 s / 3 s). → SSR + RSC + tag-driven cache + minimised hydrated JS.
- **Security RLS** — NFR-8 (100 % RLS coverage with build-failing automated check), NFR-9 (401 < 100 ms via existing `apps/web/src/proxy.ts`), NFR-12 (zero PII in LLM prompt, ≤ 2 kb), NFR-13 (zero 3rd-party LLM calls without opt-in), NFR-14 (at-rest encryption documented).
- **Scalability** — NFR-15 (100 concurrent users at (b)), NFR-16 (50 k tx / 500 holdings / 50 properties per user), NFR-17 (`apps/prices` ≥ 30 rps no 5xx).
- **Reliability** — NFR-18 (provider fallback 500 ms), NFR-19 (FX fallback 1:1 in 50 ms, recorded in snapshot), NFR-20 (cache offline 60 min), NFR-21 (restore drill before (b)).
- **Observability** — NFR-25 (structured logs at (b), no PII other than hashed user-id), NFR-26 (LLM call log, no prompt content, ≤ 90 days), NFR-27 (Sentry-equivalent with PII scrubbing).
- **Integration** — NFR-28 (Supabase JS SDK v2 only, zero direct DB access from web tier), NFR-29 (Bearer token on `apps/prices`), NFR-30 (versioned export schema `docs/exports/schema-v1.json`).

### Scale

- **V1 (a):** single user (Alex). **V1.5 (b):** ≤ 100 concurrent users.
- **Per-user max:** 50 000 transactions, 500 holdings, 50 properties.
- **Surfaces:** `apps/web` (Next 16 PWA), `apps/mobile` (Expo, V1.5), `apps/prices` (FastAPI, Dokploy), `packages/ui` (Pekulo DS).
- **Geo:** France / EU only at V1; multi-base-currency is V2+.
- **Infra cost target:** < €25/month for first 100 users (PRD B3).

### Integration points

| System                                                | Role                                                       | Phase       | Required?                        |
| ----------------------------------------------------- | ---------------------------------------------------------- | ----------- | -------------------------------- |
| Supabase (Postgres + Auth)                            | Sole datastore + identity, RLS-only authz                  | V1          | yes                              |
| `apps/prices` (Dokploy VPS)                           | Tier-1 quote provider, yfinance + curl_cffi Chrome session | V1          | optional (`PRICES_SERVICE_URL`)  |
| Yahoo Finance (`yahoo-finance2` npm)                  | Tier-2 quote provider                                      | V1          | implicit fallback                |
| Boursorama (HTML scraping)                            | Tier-3 quote provider, Euronext FR coverage                | V1          | implicit fallback                |
| Twelve Data                                           | Tier-4 fallback, US-only, 800 req/day free                 | V1          | optional (`TWELVE_DATA_API_KEY`) |
| frankfurter.app                                       | ECB FX rates, EUR-base, fallback 1:1                       | V1          | implicit                         |
| Vercel                                                | `apps/web` hosting                                         | V1          | yes                              |
| Dokploy VPS                                           | `apps/prices` hosting + future Ollama endpoint             | V1          | yes                              |
| Apple FoundationModels                                | LLM on-device, iOS ≥ 15 Pro                                | V1.5 mobile | optional                         |
| Ollama (Dokploy)                                      | LLM self-hosted server-side, default for web + Android     | V1          | yes (when LLM enabled)           |
| 3rd-party LLM API (Claude Haiku 4.5 or Mistral Small) | LLM ambiguous-case fallback, **opt-in mandatory**          | V1          | optional                         |

### Compliance

| Framework                               | Trigger phase                            | Architectural action                                                                           |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **GDPR** + CNIL                         | (b) public ramp                          | DPA with Supabase, processing register, lawful basis, subject rights, 72 h breach notification |
| **EU AI Act 2024/1689** (transparency)  | LLM enabled by default (after M3 ≥ 80 %) | AI transparency notice (DR-12), 3rd-party opt-out always available                             |
| **WCAG 2.2 AA** (EAA from 2025-06-28)   | DS phase / before (b)                    | Tokens already meet contrast; axe-core CI scans + 1 manual screen-reader pass                  |
| **MiCA**                                | Out of CASP scope at V1 (tracking-only)  | Re-evaluate if exchange API ever lands at V2+ (DR-10)                                          |
| **PSD2 / DSP2**                         | Only if Powens / Bridge ever lands (V2+) | Gated by ADR + user approval (DR-9)                                                            |
| **PCI DSS / KYC-AML / MiFID II / DORA** | Never (by design)                        | Maintain "no funds custody / no order routing" invariants (DR-1, DR-2, DR-3)                   |

### Tensions to resolve (drive Phase 2 decisions)

1. **DS Tailwind v4 (V1 web) ↔ Tamagui Core (V1.5 mobile)** — T2 demands "no per-app Tailwind/NativeWind divergence from V1.5". Either keep Tailwind v4 for V1 web and rebuild on Tamagui at V1.5 (= web rewrite when mobile lands, double-migration risk), or migrate `apps/web` to Tamagui _before_ mobile work (= blocks V1 features for the DS phase). Hard call required in Phase 2 — Frontend.
2. **LLM routing topology heterogeneity (FR-31)** — three transports (FoundationModels client / Ollama server / 3rd-party API server). Where lives the routing policy? Client-side = uniform audit log harder (NFR-26). Server-side = loses on-device latency edge. Hard call required in Phase 2 — Council dispatch.
3. **No test framework installed** — NFR-1/2/4/5/6/7/8/18/21/22 all require measurement. Architecture must prescribe the pyramid (unit / integration / contract / perf / a11y) with concrete framework picks in Phase 2.
4. **Offline PWA (FR-54) ↔ RLS (NFR-8)** — read-only views served from last cached snapshot when Supabase is unreachable. Decision: Service Worker scoped per user ID, IndexedDB (encrypted via Web Crypto?) or Cache API, automatic purge on logout. To be settled in Phase 2 — Frontend / Phase 3 — Process Rules.
5. **Cache invalidation graph (`setTagRegistry`)** — already in place; new tags + new mutation paths for compass / milestones / LLM categorisation / real-estate. Risk of dashboard staleness (FR-44) if not wired. Codified as a Phase 3 hard rule.
6. **Cascade delete < 60 s (NFR-7, DR-5) ↔ scale 50 k tx (NFR-16)** — synchronous `ON DELETE CASCADE` holds for Persona #1 but may break at scale. Decision: synchronous V1, tombstone + background purge promoted only at the (b)→(c) ramp.
7. **FX fallback silence** — `derive-portfolio-fx.ts` currently silent on 1:1 fallback; NFR-19 demands the fallback be recorded in the snapshot for transparency. Add `fxSource` field to `PortfolioSnapshotFx` + UI badge; touches FR-18.
8. **Compass schema reuse (`hypotheses.objectif` / `horizon_years`) ↔ audit trail FR-2** — must be settled in Phase 2 — Data Layer: either snapshot prior compass values into a `compass_history` sister table, or make `hypotheses` append-only with an `is_current` flag.
9. **Real-estate audit (FR-27)** — requires either a `real_estate_valuations` history table or a JSONB `valuation_history` column on `real_estate`. Settled in Phase 2 — Data Layer.
10. **Secrets topology** — single root `.env` today; target (b) is Vercel project secrets + Dokploy env, with `PRICES_SERVICE_TOKEN` rotation. Codified as Phase 3 process rule.

## Phase 2 — Technology Decisions

> Validated 2026-05-03. Brownfield defaults retained unless explicitly overridden. C1 (DS strategy) and C2 (LLM routing) deferred to Phase 2b — Council. ADRs 0001–0006 written for hard-to-reverse decisions.

### Data Layer

- **Datastore: Supabase Postgres** (brownfield) — single source of truth for every persisted row. Satisfies FR-1 → FR-59 (storage). NFR-28 amended (see Authentication & Security): web tier opens zero direct DB connections ; `apps/api` is the sole Postgres consumer aside from Supabase Auth's internal access.
- **Query layer: Prisma 7.8.0 + `@prisma/adapter-pg`** in `apps/api`. Direct connection on port 5432 (long-running Bun process on Dokploy ; PgBouncer pooler at port 6543 reserved for future edge deployment). Connection string in Dokploy env only. **See ADR-0012.**
- **Schema folder** at `apps/api/prisma/schema/` — one file per Elysia domain module:
  - `_base.prisma` — `datasource db`, `generator client`, `previewFeatures = ["prismaSchemaFolder"]`
  - `enums.prisma` — every domain enum (`AccountType`, `HoldingKind`, `TransactionType`, `LotType`, `LlmRoute`, `MilestoneStatus`, `PropertyType`, …)
  - `accounts.prisma`, `holdings.prisma`, `transactions.prisma`, `compass.prisma`, `realestate.prisma`, `llm.prisma`, `monthly.prisma`, `hypothesis.prisma`, `dashboard.prisma`, `bank_aggregator.prisma` (added 2026-05-25 per ADR-0015 — `BankConnection` model with `pgcrypto` column-level encryption on OAuth token columns)
- **Prefixed IDs Prisma extension** (Trafi pattern, ported as-is) at `apps/api/src/database/prefixed-ids.extension.ts`. `Prisma.defineExtension` intercepts `create` / `createMany` / `createManyAndReturn` / `upsert` to inject `{prefix}_{base62_21chars}` (~125 bits entropy) when `id` is undefined. Central config at `apps/api/src/database/id-prefixes.config.ts`. **See ADR-0012.**

  | Model           | Prefix | Model               | Prefix |
  | --------------- | ------ | ------------------- | ------ |
  | Account         | `acc`  | Hypothesis          | `hyp`  |
  | Holding         | `hld`  | CompassHistory      | `cph`  |
  | HoldingLot      | `lot`  | Milestone           | `mst`  |
  | Transaction     | `tx`   | RealEstate          | `res`  |
  | Kpi             | `kpi`  | RealEstateRental    | `resr` |
  | MonthlyTracking | `mtr`  | RealEstateValuation | `resv` |
  | LlmCallLog      | `llm`  | LlmOptIn            | `llmo` |
  | BankConnection  | `bnk`  |                     |        |

  `User` carries no prefix (managed by Supabase Auth, native UUID). `BankConnection` row added 2026-05-25 per ADR-0015.

- **Brownfield table names retained** via `@@map("kpis")` / `@@map("monthly_tracking")` / `@@map("holding_lots")` ; new tables follow plural-snake-case convention (`milestones`, `compass_history`, `real_estate`, `real_estate_rental`, `real_estate_valuations`, `llm_call_log`, `llm_opt_in`).
- **Caching strategy:**
  - Wire-level: oRPC client → React Query bridge via zapaction `@zapaction/query`. RQ keys are the single source of truth for client cache invalidation ; tag registry retained for invalidation graph hints across feature mutations.
  - Service-level (Elysia `apps/api`): in-memory `Map` cache for price quotes (60 s, key `ticker|kind|currency`) ported from current `apps/web/src/lib/services/prices.ts`. Satisfies FR-17, NFR-2.
  - DB-level: Prisma's per-request connection ; no second-level cache at V1.
- **Schema migrations: Prisma Migrate** (`apps/api/prisma/migrations/<timestamp>_<verb_noun>/`). Local: `prisma migrate dev` ; production: `prisma migrate deploy` in the Dokploy deploy hook. Forward-only ; baseline collapse from the brownfield `apps/web/supabase-schema.sql` via `prisma db pull`. RLS policy DDL appended manually to migration files (Prisma does not introspect Postgres policies) ; `rls-audit` CI probe re-asserts after every deploy. **See ADR-0014 (supersedes ADR-0006).**
- **Audit history pattern (D5): sister tables** — `compass_history`, `real_estate_valuations` are append-only siblings of `hypotheses` and `real_estate`, indexed on `(userId, valuedOn desc)`. RLS policies: `INSERT` + `SELECT` only ; `UPDATE` and `DELETE` intentionally omitted. **See ADR-0001.**
- **Pagination convention (D2): cursor-based** — every user-scoped list endpoint with potential row count > 100 (`transactions`, `llm_call_log`, `holding_lots`) uses `(createdAt desc, id desc)` keyset pagination with a `nextCursor` in the response. Offset pagination forbidden. Satisfies NFR-16.
- **Validation: Zod v4 via `@pekulo/validators`** (camelCase + `Schema` suffix — `createCompassSchema`, `recordValuationSchema`, `attestLlmCallSchema`). Schemas consumed by oRPC contracts (`@pekulo/contracts`), TanStack Form on the web, and env validation at boot. Derived TS types via `z.infer<typeof Schema>` re-exported from `@pekulo/types`.

### Authentication & Security

- **Auth: Supabase Auth — email + password** (brownfield, retained), session via SSR cookie (`@supabase/ssr` v0.10) on `apps/web`. The Supabase-issued JWT is forwarded as `Authorization: Bearer <jwt>` to `apps/api` on every oRPC call. Supabase TOTP MFA reserved for the (b) ramp. Satisfies FR-45 → FR-47, NFR-9 (401 < 100 ms via `apps/web/src/proxy.ts` middleware _and_ Elysia's `bearer` plugin on `apps/api`), NFR-11 (12-char password + 10/IP/hour rate-limit, both Supabase-native).
- **Authorization (NFR-8 amended — defense in depth):**
  - **Primary enforcement** — `apps/api` services use a mandatory `requireUserContext(request)` helper that verifies the Supabase JWT (using `SUPABASE_JWT_SECRET`) and returns `{ userId, email, jwtClaims }` or throws `UnauthorizedError`. Every Prisma query touching a user-scoped table MUST include `where: { userId: ctx.userId, … }`. Lint-enforced by `no-prisma-query-without-user-id` rule in `@pekulo/oxlint-config`.
  - **`apps/api` connects with the Supabase service role** (bypasses RLS) — connection string only on Dokploy ; never in `apps/web` env or any public surface.
  - **Defense in depth** — RLS stays active on every user-scoped table. Every table carries `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` + four `auth.uid() = user_id` policies (SELECT, INSERT, UPDATE, DELETE), except audit tables (`compass_history`, `real_estate_valuations`, `llm_call_log`) which omit UPDATE / DELETE policies (append-only). If `apps/web` ever bypasses `apps/api` or a repository accidentally omits the `userId` guard, RLS catches the bug.
  - **`apps/web` direct queries** are limited to Supabase Auth API only ; data reads/writes go through `apps/api` via oRPC. The Supabase anon key (in `NEXT_PUBLIC_*`) talks to RLS-protected endpoints.
  - **See ADR-0013.**
- **RLS coverage automation: build-failing CI check** — a SQL probe iterates `pg_tables WHERE schemaname='public'` and asserts every user-scoped table has RLS enabled with the appropriate policy quartet (full quartet for domain tables, INSERT+SELECT only for audit tables). Build fails on any drift. Satisfies NFR-8 + DR-4.
- **Secrets management (D8):**
  - V1 (a): single root `.env` + `.env.local`, gitignored, loaded via `dotenv -e .env -e .env.local --` (existing convention).
  - Pre-(b): **Vercel project secrets** for `apps/web` + **Dokploy environment** for `apps/api`, `apps/prices` and Ollama. Rotate `PRICES_SERVICE_TOKEN` at the (b) flip.
  - **`SUPABASE_SERVICE_ROLE_KEY`** lives only in Dokploy env ; never in `apps/web` env. **`SUPABASE_JWT_SECRET`** in Dokploy env (used by `apps/api` to verify forwarded JWTs).
  - Pre-commit `gitleaks` hook fails on accidental secret commits. No secret in git, ever.
- **CORS / rate-limiting:**
  - `apps/web` API routes: same-origin only (Next 16 default).
  - `apps/api` (Dokploy): CORS allowlist via Elysia `cors` plugin restricted to the `apps/web` Vercel origin + localhost dev ; Bearer token verified per request via Elysia `bearer` plugin.
  - `apps/prices` (Dokploy): Bearer token `Authorization: Bearer $PRICES_SERVICE_TOKEN`, reject within 100 ms (existing). Satisfies NFR-29.
  - Failed login rate-limit: Supabase-native, 10/IP/hour (NFR-11).
  - oRPC routes: per-user rate-limit on `apps/api` (Elysia `rate-limit` plugin keyed by `userId` from JWT) — defaults conservative at V1 ; tuned at (b) ramp.
- **Transport: TLS 1.2+ via Vercel + Caddy auto-TLS on Dokploy.** HSTS preload enabled at the (b) flip. Satisfies NFR-10.

### API Design

- **Style: contract-first oRPC + Elysia, tri-stack by surface**
  - **Domain API (`apps/api`)** — Bun + ElysiaJS exposing every domain operation via **oRPC** under `/rpc/v1/<module>/<method>`. Contracts live in `@pekulo/contracts` (one sub-tree per module). Mount layout:
    - `/rpc/v1/auth` `/rpc/v1/compass` `/rpc/v1/milestones`
    - `/rpc/v1/accounts` `/rpc/v1/holdings` `/rpc/v1/realestate`
    - `/rpc/v1/transactions` `/rpc/v1/monthly` `/rpc/v1/dashboard`
    - `/rpc/v1/settings` `/rpc/v1/hypothesis` `/rpc/v1/llm`
    - `/rpc/v1/bankaggregator` (added 2026-05-25 per ADR-0015 — Bridge connector + connection CRUD)
    - `/health`, `/ready` (Elysia-native, public)
    - `/internal/llm/attest` (Elysia-native private listener for iOS FoundationModels attestation, JWT-verified)
    - `/internal/bridge/webhook` (Elysia-native private listener for Bridge webhooks ; HMAC signature verified per NFR-33 ; added 2026-05-25 per ADR-0015)
  - **Web tier (`apps/web`)** — Next.js server actions stay as **thin `'use server'` wrappers** (`<feature>-actions.ts`, single file per feature, multiple verbs co-located via zapaction `defineAction`) that call the oRPC client and return typed responses. **`zapaction` retained** as the React Query bridge ; `setTagRegistry` retained for cross-feature invalidation hints.
  - **`apps/prices`** — REST + Bearer token (FastAPI 0.115, brownfield). Stateless. Called by `apps/api`'s holdings module via internal HTTP. Satisfies FR-16, NFR-29, NFR-17.
  - **See ADR-0009.**
- **Hard layering** (lint-enforced via `no-server-action-in-component` in `@pekulo/oxlint-config`):
  ```
  Component (.tsx)
    └─ uses → Custom Hook (use<Verb><Resource> | use<Feature>Form)
                └─ uses → Server Action (<feature>-actions.ts, 'use server')
                            └─ uses → oRPC client → /rpc/v1/<module>/<method>
                                                     └─ Elysia handler → service → Prisma
  ```
  **See ADR-0010.**
- **oRPC routing conventions**: kebab-case ; resource-oriented ; plural on resources ; verb in the contract method, never in URL ; non-CRUD actions use an explicit kebab verb at the end (`/llm/attest`, `/transactions/import-csv`, `/sessions/revoke-all`). Sub-trees of the contract are bumpable independently (`/rpc/v1/llm` could become `/rpc/v2/llm` while other modules stay v1).
- **Versioning:** `/rpc/v1/*` from day 1. `apps/prices` keeps unversioned until reused beyond `apps/api` (V2+).
- **Error handling (uniform):**
  - **`apps/api` services** throw typed domain errors extending a base `PekuloError { code: string, cause?: unknown }`. Concrete subclasses per module: `CompassError`, `LlmRoutingError`, `LlmOptInError`, `PriceProviderError`, `RlsViolationError`, `MigrationError`, `UnauthorizedError`. The Elysia error mapper converts these to oRPC error responses with stable `code` + `message` (4xx) or `code` + `requestId` (5xx, where `requestId` is the OTel trace_id).
  - **oRPC client on `apps/web`** receives typed errors ; server action wrappers re-throw to `zapaction` which propagates to React Query.
  - **Custom hooks** translate typed errors to UX (toast / error boundary / form field error).
  - **Prices provider chain** returns the winning provider name ; on full failure throws composite `PriceProviderError.attempts` (port from existing logic). Satisfies NFR-18.
- **Pagination:** see Data Layer D2 (cursor-based for any list potentially > 100 rows). oRPC contract types include `nextCursor?: string` consistently.

### Frontend

- **Framework: Next.js 16.2 App Router (RSC + Turbopack) on React 19.2** (brownfield). RSC by default; client components only when interactivity demands it. Satisfies NFR-3 (Lighthouse ≥ 90), NFR-4 (TTFMP < 2.5 s mid-Android 4G).
- **State management — three-layer split:**
  - **Server state**: `@tanstack/react-query` v5 + zapaction tag registry (brownfield). Sole owner of any value sourced from Supabase.
  - **Client cross-component state**: **Zustand** (small, ~1 kb, no provider, RSC-friendly). Owns values that survive a route change and need to be shared without prop-drilling — theme, language, AI activity badge state, transactions filter panel, optimistic compass-edit drafts, third-party LLM opt-in mirror for client-only gating. Stores live at `apps/web/src/lib/stores/<feature>-store.ts`. **Persisted slices** use `zustand/middleware` `persist` with `localStorage` ; secrets / per-user data NEVER persisted.
  - **Component-local state**: React 19 `useState` / `useReducer` / `useOptimistic`.
  - **Boundary rule (Phase 3 process rule)**: a value lives in exactly one layer. Never mirror server state into Zustand ; never duplicate Zustand state into a parent component.
- **Hooks tier system** (lint-enforced) — three families ; components consume only custom hooks, never server actions or `useForm` directly:

  | Tier              | Convention               | Pekulo example                                                              |
  | ----------------- | ------------------------ | --------------------------------------------------------------------------- |
  | Query (read)      | `use<Feature><Resource>` | `useDashboardCompass`, `usePortfolioHoldings`, `useTransactionsPending`     |
  | Mutation (write)  | `use<Verb><Resource>`    | `useUpdateCompass`, `useRecordValuation`, `useConfirmCategorisation`        |
  | Form orchestrator | `use<Feature>Form`       | `useEditCompassForm`, `useAddMilestoneForm`, `useImportTransactionsCsvForm` |

  Form orchestrators wrap TanStack Form's `useForm` together with the corresponding mutation hook ; expose `{ form, send, isSubmitting, … }`. Components consume only the orchestrator. **See ADR-0010.**

- **Local vs Global tier split** (mirrors Bonjour pattern):

  | Family         | Local (route-scoped)                                     | Global (cross-route)                                      |
  | -------------- | -------------------------------------------------------- | --------------------------------------------------------- |
  | Hooks          | `apps/web/src/app/<route>/_hooks/`                       | `apps/web/src/lib/hooks/`                                 |
  | Components     | `apps/web/src/app/<route>/_components/`                  | `apps/web/src/components/` (top-level, **not** in `lib/`) |
  | Server Actions | `apps/web/src/app/<route>/_actions/<feature>-actions.ts` | `apps/web/src/lib/actions/<feature>-actions.ts`           |

- **Form handling: TanStack Form + Zod v4 via `@pekulo/validators`** — schemas re-used in oRPC contracts (`@pekulo/contracts`) and form orchestrators.
- **UI primitives & DS: Tamagui Core (MIT) on `@pekulo/ui`** — Pekulo Design System ships as the only component library consumed by `apps/web` (and `apps/mobile` at V1.5). `@base-ui/react`, `shadcn` `base-nova`, `tailwindcss`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge` are removed from `apps/web` in the migration sequence. `lucide-react` v1.11 retained as the single icon family. `recharts` v3.8 retained for non-trivial charts; the compass curve and trajectory chart stay as inline SVG per UX spec. UX tokens at `docs/ux-preview/src/tokens/` ported into Tamagui's theme system as `pekulo-dark` + `pekulo-light` themes.
- **Animation strategy (revised post-C1)**: Tamagui's `animations` prop on web AND mobile (single API). Framer Motion 12 removed from web. Moti on Reanimated 4 retained for mobile-specific gestures at V1.5 ; React Native Skia reserved for the compass donut hot-path if jank profiles at V1.5. All animations honour `prefers-reduced-motion`.
- **C1 decision (DS migration to Tamagui _now_)** — see **ADR-0007**. Pre-flight spikes required before kickoff: Tamagui v2 ↔ Next 16 RSC integration; proto `App.tsx` port without losing palette discipline; WCAG 2.2 AA contrast preservation across both themes.
- **PWA + offline (D7):**
  - Service Worker: Next 16 native `app/sw.ts` (no `next-pwa` dependency). Strategy = stale-while-revalidate on routes `/dashboard`, `/portefeuille`, `/immobilier`. Network-first on every mutation. Satisfies FR-53, FR-54.
  - Offline cache: **encrypted IndexedDB scoped per `user_id`**, encryption key derived from session via Web Crypto `SubtleCrypto.deriveKey`; cache cleared on `auth.onAuthStateChange('SIGNED_OUT')`. Cache TTL = 60 min (NFR-20).
  - **See ADR-0003.** Satisfies FR-54, NFR-8, NFR-20.
- **Lint + format toolchain:**
  - **`oxlint`** (Oxc, Rust-based) replaces `eslint-config-next` — drop-in for the rules currently active, ~50–100× faster on monorepo-wide runs. Project-context flagged the existing ESLint setup as the only quality gate; oxlint keeps the gate while removing the perf cost.
  - **`oxfmt`** (Oxc formatter, alpha) replaces ad-hoc Prettier. Accepted risk: oxfmt is pre-1.0 ; pin a known-good version, audit on every bump.
  - Both run on pre-commit (via `lefthook`) + CI (`pr.yml`). See Phase 3 — Process Rules.

### Infrastructure

- **Hosting:**
  - `apps/web`: **Vercel** (brownfield), Edge runtime where compatible, Node runtime for any `node:` import. Vercel project secrets at (b).
  - `apps/api` (new) + `apps/prices` + **Ollama**: **Dokploy on the existing VPS** behind the same Caddy reverse proxy. Caddy mounts `/rpc/v1/*`, `/health`, `/ready`, `/internal/*` to `apps/api`. `apps/prices` reachable only via internal Docker network from `apps/api` (no public port). Ollama bound to localhost ; proxied through `apps/api`'s LLM module exclusively. Bearer auth on `apps/prices` (NFR-29). Satisfies B3 (< €25/mo).
- **CI/CD (D9): GitHub Actions + Turborepo remote cache (free tier)** — single workflow `pr.yml` triggered on PR + push to `main`. Matrix:
  - `lint` (oxlint, monorepo-wide, Pekulo custom rules from `@pekulo/oxlint-config`)
  - `format-check` (oxfmt --check)
  - `typecheck` (`tsc --noEmit` per app + per package)
  - `test:unit` (vitest for web/packages, **bun test** for `apps/api`)
  - `test:e2e` (playwright, smoke tier on PR; full tier on main)
  - `rls-audit` (SQL probe — fails build on any user-scoped table without RLS or with policy drift — NFR-8)
  - `prisma:check` (`prisma format --check` + `prisma validate` + `prisma migrate diff --exit-code` against deployed schema)
  - `lighthouse-ci` (NFR-3 budgets)
  - `axe-a11y` (NFR-22, on representative routes)
  - **Deploy hooks**: `apps/web` → Vercel auto-deploy on `main` ; `apps/api` → Dokploy webhook running `prisma migrate deploy` then `bun run build` then container restart.
- **Test pyramid (D6):** **Vitest** (unit + integration, Web Crypto polyfill via `happy-dom`) for `apps/web` + `packages/*` ; **bun test** for `apps/api` modules (handler / service / repository / whole-module wired with real test DB) ; **Playwright** (E2E web; mobile E2E V1.5 via Maestro on Expo) ; **vitest-axe** (a11y) ; **Lighthouse CI** (perf budgets) ; **pytest** (`apps/prices`). Satisfies NFR-1/2/3/4/5/6/7/8/18/21/22. **See ADR-0002.**
- **Observability (D10): OpenTelemetry SDK as the spine.**
  - **Instrumentation:** `@opentelemetry/sdk-node` for `apps/web` server actions and route handlers ; `@opentelemetry/instrumentation-elysia` (or manual middleware) for `apps/api` ; `@opentelemetry/instrumentation-prisma` on the Prisma extended client ; `opentelemetry-instrumentation-fastapi` for `apps/prices`. Trace + log + metric pillars enabled. Vendor-neutral.
  - **Sinks (V1 (a)):** stdout (`OTLPLogExporter` to console) — sufficient for local development and personal-use phase.
  - **Sinks (b+ public):**
    - Errors → **GlitchTip** (Sentry-compatible, MIT, self-hosted on Dokploy) via OTLP. PII scrubbing enabled.
    - Logs → structured stdout collected by Vercel logs (web) + journald (api/prices/Ollama on Dokploy) ; ship to GlitchTip OTLP receiver if forensic needs arise.
    - Metrics → Prometheus scrape on `apps/api` + `apps/prices` ; Vercel native metrics on `apps/web`. Aggregated dashboards optional at (b), required at (c).
  - **LLM call audit log (NFR-26)** is a separate domain table `llm_call_log` (route*requested, route_actual, latency_ms, outcome — \_no prompt content*), retention ≤ 90 days, surfaced via Settings → IA → Journal d'activité (FR-36). Single ingestion writer = `apps/api/src/modules/llm/llm.service.ts#recordLlmCall(intent | outcome)`.
  - **See ADR-0005.**
- **Environments:** `dev` (local) + `prod` (Vercel + Dokploy). **No staging at V1 (a)** (single user). Staging branch + preview deploys promoted at (b).
- **Restore drill (NFR-21):** scheduled before (b) flip — Supabase snapshot → fresh project → re-apply Prisma migrations → assert RLS coverage + auth round-trip + an oRPC happy-path call. Result documented in `docs/security.md`.

## Phase 2b — Council Dispatches

> Two high-stakes decisions arbitrated by 4 specialists each, dispatched in parallel for convergence-resistance.

### C1 — Design system strategy (Tailwind v4 ↔ Tamagui Core)

**Framing.** PRD T2 demands "no per-app Tailwind/NativeWind divergence from V1.5". `apps/web` is currently Tailwind v4 + shadcn `base-nova` + `@base-ui/react`; the grill locked Tamagui Core (MIT) as the cross-platform substrate; UX spec is built on the existing web stack. Three options weighed: (A) status quo + V1.5 rebuild ; (B) migrate web to Tamagui _now_ ; (C) Tamagui primitives + Tailwind adapter shim.

**Specialist verdicts:**

| Specialist        | Pick | One-line rationale                                                                    |
| ----------------- | ---- | ------------------------------------------------------------------------------------- |
| Winston (Systems) | A    | Ship V1 on known tech ; retrofit cleanly at V1.5 once mobile reveals real constraints |
| Lena (Pragmatic)  | A    | Shipping > purity ; Tamagui in 2026 is solid but not zero-risk on RSC + Next 16       |
| Nina (Cost & Ops) | C    | Adapter shields from Tamagui volatility at acceptable maintenance cost                |
| Maya (Edge cases) | A    | C couples two incompatible animation runtimes ; B blocks compass                      |

**Areas of consensus.** B is **not unanimously rejected**; only A-favouring specialists rated it as "blocking V1 features 2-4 weeks = unacceptable". C is rejected by 3 out of 4 as a "graveyard trap" (long-lived adapter that will be ripped out at V1.5 anyway).

**Areas of genuine disagreement.** Nina alone defended C on the basis that the adapter shields V1 from Tamagui ecosystem volatility (RSC bugs, compiler changes). The 3 A-voters agreed the adapter ends up as dead weight at V1.5 when web also needs to migrate.

**Final pick: B — Migrate `apps/web` to Tamagui Core _now_, before V1 feature work resumes.**

**Rationale (user override against 3-1 Council).** Pekulo is in ramp stage (a) personal use — no business pressure on V1 ship date (B1 requires ≥ 60 days in production for Persona #1 before any (b) decision). Paying the design-system unification debt up-front eliminates the collision the Council unanimously flagged as the primary risk of option A: web rewrite + mobile launch landing in the same 2-week window at V1.5. The pattern aligns with prior project commitments — Tamagui Core was locked at the grill (rejecting Pro), DS discipline is recorded in the user's feedback memories (zero card borders, palette strict to monetary deltas). Accepted cost: 2–4 weeks of paused V1 feature work to land `packages/ui` on Tamagui Core before features resume.

**Minority view kept as future-pivot signal.**

- Winston (A) — _if_ the Tamagui migration takes longer than 4 weeks (compiler regressions, RSC integration bugs), pivot back to A and ship V1 on the existing Tailwind stack.
- Nina (C) — _if_ the V1 feature freeze creates business pressure (e.g. external interest forces an early (b) ramp), the C adapter shim is the fastest unblock path even though it's long-term suboptimal.
- Universal pre-flight checks before starting B: confirm `apps/ux-preview/src/App.tsx` ports cleanly to Tamagui; confirm Next 16 RSC plays with Tamagui v2 compiler in a spike; confirm Pekulo's strict palette + animation discipline survives Tamagui's theme system.

**See ADR-0007.**

### C2 — LLM routing topology

**Framing.** FR-31 specifies three transports — Apple FoundationModels (client iOS ≥ 15 Pro), Ollama self-hosted on Dokploy VPS (server-side default), 3rd-party API (Claude Haiku 4.5 or Mistral Small, opt-in only). NFR-12/13 enforce zero PII in prompts and zero 3rd-party calls without opt-in. NFR-26 + FR-36 require a unified per-call audit log surfaced to the user. Three options weighed: (A) server-side router only ; (B) client-aware router with three audit emitters ; (C) hybrid policy with single audit ingestion.

**Specialist verdicts:**

| Specialist        | Pick | One-line rationale                                                               |
| ----------------- | ---- | -------------------------------------------------------------------------------- |
| Winston (Systems) | C    | Single audit ingestion + on-device latency preserved                             |
| Raj (Security)    | A    | Server seul signe l'audit ; iOS attestation untrusted (GDPR Art. 5(1)(f))        |
| Nina (Cost & Ops) | A    | Cascade gracieuse Ollama 502, audit garanti même sur crash client                |
| Maya (Edge cases) | C    | Tolérance flakes réseau, server-side cloud-arbitration, on-device fallback clean |

**Areas of consensus.** B is unanimously rejected — three independent audit emitters guarantee schema drift, NFR-26 broken, opt-in unverifiable.

**Areas of genuine disagreement.** A vs C split 2-2 on the binding constraint:

- A wins on **audit integrity / compliance** (server is single source of truth; client cannot forge "FoundationModels" to hide a 3rd-party call).
- C wins on **on-device latency** (NFR-5 budgets 600 ms p95 for FoundationModels; synchronous attest round-trip eats 50–100 ms = 10–15 % of budget).

**Synthesis.** A and C are nearly identical in compute behaviour — in both, iOS calls FoundationModels locally and the server arbitrates Ollama-vs-3rd-party for cloud-eligible prompts. The real distinction is whether the iOS attestation POST is **synchronous** (gates the UI on network) or **async fire-and-forget** (UI shows the result immediately, audit syncs in background).

**Final pick: A\* — Server-side audit authority with async client-side attestation.**

- Server is the _authority_ for `llm_call_log`. Every cloud-eligible request (Ollama or 3rd-party) is server-initiated and server-logged with a single `intent → outcome` row pair.
- Client iOS calls FoundationModels locally and **renders the suggestion immediately** in the UI ; the attestation POST to `/api/llm/attest` is async fire-and-forget with a durably-persisted retry queue (IndexedDB) flushed on reconnect.
- Server records an _intent_ row (`requested_at`, `route_requested`) before any call ; the _outcome_ row (`completed_at`, `route_actual`, `latency_ms`, `outcome`) is appended after the call (server-initiated) or after attestation receipt (client-initiated FoundationModels). Mismatch between intent and outcome routes is flagged for forensic review (Raj's worry addressed).
- **Opt-in for 3rd-party API is checked server-side before _every_ cloud-eligible call** — never trusted from the client. DR-7 architecturally locked.
- Server returns the _actual_ route in the response payload ; the client's "iOS / Ollama / Cloud" badge mirrors the server's truth, not the client's intention (Maya's badge-truth concern addressed).
- For iOS-initiated FoundationModels calls (no server arbitration possible since the model lives on-device), the server still owns the audit log via the attestation endpoint ; the model's output is shown immediately so latency budget is preserved (Winston's concern addressed).

**Minority view kept as future-pivot signal.**

- Pure A (synchronous attest) — _if_ the async retry queue ever loses entries beyond audit tolerance (≥ 1 % drop rate), pivot to synchronous attest and accept the latency hit.
- C (server-arbitrated cloud + client-decided on-device) — equivalent in substance to A* ; if architectural diagrams later need a clearer "where does the routing decision live?" answer, label this design as C-with-async-attest. Functional behaviour is identical to A*.

**See ADR-0008.**

## Phase 3 — Implementation Patterns

> Conventions binding for every story implemented by `aped-dev` and audited by `aped-review`. Brownfield rules carried verbatim where they exist ; new rules introduced for Phase 2 + 2b decisions (Tamagui migration, Zustand, oxlint, OTel, audit trails).

### Naming Conventions

> Generic case rules (kebab-case files, PascalCase components, camelCase identifiers, SCREAMING_SNAKE_CASE constants, etc.) are enforced by `oxlint` (`unicorn/filename-case`, `new-cap`, …) — not duplicated here. This section captures only project-specific conventions oxlint cannot enforce.

**File patterns:**

| Type                         | Convention                                                                                             | Example                                                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js private folders      | `_kebab-case`                                                                                          | `_components/`, `_hooks/`, `_actions/`, `_skeletons/`                                                                                                        |
| Server Action files          | `<feature>-actions.ts` (plural, **single `'use server'` file per feature**, multiple verbs co-located) | `compose-actions.ts` (createDraft, sendDraft, deleteDraft), `auth-actions.ts` (logout, refreshSession), `compass-actions.ts` (updateCompass, archiveCompass) |
| Zod schemas                  | `camelCase` + `Schema` suffix                                                                          | `loginSchema`, `createCompassSchema`, `attestLlmCallSchema`                                                                                                  |
| Prisma model files           | `<module>.prisma` in `apps/api/prisma/schema/`                                                         | `compass.prisma`, `holdings.prisma`, `enums.prisma`, `_base.prisma`                                                                                          |
| Prisma migration directories | `<timestamp>_<verb_noun>/` (Prisma-generated)                                                          | `20260601120000_create_milestones/`                                                                                                                          |
| Test files                   | `<source>.test.ts` (unit) ; `<source>.a11y.test.tsx` (axe) ; `<journey>.spec.ts` (E2E)                 | `derive-compass.test.ts`, `pekulo-donut.a11y.test.tsx`, `j2-daily-check.spec.ts`                                                                             |

**Hook conventions** (binding ; lint-enforced via `@pekulo/oxlint-config`):

| Tier              | Convention               | Example                                                                                  |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| Query (read)      | `use<Feature><Resource>` | `useDashboardCompass`, `usePortfolioHoldings`, `useTransactionsPending`                  |
| Mutation (write)  | `use<Verb><Resource>`    | `useUpdateCompass`, `useRecordValuation`, `useConfirmCategorisation`, `useDeleteAccount` |
| Form orchestrator | `use<Feature>Form`       | `useEditCompassForm`, `useAddMilestoneForm`, `useImportTransactionsCsvForm`              |

Form orchestrators wrap TanStack Form's `useForm` together with the corresponding mutation hook. They expose `{ form, send, isSubmitting, … }`. Components consume only the orchestrator — never `useForm` directly, never the mutation hook directly when both are needed in the same form.

**Local vs Global tier** (applies to hooks, components, actions):

| Family         | Local (route-scoped)                                     | Global (cross-route)                                          |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Hooks          | `apps/web/src/app/<route>/_hooks/`                       | `apps/web/src/lib/hooks/`                                     |
| Components     | `apps/web/src/app/<route>/_components/`                  | `apps/web/src/components/` (top-level, **NOT** inside `lib/`) |
| Server Actions | `apps/web/src/app/<route>/_actions/<feature>-actions.ts` | `apps/web/src/lib/actions/<feature>-actions.ts`               |

**Boundary rule — Components ↔ Actions** (hard, lint-enforced via `no-server-action-in-component`): a component never imports a Server Action directly. It calls a custom hook (local or global) that encapsulates the action plus its UX orchestration (optimistic state, success/error toast, query invalidation, navigation, retry policy). See ADR-0010.

**Pekulo DS components** (`@pekulo/ui`): `PascalCase` with `Pekulo` prefix on top-level domain primitives (`PekuloDonut`, `PekuloHero`, `PekuloSection`, `PekuloKpiTile`, `PekuloMilestoneRow`). Sub-parts unprefixed (`Donut.Track`, `Donut.Sweep`).

**Domain TS types** (in `@pekulo/types` or apps): `PascalCase` (`Account`, `Holding`, `MonthlyRecord`, `CompassSnapshot`, `LlmCallLog`). Prefixed-ID strings typed as branded primitives (`type AccountId = string & { __brand: 'AccountId' }`).

**Domain literals** (in `@pekulo/types` or apps): `as const` arrays + inferred unions (`ACCOUNT_TYPES`, `HOLDING_KINDS`, `LLM_ROUTES = ['foundation_models', 'ollama', 'third_party'] as const`).

**Prisma model names**: `PascalCase` singular (`Account`, `Holding`, `HoldingLot`, `CompassHistory`, `RealEstateValuation`, `LlmCallLog`). Brownfield tables retained via `@@map("kpis")` ; new tables follow `plural_snake_case` (`milestones`, `real_estate`, `real_estate_valuations`).

**Prisma model columns**: `camelCase` in TS (`userId`, `valuedOn`, `routeRequested`, `routeActual`, `latencyMs`) mapped to `snake_case` in DB via `@map("user_id")` (default Prisma convention).

**Prefixed IDs** (Trafi pattern, ADR-0012): `{prefix}_{base62_21chars}` ; central config at `apps/api/src/database/id-prefixes.config.ts`. Prefixes registered for every model that has a sovereign `id` column (see Phase 2 — Data Layer table).

**oRPC routes**: kebab-case ; resource-oriented ; plural on resources ; verb in contract method, never in URL ; non-CRUD = explicit kebab verb at end (`/llm/attest`, `/transactions/import-csv`, `/sessions/revoke-all`). Versioning: `/rpc/v1/...` from day 1 ; sub-trees bumpable independently.

**Mount layout for Elysia** (apps/api):

```
/rpc/v1/auth        /rpc/v1/compass        /rpc/v1/milestones
/rpc/v1/accounts    /rpc/v1/holdings       /rpc/v1/realestate
/rpc/v1/transactions  /rpc/v1/monthly      /rpc/v1/dashboard
/rpc/v1/settings    /rpc/v1/hypothesis     /rpc/v1/llm
/health   /ready                           (Elysia-native, public)
/internal/llm/attest                       (Elysia-native private listener, JWT-verified)
```

**Zustand stores**: `apps/web/src/lib/stores/<feature>-store.ts` exporting a hook named `use<Feature>Store` (`useThemeStore`, `useTransactionFiltersStore`).

**Branches**: `<type>/<short-slug>` where `type ∈ {feat, fix, chore, docs, refactor, test, perf, ci, security, ds, llm, story}`. Story branches follow APED `story/<epic-key>-<story-key>`.

### Code Structure

**Monorepo layout** (full tree in Phase 4 ; here, the boundary contract):

```
pekulo/
├── apps/
│   ├── web/                         ← Next.js 16 PWA (consumer)
│   │   ├── src/
│   │   │   ├── app/                 ← routes ; route groups (auth) (cap)
│   │   │   │   └── <route>/
│   │   │   │       ├── _components/    ← LOCAL components (route-scoped)
│   │   │   │       ├── _hooks/         ← LOCAL hooks
│   │   │   │       ├── _actions/       ← LOCAL server actions (<feature>-actions.ts)
│   │   │   │       └── _skeletons/     ← LOCAL loading skeletons
│   │   │   ├── components/          ← GLOBAL components (cross-route)
│   │   │   ├── lib/
│   │   │   │   ├── hooks/           ← GLOBAL hooks (cross-route)
│   │   │   │   ├── actions/         ← GLOBAL server actions (<feature>-actions.ts)
│   │   │   │   ├── stores/          ← Zustand stores (<feature>-store.ts)
│   │   │   │   ├── supabase/        ← {server,client}.ts SSR + browser Auth clients
│   │   │   │   ├── orpc/            ← oRPC client init + per-module typed clients
│   │   │   │   ├── zapaction/       ← context + tag registry
│   │   │   │   └── otel/            ← {tracer,logger,meter}.ts SDK init
│   │   │   ├── proxy.ts             ← middleware (auth gate)
│   │   │   └── sw.ts                ← Service Worker (PWA, encrypted IndexedDB)
│   │   └── e2e/                     ← Playwright specs (j1-…spec.ts)
│   │
│   ├── api/                         ← Bun + Elysia HTTP service
│   │   └── src/
│   │       ├── main.ts                              (entry, top-level await)
│   │       ├── app.ts                               (Elysia + module mounts)
│   │       ├── bootstrap/
│   │       │   ├── runtime-dependencies.ts          (composition root)
│   │       │   ├── lifecycle.ts                     (startup/shutdown hooks)
│   │       │   └── readiness.ts                     (deps health probes)
│   │       ├── modules/                             (DOMAIN: factory + handler + service + repo)
│   │       │   ├── auth/      compass/   milestones/
│   │       │   ├── accounts/  holdings/  realestate/
│   │       │   ├── transactions/  monthly/  dashboard/
│   │       │   ├── settings/  hypothesis/  llm/
│   │       │   └── health/                          (Elysia-native /health, /ready)
│   │       ├── platform/                            (CROSS-CUTTING infra)
│   │       │   ├── http/                            (request-id, error-mapper, cors, bearer, rate-limit)
│   │       │   ├── logging/                         (OTel logger wrapper)
│   │       │   ├── audit/                           (audit-row helpers, no PII)
│   │       │   ├── security/                        (jwt verifier, requireUserContext helper)
│   │       │   └── observability/                   (OTel SDK init for Bun)
│   │       ├── database/
│   │       │   ├── prisma.service.ts                (Prisma client + extensions)
│   │       │   ├── prefixed-ids.extension.ts        (Trafi pattern, ADR-0012)
│   │       │   ├── id-prefixes.config.ts
│   │       │   └── index.ts
│   │       ├── config/
│   │       │   ├── runtime-config.ts
│   │       │   └── env.ts                           (Zod env validation, @pekulo/validators)
│   │       ├── prisma/
│   │       │   ├── schema/                          (multi-file schema folder)
│   │       │   │   ├── _base.prisma   enums.prisma
│   │       │   │   ├── accounts.prisma  holdings.prisma  transactions.prisma
│   │       │   │   ├── compass.prisma   realestate.prisma   llm.prisma
│   │       │   │   └── monthly.prisma   hypothesis.prisma   dashboard.prisma
│   │       │   └── migrations/                      (Prisma-generated, ADR-0014)
│   │       ├── common/                              (PURE, no I/O)
│   │       │   ├── errors/                          (PekuloError base + factories)
│   │       │   ├── time/                            (Clock abstraction + FakeClock)
│   │       │   ├── security-primitives/             (constant-time compare, masking)
│   │       │   └── ids/                             (random base62 helpers)
│   │       └── test/                                (cross-module ONLY)
│   │           ├── flows/                           (whole-module wired flows)
│   │           ├── fakes/                           (in-memory fakes shared across modules)
│   │           ├── fixtures/                        (shared test data)
│   │           └── helpers/
│   │
│   ├── prices/                      ← FastAPI Python (brownfield, unchanged)
│   └── mobile/                      ← Expo + expo-router (V1.5)
│
└── packages/                       ← R11 — folder-by-domain inside each src/ (see L770)
    ├── zod/                         ← @pekulo/zod (re-export + helpers — SSOT R1)
    ├── types/                       ← @pekulo/types (UserId, CompassSnapshot, …)
    ├── validators/                  ← @pekulo/validators (Zod schemas, camelCase + Schema suffix)
    ├── contracts/                   ← @pekulo/contracts (oRPC contracts per module)
    ├── tsconfig/                    ← @pekulo/tsconfig (base + presets)
    ├── oxlint-config/               ← @pekulo/oxlint-config (rules + Pekulo customs)
    └── ui/                          ← @pekulo/ui (Pekulo DS on Tamagui Core)
        └── src/{provider,toast,components,primitives,tokens,themes,animations,config}/
```

**Module shape — self-similar in `apps/api/src/modules/<name>/`:**

```
modules/<name>/
├── <name>.module.ts                ← createXxxModule(deps): factory, returns { router, service }
├── <name>.module.test.ts           ← whole-module wired (handler + service + repo, real test DB + fake platform)
├── <name>.handler.ts               ← oRPC handlers bound to contract from @pekulo/contracts
├── <name>.handler.test.ts          ← handler with fake service
├── <name>.service.ts               ← business logic, throws typed errors
├── <name>.service.test.ts          ← service with fakes for repo + sibling modules
├── <name>.repository.ts            ← Prisma queries, ALWAYS includes where: { userId: ctx.userId }
├── <name>.repository.test.ts       ← repository against test DB
├── <name>.errors.ts                ← typed error classes for the module (factories)
├── <name>.schema.ts                ← Zod schemas for INTERNAL boundaries (not @pekulo/validators)
└── <name>.types.ts                 ← XxxDeps + internal types
```

**Layer separation in `apps/api`:**

- `modules/` — DOMAIN modules (factories returning `{ router, service }`)
- `platform/` — CROSS-CUTTING infra (HTTP, logging, audit, security, OTel)
- `common/` — PURE utilities (no I/O, no logger, no DB, no network)
- `bootstrap/` — COMPOSITION ROOT (`runtime-dependencies.ts` wires everything)

**Import hierarchy R1** (lint-enforced via `@pekulo/oxlint-config`):

```
@pekulo/zod → @pekulo/validators → @pekulo/contracts → apps
                  ↑                                       ↓
              @pekulo/types ← apps
```

`@pekulo/types` is the only bidirectional package (apps import types ; lower packages re-export type-only definitions). All other deps flow strictly downward.

**Loading / Error / Skeleton matrix** (Pekulo routes, mirrors Bonjour pattern):

| Route                             | `loading.tsx` | `error.tsx` | `not-found.tsx` |
| --------------------------------- | ------------- | ----------- | --------------- |
| `/` (landing/redirect)            | ❌            | ❌          | —               |
| `/(auth)/login`                   | ❌            | ❌          | —               |
| `/(auth)/signup`                  | ❌            | ❌          | —               |
| `/(auth)/callback`                | ✅            | ✅          | —               |
| `/(auth)/recover`                 | ✅            | ✅          | —               |
| `/(cap)/dashboard`                | ✅            | ✅          | —               |
| `/(cap)/transactions`             | ✅            | ✅          | —               |
| `/(cap)/transactions/[id]`        | ✅            | ✅          | ✅              |
| `/(cap)/mensuel`                  | ✅            | ✅          | —               |
| `/(cap)/portefeuille`             | ✅            | ✅          | —               |
| `/(cap)/portefeuille/[holdingId]` | ✅            | ✅          | ✅              |
| `/(cap)/immobilier`               | ✅            | ✅          | —               |
| `/(cap)/immobilier/[propertyId]`  | ✅            | ✅          | ✅              |
| `/(cap)/parametres`               | ✅            | ✅          | —               |
| root                              | —             | —           | ✅              |

**Module / layer boundaries (binding):**

- **Hard layering on the web tier**: Component → Custom Hook → Server Action (`<feature>-actions.ts`, `'use server'`) → oRPC client → Elysia handler → service → repository → Prisma. Never skip a tier. Lint-enforced via `no-server-action-in-component`.
- **`'use server'` files are grouped per feature** (not per verb) ; multiple verbs co-located in a single `<feature>-actions.ts` file.
- **No cross-feature action imports**: `compose-actions.ts` MUST NOT import from `auth-actions.ts`. Cross-feature work goes via the global hooks layer or is exposed as a separate oRPC contract method. Lint-enforced via `no-cross-feature-action-import`.
- **Repository layer** — every Prisma query touching a user-scoped table includes `where: { userId: ctx.userId, … }`. Lint-enforced via `no-prisma-query-without-user-id`.
- **`@pekulo/ui` is the sole styling surface** for `apps/web` and `apps/mobile` after the ADR-0007 Tamagui migration completes. `tailwindcss` import outside `@pekulo/ui` is forbidden (oxlint rule `no-tailwind-outside-ui`).
- **Zustand never mirrors server state** — React Query owns server state, Zustand owns client cross-component state, `useState`/`useReducer` own component-local. A value lives in exactly one layer.
- **Audit tables append-only**: `compass_history`, `real_estate_valuations`, `llm_call_log` carry no `UPDATE`/`DELETE` RLS policies ; deletion only via cascade from `auth.users`.

**Import conventions:**

- TypeScript path aliases via `@pekulo/tsconfig` presets at workspace boundaries (`@pekulo/ui`, `@pekulo/types`, `@pekulo/contracts`, `@pekulo/validators`, `@pekulo/zod`). No deep relatives beyond `../../`.
- Import order: `import "server-only"` (when applicable) → external → `@pekulo/*` → internal → type-only.
- Public API of `packages/*` exported via `src/index.ts` only.

**Test file locations & naming:**

- Unit: `<source>.ts` + `<source>.test.ts` co-located.
- Module-level (`apps/api`): `<name>.module.test.ts`, `<name>.handler.test.ts`, `<name>.service.test.ts`, `<name>.repository.test.ts` per Trafi shape.
- Integration (`apps/web`): `apps/web/src/lib/__tests__/integration/<feature>.test.ts`.
- A11y: `<component>.a11y.test.tsx` co-located in `@pekulo/ui`.
- E2E: `apps/web/e2e/<journey>.spec.ts` ; one spec file per PRD User Journey (J1–J9).
- Lighthouse budget: `apps/web/lighthouserc.json`.
- Cross-module flows: `apps/api/src/test/flows/<flow>.test.ts` (whole-API wired against real test DB).

### Communication Patterns

**Error format (uniform end-to-end):**

- **`apps/api` services** throw typed domain errors extending a base class:
  ```ts
  class PekuloError extends Error {
    code: string;
    cause?: unknown;
  }
  ```
  Concrete subclasses per module (factories in `<name>.errors.ts`): `CompassError`, `MilestoneError`, `HoldingsError`, `RealEstateError`, `TransactionsError`, `LlmRoutingError`, `LlmOptInError`, `PriceProviderError`, `RlsViolationError`, `MigrationError`, `UnauthorizedError`.
- **Elysia error mapper** (`platform/http/error-mapper.ts`) converts thrown errors to oRPC error responses with stable `{ code, message, requestId? }`. 4xx errors carry `code + message` ; 5xx errors carry `code + requestId` (the OTel `trace_id`, for forensic cross-reference).
- **oRPC client on `apps/web`** receives typed errors decoded from the contract.
- **Server action wrappers** (`<feature>-actions.ts`) re-throw to zapaction unchanged ; React Query consumers see typed errors.
- **Custom hooks** translate typed errors to UX (toast / error boundary / form field error).
- **Repository layer** wraps Prisma errors via `prisma-error-mapper.ts` → `RlsViolationError` on `P2025` if the row didn't match the userId guard, etc.
- **`<ErrorBoundary>`** + toast component live in `@pekulo/ui` ; consumed in route groups.

**Logging format & levels:**

- OTel SDK in each runtime ; structured attributes per event ; vendor-neutral (ADR-0005).
- Levels: `debug` (dev only), `info`, `warn`, `error`.
- **Mandatory attributes on every server-side log**: `trace_id`, `span_id`, `user_id_hash`, `route` (or `module.method` for oRPC handlers).
- **Forbidden in any log**: raw `userId`, `email`, `account_number`, `prompt_content`, JWT, secret. Lint grep guard in CI.
- Email masking helper: `maskEmail("f***@bonjour.email")` — used wherever a user-identifier surface is shown (admin tooling, error pages with email-of-record).
- Client-side: only `warn` and `error` emitted to OTel (volume control). `debug` and `info` stay in browser DevTools.
- **Prisma queries** logged via `@opentelemetry/instrumentation-prisma` — query SQL captured at `debug` level only (PII scrubbing disabled in dev, enabled in prod).

**Event / message patterns:**

- **LLM call** (ADR-0008): `intent → outcome` row pair in `llm_call_log`. `apps/api`-initiated calls (Ollama, 3rd-party API) emit both rows in the service. iOS-initiated FoundationModels calls emit `intent` + `outcome` together from the `/internal/llm/attest` handler. Single writer = `apps/api/src/modules/llm/llm.service.ts#recordLlmCall`.
- **Compass updates** (FR-2): write to `hypotheses` + insert into `compass_history` within the same Prisma `$transaction`.
- **Real-estate valuation updates** (FR-27): same pattern with `real_estate` + `real_estate_valuations`.
- **Cache invalidation**: React Query keys + zapaction tag registry are the **only** client-side event channels. No custom EventEmitter / pub-sub. New mutation hooks declare their invalidation tags at hook definition (matches PR template).
- **Spans**: every Elysia handler binds `span = tracer.startSpan('module.<name>.<method>')` ; every server action emits `span = tracer.startSpan('action.<feature>.<verb>')` ; nested operations inherit parent context automatically via OTel context propagation.
- **Service Worker → main thread**: `postMessage` with versioned payloads `{ type, version, …data }` ; consumers ignore unknown versions (forward compat).
- **Bearer token propagation**: `apps/web` server actions extract the Supabase session JWT from cookies, forward as `Authorization: Bearer <jwt>` on every oRPC call to `apps/api`. The `apps/api` `requireUserContext()` helper verifies via `SUPABASE_JWT_SECRET`.

### Process Rules

**Branch naming:** `<type>/<short-slug>` per Naming Conventions.

**Commit messages:** Conventional Commits — `<type>(<scope>): <subject>`. `scope` = feature folder name (`compass`, `realestate`, `llm`, `ds`, `api`, `web`). 72-char hard limit on subject. Co-author footer when Claude-assisted.

**PR requirements (every PR, every author including Persona #1):**

- All CI checks green: `lint` (oxlint with `@pekulo/oxlint-config`), `format-check` (oxfmt --check), `typecheck` (per app + per package), `test:unit` (vitest for web/packages, **bun test** for `apps/api`), `test:e2e:smoke` (playwright), `rls-audit`, `prisma:check`, `lighthouse-ci` (when `apps/web` changes), `axe-a11y` (when `@pekulo/ui` changes).
- Linked story file referenced in PR body (`story/<epic-key>/<story-key>.md`).
- Squash-merge to `main` ; merge commit message = PR title.
- Self-review via `aped-review` acceptable at V1 (a) ; external reviewer required at (b) ramp.

**Test coverage rules:**

- **`apps/api/src/modules/<name>/<name>.service.ts`** + pure helpers: 100 % branch coverage.
- **`<name>.repository.ts`**: at least 1 happy-path + 1 RLS-isolation test (call from another `userId` returns empty/404).
- **`<name>.handler.ts`**: at least 1 happy + 1 `UnauthorizedError` test.
- **`<name>.module.test.ts`**: whole-module wired against a real test DB (Postgres in Docker) + fake platform deps.
- **`apps/web/src/lib/hooks/<feature>-hooks.ts`** mutation orchestrators: 1 happy + 1 error-translation test (renders the right toast for each error code).
- **`@pekulo/ui` components**: 1 visual snapshot + 1 vitest-axe a11y spec per public component.
- **E2E**: every PRD User Journey (J1–J9) has at least 1 Playwright spec before V1 (a) ships.

**Pre-commit (lefthook):**

- `oxlint --fix --staged` (with `@pekulo/oxlint-config`)
- `oxfmt --staged`
- `gitleaks detect --staged --no-banner`
- `prisma format` if a `*.prisma` file is staged

**Schema migration discipline (Prisma — ADR-0014):**

- Every schema-touching PR includes a Prisma migration generated by `prisma migrate dev --name <verb_noun>` (forward-only).
- Manual edits to the baseline collapse migration are forbidden after merge.
- Every new user-scoped table includes 4 RLS policies appended manually to the migration SQL (Prisma does not introspect policies). Audit tables (`compass_history`, `real_estate_valuations`, `llm_call_log`) include only INSERT + SELECT policies (append-only enforcement).
- The `rls-audit` CI job re-asserts policy coverage after every migration deploy ; build fails otherwise (NFR-8).
- The `prisma:check` job runs `prisma format --check`, `prisma validate`, and `prisma migrate diff --exit-code` against the deployed schema.

**Prefixed-IDs discipline:**

- Every new model registered in `apps/api/src/database/id-prefixes.config.ts` BEFORE the first migration.
- Prefix collision check : the `id-prefixes.config.test.ts` asserts every prefix is unique.
- Wire-format docs reference `{prefix}_{base62}` everywhere a userId is shown ; OTel logs use `userId` (Supabase UUID) for `user_id_hash` derivation, but domain-row IDs in logs/audit MUST carry their prefix.

**Tamagui migration discipline (in force until ADR-0007 epic completes):**

- No new Tailwind utility classes in `apps/web/src/app/**` ; all new UI lives in `@pekulo/ui`.
- Migration tracked as a sequence of stories under epic `ds-tamagui-migration` (sequenced by aped-story).
- Each migration story includes a visual-snapshot diff vs. proto reference (`docs/ux-preview/`) ; deviations require explicit ADR amendment.
- Pre-flight spikes (Tamagui ↔ Next 16 RSC ; proto port ; WCAG contrast) MUST land before any feature story resumes.

**State-management boundary rule (Zustand vs RQ vs local):**

- A value lives in exactly one layer. Mirroring is a review fail.
- New Zustand store PR includes a one-line justification for _why_ the value is not in RQ (server) or `useState` (local).

**Hooks-orchestration boundary (ADR-0010, lint-enforced):**

- Components NEVER import a `<feature>-actions.ts` file directly. Lint rule `no-server-action-in-component` blocks the import.
- Components NEVER import TanStack Form's `useForm` directly when a mutation is in scope ; they consume `use<Feature>Form` orchestrators.
- New mutation flows ship hook + action together (single PR) ; reviewer checks orchestrator covers optimistic state, toast, invalidation tags, navigation.

**Cross-feature isolation (lint-enforced):**

- A `<feature>-actions.ts` file MUST NOT import from another `<feature>-actions.ts`. Lint rule `no-cross-feature-action-import` blocks the import. Cross-feature work goes through global hooks layer or a separate oRPC contract method.

**Repository userId-guard (lint-enforced):**

- Every Prisma query inside `apps/api/src/modules/**/*.repository.ts` that touches a user-scoped model includes `where: { userId: ctx.userId, … }`. Lint rule `no-prisma-query-without-user-id` blocks omissions. Edge cases (global lookup tables) handled via explicit-allow comments.

**Server-action file grouping:**

- One `<feature>-actions.ts` file per feature ; multiple verbs co-located. Single `'use server'` directive at the top.
- `compose-actions.ts` carries `createDraft`, `sendDraft`, `deleteDraft`, `undoSend` together. `compass-actions.ts` carries `updateCompass`, `archiveCompass`, etc.
- Splitting one verb to its own file is a review fail (cohesion broken).

**Secret discipline:**

- Pre-commit `gitleaks` blocks accidental commits (no exceptions).
- All `NEXT_PUBLIC_*` vars are anon / surface keys only.
- `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET` live ONLY in Dokploy env ; physically absent from `apps/web` env files.
- `DATABASE_URL` (Prisma direct connection) lives ONLY in Dokploy env.
- `PRICES_SERVICE_TOKEN` rotated at the (b) flip ; rotation procedure documented in `docs/security.md`.

**LLM call discipline:**

- Server-side opt-in check before _every_ cloud-eligible call (DR-7) — `apps/api/src/modules/llm/llm.service.ts` calls `requireOptIn(ctx.userId)` before any 3rd-party API hit.
- Prompt builder helper enforces the 2 kb cap + zero-PII allowlist (`{label, amount, currency, date, optional merchant}`) — NFR-12. Prompt construction outside the helper is forbidden (lint rule + code review).
- Every `llm_call_log` insert goes through `recordLlmCall(intent | outcome)` ; direct Prisma `llmCallLog.create` calls forbidden outside the LLM service.

**Observability discipline:**

- Every new Elysia handler emits a span named `module.<name>.<method>` (matches the oRPC route).
- Every new server action emits a span named `action.<feature>.<verb>`.
- Logging the `prompt_content`, raw `user_id`, `email`, `account_number`, JWT, or any secret is forbidden ; CI grep guards the rule (fails the build on match).

### Audit-derived conventions (2026-05-20 — PR #86)

These rules were ratified during the archi-deadcode audit pass after multiple sub-agents kept reaching for the wrong primitive (raw TanStack, direct `zod` imports, pre-exported clients without an api route). They were always implicit ; codifying them here means the next agent who reads this file before touching code can't miss them.

**R1 — `@pekulo/zod` is the sole zod entry point (amends ADR-0011).**

- No file under `packages/*` or `apps/*` is allowed to `import { z } from "zod"` (or any zod export) directly. Every consumer goes through `@pekulo/zod`.
- `@pekulo/zod` re-exports zod and (incrementally) ships the Pekulo helpers (Money, EuroAmount, IsoDate, Percent, tabularNum). Consumers won't need a second migration when the helpers land.
- The direct `zod` dependency MUST NOT appear in `apps/web/package.json`, `apps/api/package.json`, or `packages/validators/package.json`. Each declares `@pekulo/zod: workspace:*` instead.
- Future enforcement: a custom oxlint rule (`pekulo/no-direct-zod-import`) tracks this — pre-rule, knip flags violations.

**R2 — `@pekulo/types` and `@pekulo/validators` are correctly layered (re-affirmed).**

- `@pekulo/validators` consumes `@pekulo/zod` and exports Zod schemas + their inferred types. Apps that need a schema (input parsing, action `defineAction({ input })`) consume validators.
- `@pekulo/types` consumes `@pekulo/validators` for inferred types AND adds UI-only types (no schemas). Apps that only need a type for prop typing consume types.
- Apps consume EITHER package depending on what they need. The dependency `@pekulo/types → @pekulo/validators` is intentional, not a back-dep mistake. Reviewers MUST NOT flag it.

**R3 — ZapAction is the only allowed React-Query consumer in `apps/web` hooks.**

- Every hook under `apps/web/src/app/**/_hooks/` MUST consume actions via `useActionQuery` / `useActionMutation` from `@zapaction/query` (or `useAction` from `@zapaction/react` for imperative flows).
- Direct `useQuery` / `useMutation` from `@tanstack/react-query` is **BANNED** in hooks. Reviewers MUST treat this as a hard fail.
- `useQueryClient` from `@tanstack/react-query` is **ONLY** allowed inside `onMutate` / `onError` / `onSettled` of `useActionMutation` for the documented optimistic-update recipe (R9).
- The single legitimate `@tanstack/react-query` import outside a hook is the `QueryClient` + `QueryClientProvider` boot in `apps/web/src/components/providers.tsx`.

**R4 — Tag registry centralises invalidation ; hooks never invalidate manually.**

- Cross-feature invalidation maps live in `apps/web/src/lib/zapaction/keys.ts` via `setTagRegistry({...})`. Each action declares its tags ; the registry resolves tags → query keys.
- Reads MUST pass `readPolicy: "read-only"` to `useActionQuery` ; mutations rely on `invalidateOnSuccess: true` (default) to fire the tag registry.
- Manual `queryClient.invalidateQueries({ queryKey })` in a hook body is a review fail — it bypasses the registry and creates orphan invalidation paths.

**R5 — oRPC client export policy (D2 finding).**

- `apps/web/src/lib/orpc/modules.ts` exports ONLY clients whose router is actually mounted in `apps/api/src/bootstrap/runtime-dependencies.ts#orpcRouter`.
- As of the audit, the api mounts 5 modules: `hypothesis`, `compass`, `milestones`, `accounts`, `holdings`. The exported clients track that exact list.
- Each story that lands a new api module re-adds its client here in the same PR. Pre-exporting a client whose route isn't mounted yet causes runtime 404s and dead exports — review fail.

**R6 — Tag registry forward-pointer policy (D3 finding).**

- `lib/zapaction/keys.ts` registers only keys + tags whose consumer hook AND mounted api route both exist. Forward-pointer registry edges (`monthlyTags.all() → monthlyKeys.list()`) fire no-op invalidations — keep them out until the consuming story lands.
- Module-key constants (e.g. `HOLDINGS_KEY`) stay file-local (`const`, no `export`) unless an external consumer actually needs them.

**R7 — `@pekulo/ui` barrel discipline (H3 finding — amends ADR-0007).**

- `packages/ui/src/provider/` is the single client boundary (mounts `NextThemeProvider` + `TamaguiProvider` + toast viewport). It MUST NOT import from `packages/ui/src/components/`.
- If the provider needs a UI piece (toast, modal root, error boundary mount point), that piece lives in its OWN sibling top-level dir — never under `components/`.
- Current sibling layout: `provider/`, `toast/`, `components/`, `primitives/`, `tokens/`, `themes/`, `animations/`, `config/`. Each module self-contained ; the public `src/index.ts` barrel re-exports each once.
- Rationale: `components/` is a barrel of Pekulo\* domain components. The day one of them legitimately needs the provider, an A↔B barrel cycle closes — pre-empt by keeping the dependency direction one-way.

**R8 — Visibility default is `unexported` ; `export` requires a justification.**

- Types, functions, and consts consumed only inside their defining file MUST NOT be `export`-ed. `export` widens the public API surface and is the wrong default.
- Audit-corrected examples (do not re-introduce as exports): `ReadinessProbe`, `ReadinessReport`, `BoursoramaQuote`, `TwelveDataQuote`, `YahooQuote`, `OrpcErrorBody`, `ORPC_HTTP_STATUS_BY_CODE`, `PlaceholderVariant`, `deriveAvantages`, `deriveDepensesTotales`, `HOLDINGS_KEY`.
- Knip-driven re-scan periodically catches new violations (`bunx knip --reporter symbols` — config kept in agent workflows).

**R9 — Optimistic mutation recipe with ZapAction.**

- The supported optimistic pattern uses `useQueryClient` inside `useActionMutation`:
  - `onMutate(input)`: `await queryClient.cancelQueries({ queryKey })` → snapshot via `queryClient.getQueryData` → optimistic `queryClient.setQueryData(updater)` → return `{ previous }` context.
  - `onError(err, input, ctx)`: surgical restore from `ctx.previous` (per-row rollback, not blanket overwrite, so concurrent mutations don't resurrect each other's deletes).
  - Trust the tag registry for the success path — NO manual `onSettled` invalidate.
- Envelope `{ ok: false, code, message }` returns are DATA, not errors. The tag registry still invalidates on success (the action didn't throw) ; the no-op refetch on a `false-ok` response is an acceptable cost for a single coherent pattern across simple and optimistic mutations.

**R10 — Aggregate-root Prisma layout exception (amends ADR-0012).**

- ADR-0012 ("one `.prisma` file per Elysia domain module") is enforced module-by-module, BUT carves an exception for aggregates that share a root entity.
- Concrete example: `apps/api/prisma/schema/accounts.prisma` declares `Account`, `Holding`, and `HoldingLot` together because `Account` is the aggregate root for the holdings sub-aggregate. There is intentionally no `holdings.prisma` even though `apps/api/src/modules/holdings/` exists.
- New aggregate clusters that share a root MUST be co-located in a single `.prisma` file. Splitting an aggregate across files creates relation-resolution pain (Prisma cross-file `@relation` refs require client codegen flag + extra mental overhead).
- Reviewers MUST NOT flag a missing `<module>.prisma` if the module's tables live in an aggregate-root file under a different name.

**R11 — Folder-by-domain layout for every workspace package.**

Every `packages/<pkg>/src/` follows the same structure:

```
packages/<pkg>/src/
├── index.ts                       (aggregate barrel — re-exports each domain)
├── <domain>/
│   ├── <domain>.<suffix>.ts       (the actual code ; suffix = .schemas / .contract / .types / .tsx / .helpers / etc.)
│   ├── <domain>.<suffix>.test.ts  (tests co-located)
│   ├── __snapshots__/             (vitest snapshots, if any)
│   └── index.ts                   (domain barrel — `export * from "./<domain>.<suffix>"`)
└── <other-domain>/…
```

Concrete suffix conventions per package (match the apps/api `modules/<n>/<n>.{service,repository,routes}.ts` pattern):

- `@pekulo/validators` → `<domain>/<domain>.schemas.ts`
- `@pekulo/contracts` → `<domain>/<domain>.contract.ts`
- `@pekulo/types` → `<domain>/<domain>.types.ts`
- `@pekulo/ui` components → `components/PekuloX/PekuloX.tsx` (+ `PekuloX.a11y.test.tsx`, `PekuloX.snapshot.test.tsx`)

Rules:

- The aggregate `src/index.ts` MUST re-export every domain via `export * from "./<domain>"` (or named re-exports for surface-control, see contracts) — consumers always import from the package root, never from a domain barrel directly across package boundaries.
- Cross-domain imports inside a package use the domain barrel: `from "../accounts"`, not `from "../accounts/accounts.schemas"`. The implementation file inside the folder stays a refactor-private detail.
- Adding a new domain = new folder + new `index.ts` + new `<domain>.<suffix>.ts`. Editing the aggregate barrel is the only top-level edit ; reviewers MUST refuse a "flat file at the package root" addition.
- Test files live in the same folder as the source they cover. Snapshots live in `__snapshots__/` inside the same folder so vitest's relative resolution keeps working.

This was ratified after the audit pass surfaced flat-file growth in three packages (validators, types, contracts) that made cross-domain navigation needlessly costly. Restructured in PR #86 commit dfaa280 (validators + types + contracts) and ec8115e (ui components — 38 components × 4 files).

**Audit lessons baked into agent prompts:**

- Always check the actual branch state before flagging missing files. Realestate models were flagged "CRITICAL missing" by a sub-agent on `main` even though they were in flight on `feature/24-4-1-realestate-domain`. The branch-aware reading is in the audit checklist now.
- Knip false-positives are systemic for: lint-rule machinery (`packages/oxlint-config/src/rules/*.js`), Tamagui runtime resolution (`react-native-web`, `@tamagui/web`), Next.js / Prisma generated artifacts (`@generated/prisma/client`), and module-level config imports (`tsconfig#extends` for `@pekulo/tsconfig`). Verify with grep before deleting flagged deps or files.
- "Delete" is the last-resort move when something looks orphan. Default action is **relocate to the canonical home** — schemas to `@pekulo/validators`, UI types to `@pekulo/types`, forward-pointer scaffolds keep their forward-pointer location (with a header comment documenting why). The audit pass deleted six files that should have been relocated and had to re-author them in commit 26b367f.

## Phase 4 — Structure & Mapping

> Concrete file layout, FR-to-file mapping, integration surfaces, and shared-code inventory. Every FR-ID from the PRD lands in a specific file ; every external system has an explicit boundary owner.

### Directory Tree

```
pekulo/
├── apps/
│   │
│   ├── web/                                          ← Next.js 16 App Router PWA on Vercel
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── layout.tsx                        Root + providers (Tamagui, RQ, Zustand boot, OTel)
│   │   │   │   ├── page.tsx                          / Landing → redirect to /dashboard or /login
│   │   │   │   ├── manifest.ts                       PWA manifest (FR-53)
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/{page,_components,_hooks,_actions}/    FR-46
│   │   │   │   │   ├── signup/{page,_components,_hooks,_actions}/   FR-45
│   │   │   │   │   ├── callback/{page,loading,error}/               FR-46 (Supabase OAuth-style cb)
│   │   │   │   │   └── recover/{page,loading,error,_actions}/       FR-48 password reset
│   │   │   │   └── (cap)/
│   │   │   │       ├── dashboard/{page,loading,error,_components,_hooks,_skeletons}/   FR-41-44, FR-1-8
│   │   │   │       ├── transactions/{page,loading,error,_components,_hooks,_actions}/   FR-28-36
│   │   │   │       │   └── [id]/{page,loading,error,not-found}/                          drill-down
│   │   │   │       ├── mensuel/{page,loading,error,_components,_hooks,_actions}/        FR-37-40
│   │   │   │       ├── portefeuille/{page,loading,error,_components,_hooks,_actions}/   FR-13-20
│   │   │   │       │   └── [holdingId]/{page,loading,error,not-found}/
│   │   │   │       ├── immobilier/{page,loading,error,_components,_hooks,_actions}/     FR-21-27
│   │   │   │       │   └── [propertyId]/{page,loading,error,not-found}/
│   │   │   │       └── parametres/{page,loading,error,_components,_hooks,_actions}/     FR-34, FR-36, FR-49-52, FR-57
│   │   │   ├── components/                          ← GLOBAL components (ErrorBoundary, ToastContainer, ContextualAddButton)
│   │   │   ├── lib/
│   │   │   │   ├── hooks/                           ← GLOBAL cross-route hooks
│   │   │   │   │   ├── use-current-user.ts
│   │   │   │   │   ├── use-theme-preference.ts
│   │   │   │   │   └── use-llm-opt-in.ts
│   │   │   │   ├── actions/                         ← GLOBAL server actions
│   │   │   │   │   ├── auth-actions.ts              logout, refreshSession (FR-47)
│   │   │   │   │   ├── settings-actions.ts          updateTheme, updateLang, exportData, deleteAccount (FR-49-52)
│   │   │   │   │   └── llm-attest-actions.ts        proxies to /internal/llm/attest from web (rare path)
│   │   │   │   ├── stores/
│   │   │   │   │   ├── theme-store.ts               useThemeStore (FR-51)
│   │   │   │   │   ├── lang-store.ts                useLangStore (FR-52)
│   │   │   │   │   ├── transactions-filters-store.ts
│   │   │   │   │   └── compose-draft-store.ts
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── server.ts                    SSR Supabase client (Auth only)
│   │   │   │   │   ├── client.ts                    Browser Supabase client (Auth only)
│   │   │   │   │   └── jwt.ts                       extract session JWT for forwarding to apps/api
│   │   │   │   ├── orpc/
│   │   │   │   │   ├── client.ts                    oRPC client init pointing to apps/api
│   │   │   │   │   └── modules.ts                   per-module typed clients (auth, compass, holdings, …)
│   │   │   │   ├── zapaction/
│   │   │   │   │   ├── context.ts                   ActionContext factory (resolves session JWT)
│   │   │   │   │   └── keys.ts                      RQ keys + tag registry
│   │   │   │   ├── llm/
│   │   │   │   │   └── attest-queue.ts              IndexedDB-persisted retry queue (ADR-0008)
│   │   │   │   └── otel/
│   │   │   │       └── tracer.ts                    ← only tracer ships V1 (a) ; logger/meter land alongside the GlitchTip wire-up at (b) ramp.
│   │   │   ├── proxy.ts                             middleware (Supabase auth gate, NFR-9)
│   │   │   └── sw.ts                                Service Worker (FR-54, ADR-0003)
│   │   ├── e2e/                                     ← Playwright specs (j1-…spec.ts → j9-…spec.ts)
│   │   ├── lighthouserc.json                        Lighthouse CI budgets (NFR-3)
│   │   └── package.json
│   │
│   ├── api/                                         ← Bun + Elysia HTTP service on Dokploy
│   │   └── src/
│   │       ├── main.ts                              entry, top-level await
│   │       ├── app.ts                               Elysia + module mounts + plugin chain
│   │       ├── bootstrap/
│   │       │   ├── runtime-dependencies.ts          composition root (deps DI)
│   │       │   ├── lifecycle.ts                     startup/shutdown hooks
│   │       │   └── readiness.ts                     deps health probes (/ready)
│   │       ├── modules/
│   │       │   ├── auth/                            FR-45-48 (Supabase wrapping for /rpc/v1/auth)
│   │       │   ├── compass/                         FR-1-8 + compass_history audit
│   │       │   ├── milestones/                      FR-3, FR-4, FR-6, FR-8
│   │       │   ├── accounts/                        FR-9-12
│   │       │   ├── holdings/                        FR-13-20 + lots subcomponent
│   │       │   ├── realestate/                      FR-21-27 + valuations audit
│   │       │   ├── transactions/                    FR-28-30, FR-33, FR-37-38 (CSV import)
│   │       │   ├── llm/                             FR-31-36 + audit log + opt-in + /internal/llm/attest
│   │       │   ├── monthly/                         FR-37-40
│   │       │   ├── dashboard/                       FR-41-44 (read-aggregator)
│   │       │   ├── settings/                        FR-49-52 (export, delete, theme/lang persist)
│   │       │   ├── hypothesis/                      FR-57-59
│   │       │   └── health/                          /health, /ready (Elysia-native, public)
│   │       ├── platform/
│   │       │   ├── http/{request-id, error-mapper, cors, bearer, rate-limit}.ts
│   │       │   ├── logging/otel-logger.ts           OTel logger wrapper (NFR-25-26)
│   │       │   ├── audit/audit-row.ts               masked-userId, no-PII helpers
│   │       │   ├── security/
│   │       │   │   ├── jwt-verifier.ts              SUPABASE_JWT_SECRET verify
│   │       │   │   ├── require-user-context.ts      ctx = { userId, email, jwtClaims }
│   │       │   │   └── opt-in-guard.ts              requireOptIn(userId) for 3rd-party LLM (DR-7)
│   │       │   └── observability/
│   │       │       ├── otel-sdk.ts                  @opentelemetry/sdk-node init
│   │       │       └── prisma-instrumentation.ts    @opentelemetry/instrumentation-prisma
│   │       ├── database/
│   │       │   ├── prisma.service.ts                PrismaPg adapter + extension chain (ADR-0012)
│   │       │   ├── prefixed-ids.extension.ts        Trafi pattern, ADR-0012
│   │       │   ├── id-prefixes.config.ts            Record<ModelName, prefix>
│   │       │   ├── prisma-error-mapper.ts           P2025 → RlsViolationError, etc.
│   │       │   └── index.ts
│   │       ├── config/
│   │       │   ├── runtime-config.ts
│   │       │   └── env.ts                           Zod env validation (consumes @pekulo/validators)
│   │       ├── prisma/
│   │       │   ├── schema/
│   │       │   │   ├── _base.prisma                 datasource + generators + previewFeatures
│   │       │   │   ├── enums.prisma                 AccountType, HoldingKind, TransactionType, LotType, LlmRoute, MilestoneStatus, PropertyType
│   │       │   │   ├── accounts.prisma              Account, brownfield @@map("accounts")
│   │       │   │   ├── holdings.prisma              Holding, HoldingLot, brownfield @@map
│   │       │   │   ├── transactions.prisma          Transaction, brownfield @@map
│   │       │   │   ├── compass.prisma               CompassHistory (Hypothesis carries compass via brownfield)
│   │       │   │   ├── milestones.prisma            Milestone (new)
│   │       │   │   ├── realestate.prisma            RealEstate, RealEstateRental, RealEstateValuation (all new)
│   │       │   │   ├── llm.prisma                   LlmCallLog, LlmOptIn (new)
│   │       │   │   ├── monthly.prisma               MonthlyTracking, brownfield @@map("monthly_tracking")
│   │       │   │   ├── hypothesis.prisma            Hypothesis, brownfield @@map("hypotheses") + objectif/horizon_years (compass)
│   │       │   │   ├── kpis.prisma                  Kpi, brownfield @@map("kpis")
│   │       │   │   └── dashboard.prisma             (read-only view definitions if any)
│   │       │   └── migrations/                      Prisma-generated forward-only (ADR-0014)
│   │       ├── common/
│   │       │   ├── errors/
│   │       │   │   ├── pekulo-error.ts              base class
│   │       │   │   └── factories.ts                 createUnauthorizedError, createRlsViolationError, etc.
│   │       │   ├── time/
│   │       │   │   ├── clock.ts                     Clock interface
│   │       │   │   └── fake-clock.ts                test-time control
│   │       │   ├── security-primitives/
│   │       │   │   ├── constant-time-compare.ts
│   │       │   │   └── mask-email.ts                f***@bonjour.email
│   │       │   └── ids/
│   │       │       ├── random-base62.ts             21-char base62 generator (Trafi pattern)
│   │       │       └── request-id.ts                UUID v7 for request correlation
│   │       └── test/
│   │           ├── flows/                           cross-module wired flows (J1-J9 mapping where API touches multiple modules)
│   │           ├── fakes/
│   │           │   ├── fake-clock.ts
│   │           │   ├── fake-prices-client.ts
│   │           │   ├── fake-llm-providers.ts        FoundationModels / Ollama / 3rd-party fakes
│   │           │   └── fake-supabase-jwt.ts
│   │           ├── fixtures/
│   │           │   ├── persona-1-snapshot.ts        Alex's data shape for tests
│   │           │   └── csv-imports/                 sample CSV blobs
│   │           └── helpers/
│   │               ├── test-db.ts                   Postgres-in-Docker setup
│   │               └── test-elysia.ts               in-memory Elysia for handler tests
│   │
│   ├── prices/                                      ← FastAPI Python (brownfield, unchanged)
│   │   ├── main.py                                  /health, /quote, /quotes
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   └── mobile/                                      ← Expo + expo-router (V1.5)
│       └── (V1.5 detailed in a future revision)
│
├── packages/                                        ← R11 — folder-by-domain (each src/ has `index.ts` + `<domain>/<domain>.<suffix>.ts` + `<domain>/index.ts`)
│   ├── zod/                                         @pekulo/zod — SSOT zod entry point (R1)
│   │   └── src/index.ts                             re-export of zod ; Money/EuroAmount/IsoDate/Percent/tabularNum land in a follow-up story
│   ├── types/                                       @pekulo/types
│   │   └── src/                                     domain folders : shared/, account/, holding/, transaction/, milestone/, monthly/, realestate/, composition/, stat/, compass/
│   │       └── <domain>/<domain>.types.ts           e.g. `account/account.types.ts` (AccountType, AccountCardItem, Account re-export from validators)
│   ├── validators/                                  @pekulo/validators
│   │   └── src/                                     domain folders : accounts/, compass/, holdings/, hypothesis/, milestones/, monthly/, transactions/ (Epic 4 lands realestate/)
│   │       └── <domain>/<domain>.schemas.ts         Zod source of truth + inferred types
│   ├── contracts/                                   @pekulo/contracts
│   │   └── src/                                     domain folders : auth/, compass/, milestones/, accounts/, holdings/, realestate/, transactions/, llm/, monthly/, dashboard/, settings/, hypothesis/, bank-aggregator/ (added 2026-05-25 per ADR-0015)
│   │       └── <domain>/<domain>.contract.ts        oRPC contract for the module (`<module>ContractV1`, `<module>Contract` alias, `<module>ContractMeta`)
│   ├── tsconfig/                                    @pekulo/tsconfig
│   │   └── {base,apps,packages,next}.json
│   ├── oxlint-config/                               @pekulo/oxlint-config
│   │   └── src/{index,rules/{no-server-action-in-component,no-cross-feature-action-import,no-prisma-query-without-user-id,no-tailwind-outside-ui}}.ts
│   └── ui/                                          @pekulo/ui (Pekulo DS on Tamagui Core, ADR-0007)
│       └── src/
│           ├── provider/                            single client boundary — NextThemeProvider + TamaguiProvider + toast viewport (R7)
│           ├── toast/                               ToastProvider, PekuloToast, PekuloToastViewport (sibling of provider/ to avoid A↔B barrel cycle — R7)
│           ├── tokens/                              ported from docs/ux-preview/src/tokens/
│           ├── themes/{pekulo-dark,pekulo-light}.ts
│           ├── animations/                          useCountUp, useStagger
│           ├── primitives/                          Section, Stack, Text, Pressable
│           ├── config/                              tamagui.config.ts
│           └── components/                          R11 — each Pekulo* component in its own folder:
│                                                    `components/PekuloX/PekuloX.tsx` + `PekuloX.a11y.test.tsx` + `PekuloX.snapshot.test.tsx` + `index.ts`.
│                                                    PekuloAccountRow, PekuloAccountsSection, PekuloActivityRow, PekuloClassRow,
│                                                    PekuloCompositionCard, PekuloCompositionRow, PekuloContextualAddButton,
│                                                    PekuloCountUpEUR, PekuloCountUpPct, PekuloDonut, PekuloDonutCard,
│                                                    PekuloEmptyState, PekuloErrorBoundary, PekuloHero, PekuloHeroCard,
│                                                    PekuloHoldingRow, PekuloHypothesisCard, PekuloHypothesisVerdict,
│                                                    PekuloKpiTile, PekuloMilestoneRow, PekuloMilestonesCard,
│                                                    PekuloMobileBottomNav, PekuloMonthlyRow, PekuloNavRail,
│                                                    PekuloProjectionChart, PekuloPropertyCard, PekuloRecentActivityCard,
│                                                    PekuloSegmentedControl, PekuloSettingRow, PekuloSkeleton,
│                                                    PekuloStaggerList, PekuloStat, PekuloSuggestionRow, PekuloToggleRow,
│                                                    PekuloTopTabToggle, PekuloTrajectoryCard, PekuloTrajectoryChart,
│                                                    PekuloUserDot.
│
├── docs/                                            ← APED artefacts (this folder)
├── turbo.json                                       Turborepo task graph
├── bun.lock                                         Bun monorepo lockfile
├── package.json                                     workspaces glob {apps,packages}/*
├── lefthook.yml                                     pre-commit hooks (oxlint, oxfmt, gitleaks, prisma format)
└── .github/workflows/pr.yml                         CI matrix (lint, format, typecheck, test, e2e, rls-audit, prisma:check, lighthouse, axe)
```

### FR → File Mapping

> Every PRD FR ID lives in a sovereign location. The `apps/api` module owns business logic ; `apps/web` owns presentation + orchestration via hooks/server-actions.

#### Group A — Compass & Milestones (V1 differentiator)

| FR   | Definition (PRD)                                | API module                                                                                                                            | Web surface                                                                                                                                             |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-1 | Declare compass (target capital + horizon year) | `apps/api/src/modules/compass/compass.{handler,service,repository}.ts` (uses `Hypothesis` brownfield row)                             | `apps/web/src/app/(cap)/parametres/_components/compass-edit-form.tsx` + `_hooks/use-edit-compass-form.ts` + `_actions/compass-actions.ts#updateCompass` |
| FR-2 | Edit compass with audit trail                   | `compass.service.ts#updateCompass` writes to `Hypothesis` + `CompassHistory` in `prisma.$transaction`                                 | same UX as FR-1 ; history panel in `parametres/_components/compass-history-panel.tsx`                                                                   |
| FR-3 | Add up to 20 milestones                         | `apps/api/src/modules/milestones/milestones.{handler,service,repository}.ts`                                                          | `apps/web/src/app/(cap)/dashboard/_components/milestones-section.tsx` + `add-milestone-form.tsx`                                                        |
| FR-4 | Reorder/edit/delete milestones                  | `milestones.service.ts#{reorder,update,delete}`                                                                                       | same as FR-3                                                                                                                                            |
| FR-5 | Compute compass progress (1 decimal %)          | `apps/api/src/modules/compass/compass.service.ts#computeProgress` (pure helper from `apps/api/src/common/derive/compass-progress.ts`) | `dashboard/_hooks/use-dashboard-compass.ts` (RQ query)                                                                                                  |
| FR-6 | Per-milestone status {ahead, on-track, behind}  | `milestones.service.ts#computeStatuses` (pure helper)                                                                                 | rendered in `PekuloMilestoneRow`                                                                                                                        |
| FR-7 | Compass-progress curve                          | `dashboard.service.ts#getCompassCurve` aggregates (uses `KpiSnapshot` history)                                                        | `dashboard/_components/trajectory-section.tsx` + `PekuloTrajectoryChart`                                                                                |
| FR-8 | Compass-incomplete state                        | `compass.service.ts#getSetupState` returns `'incomplete'` if no milestone                                                             | `dashboard/_components/compass-setup-cta.tsx` rendered conditionally                                                                                    |

#### Group B — Accounts (brownfield extended)

| FR    | Definition                                                         | API module                                                           | Web surface                                                                     |
| ----- | ------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| FR-9  | Create account                                                     | `apps/api/src/modules/accounts/accounts.service.ts#create`           | `(cap)/parametres/_components/accounts-section.tsx` + `account-create-form.tsx` |
| FR-10 | Edit / delete account (deletion blocked if holdings/tx referenced) | `accounts.service.ts#{update,delete}` enforces FK guard              | `account-edit-form.tsx`, `account-delete-confirm.tsx`                           |
| FR-11 | Manual cash-balance change with date                               | `accounts.service.ts#recordBalanceChange`                            | `account-balance-form.tsx`                                                      |
| FR-12 | List user's accounts (RLS enforced)                                | `accounts.repository.ts#findByUser` (with `where: { userId }` guard) | `(cap)/dashboard?tab=patrimoine` `_components/accounts-list.tsx`                |

#### Group C — Holdings & Portfolio

| FR    | Definition                                                   | API module                                                                                                                                                                                         | Web surface                                              |
| ----- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------- | --- |
| FR-13 | Create holding (ticker, kind, currency, account)             | `apps/api/src/modules/holdings/holdings.service.ts#create`                                                                                                                                         | `(cap)/portefeuille/_components/holding-create-form.tsx` |
| FR-14 | Record buy/sell lots                                         | `holdings.service.ts#recordLot`                                                                                                                                                                    | `_components/lot-form.tsx`                               |
| FR-15 | Derive quantity + WAC from lots                              | `apps/api/src/common/derive/holding-quantity.ts` (pure)                                                                                                                                            | called via `holdings.service.ts#getDerivedHolding`       |
| FR-16 | 4-tier price chain                                           | `apps/api/src/modules/holdings/holdings.service.ts#resolveQuote` calls `services/prices-client.ts` (HTTP to `apps/prices`) → fallback to `yahoo-finance2` (npm) → Boursorama scraper → Twelve Data | n/a (server side only)                                   |
| FR-17 | 60 s in-memory quote cache                                   | `apps/api/src/modules/holdings/holdings.cache.ts` (Map keyed by `ticker                                                                                                                            | kind                                                     | currency`) | n/a |
| FR-18 | FX-adjusted EUR snapshot, fallback 1:1 with `fxSource` field | `apps/api/src/common/derive/portfolio-fx.ts` (port of brownfield `derive-portfolio-fx.ts`)                                                                                                         | `(cap)/portefeuille/_hooks/use-portfolio-snapshot.ts`    |
| FR-19 | Per-holding unrealised PnL (holding ccy + EUR)               | `apps/api/src/common/derive/holding-pnl.ts`                                                                                                                                                        | `PekuloHoldingRow`                                       |
| FR-20 | Mark holding closed (preserve lots)                          | `holdings.service.ts#close`                                                                                                                                                                        | `holding-close-confirm.tsx`                              |

#### Group D — Real-estate (V1 new)

| FR    | Definition                                                 | API module                                                                                            | Web surface                                             |
| ----- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| FR-21 | Create property (label, type, valuation, last-valued date) | `apps/api/src/modules/realestate/realestate.service.ts#createProperty`                                | `(cap)/immobilier/_components/property-create-form.tsx` |
| FR-22 | Attach mortgage                                            | `realestate.service.ts#attachMortgage`                                                                | `mortgage-form.tsx`                                     |
| FR-23 | Attach rental block                                        | `realestate.service.ts#attachRental`                                                                  | `rental-form.tsx`                                       |
| FR-24 | Derive monthly cash-flow                                   | `apps/api/src/common/derive/rental-cashflow.ts`                                                       | shown on `PekuloPropertyCard`                           |
| FR-25 | Derive net equity                                          | `apps/api/src/common/derive/property-equity.ts`                                                       | shown on `PekuloPropertyCard`                           |
| FR-26 | Include net equity in compass total wealth                 | `dashboard.service.ts#computeTotalWealth` (consumes realestate equity)                                | n/a                                                     |
| FR-27 | Update valuation with audit trail                          | `realestate.service.ts#recordValuation` writes `RealEstate` + `RealEstateValuation` in `$transaction` | `valuation-update-form.tsx`                             |

#### Group E — Transactions & LLM categorisation

| FR    | Definition                                                        | API module                                                                                                                                                                 | Web surface                                                                                                |
| ----- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --- |
| FR-28 | Record transaction (date, amount, type, category, account, label) | `apps/api/src/modules/transactions/transactions.service.ts#create`                                                                                                         | `(cap)/transactions/_components/transaction-form.tsx`                                                      |
| FR-29 | CSV bulk import (preview before persist)                          | `transactions.service.ts#importCsv` (handler `/transactions/import-csv`)                                                                                                   | `_components/csv-import-form.tsx` + `csv-preview-table.tsx` + `_hooks/use-import-transactions-csv-form.ts` |
| FR-30 | Rule-based transfer detection (bypass LLM)                        | `apps/api/src/common/derive/transfer-rule.ts` (pure) called by `transactions.service.ts#categorise`                                                                        | n/a                                                                                                        |
| FR-31 | LLM routing policy                                                | `apps/api/src/modules/llm/llm.service.ts#route` (returns `{route, providerCall}`)                                                                                          | `transactions/_components/suggestion-row.tsx` shows `route_actual` badge                                   |
| FR-32 | LLM suggestion + confidence                                       | `llm.service.ts#categorise` returns `{category, confidence}`                                                                                                               | `PekuloSuggestionRow`                                                                                      |
| FR-33 | Accept/override suggestion                                        | `transactions.service.ts#confirmCategorisation` (override wins)                                                                                                            | `_hooks/use-confirm-categorisation.ts`                                                                     |
| FR-34 | Opt-in toggle for 3rd-party LLM                                   | `apps/api/src/modules/settings/settings.service.ts#updateLlmOptIn` writes `LlmOptIn` row                                                                                   | `(cap)/parametres/_components/llm-opt-in-toggle.tsx`                                                       |
| FR-35 | Per-call audit (no prompt content)                                | `llm.service.ts#recordLlmCall(intent                                                                                                                                       | outcome)` is the sole writer                                                                               | n/a |
| FR-36 | View 90-day LLM activity log                                      | `llm.repository.ts#findByUserSince`                                                                                                                                        | `(cap)/parametres/_components/llm-activity-log.tsx`                                                        |
| FR-60 | Connect bank via Bridge Connect widget (OAuth + SCA)              | `apps/api/src/modules/bank-aggregator/bank-aggregator.{handler,service,repository}.ts#initiateConnection` + `services/bridge-client.ts` (`BankProvider` impl per ADR-0015) | `(cap)/parametres/_components/bank-connections-section.tsx` + `bank-connect-redirect.tsx`                  |
| FR-61 | Cron-refresh bank transactions (dedup on provider + tx_id)        | `bank-aggregator.service.ts#refreshAll` (Bun scheduled task) + `transactions.service.ts#importFromProvider`                                                                | n/a (background)                                                                                           |
| FR-62 | View, rename, revoke bank connections                             | `bank-aggregator.service.ts#{listConnections,rename,revoke}` + Bridge token revoke API                                                                                     | `bank-connection-row.tsx` + `bank-connection-rename-form.tsx` + `bank-connection-revoke-confirm.tsx`       |
| FR-63 | Surface SCA-required + reconnect CTA (90-day refresh)             | `bank-aggregator.service.ts#getConnectionState` + Bridge webhook handler on `ITEM_SCA_REQUIRED` (`/internal/bridge/webhook`)                                               | `bank-connection-row.tsx` SCA badge + `bank-reconnect-button.tsx`                                          |

#### Group F — Monthly tracking (brownfield)

| FR    | Definition                                               | API module                                                                  | Web surface                                  |
| ----- | -------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| FR-37 | Record monthly aggregates                                | `monthly.service.ts#record`                                                 | `(cap)/mensuel/_components/monthly-form.tsx` |
| FR-38 | Derive aggregates from categorised tx (default override) | `apps/api/src/common/derive/monthly-aggregates.ts` (port of brownfield)     | `mensuel/_hooks/use-monthly-aggregates.ts`   |
| FR-39 | Sign off month (immutable freeze)                        | `monthly.service.ts#signOff` (sets `signedOffAt`, blocks UPDATE in service) | `_components/sign-off-button.tsx`            |
| FR-40 | Re-open signed month with confirmation                   | `monthly.service.ts#reopen`                                                 | `_components/reopen-confirm.tsx`             |

#### Group G — Dashboard & KPIs

| FR    | Definition                                                                          | API module                                                                                                    | Web surface                                                               |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| FR-41 | Dashboard first viewport: total wealth + compass % + next milestone delta           | `dashboard.service.ts#getOverview` (read-aggregator)                                                          | `(cap)/dashboard/_components/{hero-block,donut-card,milestones-card}.tsx` |
| FR-42 | One-tap navigation to detail pages                                                  | `apps/web/src/app/(cap)/{transactions,mensuel,portefeuille,immobilier}/page.tsx` reachable from dashboard nav | `PekuloNavRail` (lg) + bottom nav (mobile)                                |
| FR-43 | Total wealth = cash + FX-adjusted holdings + net real-estate equity                 | `dashboard.service.ts#computeTotalWealth` aggregates accounts + holdings + realestate                         | n/a                                                                       |
| FR-44 | Cache-invalidation registry refreshes dashboard after any wealth-affecting mutation | `apps/web/src/lib/zapaction/keys.ts` (tag registry) + RQ keys ; mutation hooks declare invalidation tags      | every mutation hook documents tags                                        |

#### Group H — Auth, settings, lifecycle

| FR    | Definition                                   | API module                                                                                                                | Web surface                                                                                |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| FR-45 | Sign up email + 12-char password             | Supabase Auth (web direct) ; `apps/api/src/modules/auth/auth.service.ts#postSignupHook` syncs profile row if needed       | `(auth)/signup/page.tsx` + `_hooks/use-signup-form.ts` + `_actions/auth-actions.ts#signUp` |
| FR-46 | Login email + password (SSR cookie session)  | Supabase Auth (web direct)                                                                                                | `(auth)/login/page.tsx` + `_actions/auth-actions.ts#logIn`                                 |
| FR-47 | Logout from any page (invalidate session)    | Supabase Auth ; `auth-actions.ts#logout`                                                                                  | `components/user-menu.tsx` (global)                                                        |
| FR-48 | Password reset via email link                | Supabase Auth                                                                                                             | `(auth)/recover/page.tsx`                                                                  |
| FR-49 | One-action JSON export                       | `apps/api/src/modules/settings/settings.service.ts#exportData` (streams JSON conforming to `docs/exports/schema-v1.json`) | `parametres/_components/export-data-row.tsx` + `_hooks/use-export-data.ts`                 |
| FR-50 | Cascade account deletion < 60 s              | `settings.service.ts#deleteAccount` (Prisma cascade via FK + Supabase Auth user erase)                                    | `_components/delete-account-confirm.tsx`                                                   |
| FR-51 | Theme switch {dark, light, system} persisted | `settings.service.ts#updateTheme` writes to user prefs row ; mirrored client-side via `useThemeStore` (Zustand persist)   | `parametres/_components/theme-segmented-control.tsx`                                       |
| FR-52 | Language switch {fr, en} persisted           | `settings.service.ts#updateLang` ; `useLangStore` mirror                                                                  | `parametres/_components/lang-segmented-control.tsx`                                        |

#### Group I — PWA, mobile, design system

| FR    | Definition                                                      | Surface                                                                                                   |
| ----- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| FR-53 | Install affordance (PWA on iOS/Android home screen)             | `apps/web/src/app/manifest.ts` + `apps/web/public/icons/*` + `apps/web/src/components/install-prompt.tsx` |
| FR-54 | Offline read-only on dashboard/portefeuille/immobilier          | `apps/web/src/sw.ts` (encrypted IndexedDB scoped per userId, ADR-0003)                                    |
| FR-55 | Single styling primitive layer from V1.5 (`@pekulo/ui` Tamagui) | `@pekulo/ui` consumed by `apps/web` and `apps/mobile` — lint rule `no-tailwind-outside-ui` enforces       |
| FR-56 | Visual parity web ↔ mobile via per-component snapshot           | `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx` + Maestro mobile snapshot suite (V1.5)        |

#### Group J — Hypotheses & projections (brownfield)

| FR    | Definition                                                        | API module                                                           | Web surface                                                           |
| ----- | ----------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| FR-57 | Record hypothesis (compass + monthly contribution + assumed rate) | `apps/api/src/modules/hypothesis/hypothesis.service.ts#record`       | `(cap)/parametres/_components/hypothesis-form.tsx`                    |
| FR-58 | Project future wealth curve                                       | `apps/api/src/common/derive/projection-curve.ts` (pure)              | `dashboard/_components/hypothesis-card.tsx` + `PekuloProjectionChart` |
| FR-59 | Compare projection vs cap-required                                | `dashboard.service.ts#getHypothesisGap` returns `{ gapEurPerMonth }` | `PekuloHypothesisVerdict`                                             |

### Integration Boundaries

> Every external system has exactly one owning surface ; secrets and rate limits are bound to that owner.

| External system                                           | Owner                                                             | Boundary file(s)                                                                      | Auth mechanism                                                                                    | Failure mode                                                                            |
| --------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Supabase Auth**                                         | `apps/web` (direct)                                               | `apps/web/src/lib/supabase/{server,client}.ts`                                        | anon key in `NEXT_PUBLIC_*` ; SSR cookie session                                                  | redirect to `/login` via `proxy.ts` middleware                                          |
| **Supabase Postgres**                                     | `apps/api` (sole consumer)                                        | `apps/api/src/database/prisma.service.ts` (PrismaPg adapter, port 5432, service-role) | `DATABASE_URL` in Dokploy env                                                                     | `prisma-error-mapper.ts` → typed errors ; data readers fallback to safe defaults        |
| **Apple FoundationModels**                                | `apps/mobile` (V1.5, client-side)                                 | `apps/mobile/src/llm/foundation-models-client.ts`                                     | iOS framework, no key                                                                             | fall back to oRPC `/llm/categorise` (server route Ollama)                               |
| **Ollama**                                                | `apps/api/src/modules/llm/providers/ollama-client.ts`             | localhost-bound on Dokploy ; not exposed publicly                                     | none (internal)                                                                                   | timeout → fall back to 3rd-party (only if opt-in true) ; else surface `LlmRoutingError` |
| **3rd-party LLM API** (Claude Haiku 4.5 or Mistral Small) | `apps/api/src/modules/llm/providers/third-party-client.ts`        | `THIRD_PARTY_LLM_API_KEY` in Dokploy env ; opt-in gated server-side                   | rate-limit → mark request as failed in `llm_call_log` ; UI surfaces "categorisation indisponible" |
| **`apps/prices`** (FastAPI)                               | `apps/api/src/modules/holdings/services/prices-client.ts`         | internal Docker network ; Bearer `PRICES_SERVICE_TOKEN`                               | Tier-1 fallback chain to `yahoo-finance2`                                                         |
| **Yahoo Finance** (`yahoo-finance2`)                      | `apps/api/src/modules/holdings/services/yahoo-client.ts`          | npm SDK, no key                                                                       | Tier-2 fallback to Boursorama                                                                     |
| **Boursorama** (HTML scraping)                            | `apps/api/src/modules/holdings/services/boursorama-scraper.ts`    | none                                                                                  | Tier-3 fallback to Twelve Data                                                                    |
| **Twelve Data**                                           | `apps/api/src/modules/holdings/services/twelve-data-client.ts`    | `TWELVE_DATA_API_KEY` in Dokploy env (free tier 800 req/day)                          | Tier-4 ; on full-chain failure throws `PriceProviderError.attempts`                               |
| **frankfurter.app** (FX)                                  | `apps/api/src/modules/holdings/services/frankfurter-client.ts`    | none                                                                                  | fallback to 1:1 in `derive/portfolio-fx.ts` ; recorded in snapshot via `fxSource`                 |
| **Vercel**                                                | `apps/web` deploy target                                          | `vercel.json` + Vercel project secrets                                                | n/a                                                                                               | Vercel auto-rollback on failed deploy                                                   |
| **Dokploy VPS**                                           | `apps/api` + `apps/prices` + Ollama deploy target                 | `apps/api/Dockerfile` + `apps/prices/Dockerfile` + Caddy config                       | Dokploy webhook                                                                                   | Dokploy auto-restart on container crash ; Caddy 502 → `apps/web` retry queue            |
| **GlitchTip** ((b)+)                                      | `apps/api/src/platform/observability/otel-sdk.ts` (OTLP exporter) | self-hosted on Dokploy                                                                | `GLITCHTIP_DSN` in Dokploy env                                                                    | OTel SDK retries with backoff ; fail-open (logs to stdout)                              |
| **GitHub Actions**                                        | CI/CD owner                                                       | `.github/workflows/pr.yml`                                                            | `GITHUB_TOKEN` (auto) ; secrets via repo settings                                                 | failed check blocks merge                                                               |
| **Supabase backups**                                      | Operational owner                                                 | external Supabase dashboard                                                           | dashboard credentials                                                                             | NFR-21 restore drill before (b) flip                                                    |

### Shared Code Inventory

> Reusable across apps/packages. Promotion rule: a utility lands in shared code on its **second** consumer (not the first — premature DRY trap).

#### `@pekulo/zod` — primitive helpers

- `Money` — Zod `z.number().int().nonnegative()` for cents
- `EuroAmount` — `Money` branded `EuroAmount`
- `Percent` — `z.number().min(0).max(1)` (0–1 range)
- `IsoDate` — `z.string().date()` (YYYY-MM-DD)
- `tabularNum(n)` — formatter using `Intl.NumberFormat` with `tabular-nums` (matches UX spec section 2.2)

#### `@pekulo/types` — branded primitives + domain types

- IDs: `UserId`, `AccountId`, `HoldingId`, `HoldingLotId`, `TransactionId`, `MilestoneId`, `RealEstateId`, `LlmCallLogId` (all `string & { __brand: 'X' }`)
- Domain: `CompassSnapshot`, `MilestoneStatus`, `LlmRoute = 'foundation_models' | 'ollama' | 'third_party'`, `PortfolioSnapshotFx`, `PriceQuote`, `MonthlyRecord`, `HypothesisProjection`, `LlmCallIntent`, `LlmCallOutcome`
- Re-exports of Prisma-generated types where appropriate (`Account`, `Holding`, …)

#### `@pekulo/validators` — Zod schemas (camelCase + `Schema` suffix)

- One file per module mirroring `apps/api/src/modules/<name>/`
- `createCompassSchema`, `updateCompassSchema`, `createMilestoneSchema`, `recordValuationSchema`, `attestLlmCallSchema`, `confirmCategorisationSchema`, `importCsvSchema`, `signupSchema`, `loginSchema`, `recoverSchema`, `exportDataSchema`, `deleteAccountSchema`, `updateThemeSchema`, `updateLangSchema`, `updateLlmOptInSchema`
- Env schemas (`webEnvSchema`, `apiEnvSchema`, `pricesEnvSchema`)

#### `@pekulo/contracts` — oRPC contracts

- One contract per Elysia module: `authContract`, `compassContract`, `milestonesContract`, `accountsContract`, `holdingsContract`, `realestateContract`, `transactionsContract`, `llmContract`, `monthlyContract`, `dashboardContract`, `settingsContract`, `hypothesisContract`, `bankAggregatorContract` (added 2026-05-25 per ADR-0015). Mount paths follow the same all-lowercase no-separator convention: `/rpc/v1/realestate` (not `/rpc/v1/real-estate`), `/rpc/v1/bankaggregator` (not `/rpc/v1/bank-aggregator`) — the database tables remain snake_case for SQL but the contract surface is uniform across the 13 modules.
- Each contract bumpable independently (sub-tree versioning per Phase 2 — API Design)

#### `@pekulo/ui` — Pekulo DS (Tamagui Core)

- All Pekulo\* components listed in Directory Tree above ; consumed by `apps/web` and `apps/mobile` (V1.5)
- Tokens, themes, primitives ported from `docs/ux-preview/`

#### `apps/api/src/common/` — pure helpers (no I/O)

- `errors/{pekulo-error,factories}.ts` — base class + per-module factories
- `time/{clock,fake-clock}.ts` — Clock abstraction for testable time-dependent logic
- `security-primitives/{constant-time-compare,mask-email}.ts` — masking + timing-safe comparisons
- `ids/{random-base62,request-id}.ts` — base62 generator (Trafi pattern), UUID v7 for request correlation
- `derive/` — **shared computation helpers** consumed by multiple modules:
  - `compass-progress.ts` (FR-5)
  - `holding-quantity.ts` (FR-15)
  - `portfolio-fx.ts` (FR-18)
  - `holding-pnl.ts` (FR-19)
  - `rental-cashflow.ts` (FR-24)
  - `property-equity.ts` (FR-25)
  - `monthly-aggregates.ts` (FR-38)
  - `projection-curve.ts` (FR-58)
  - `transfer-rule.ts` (FR-30)

#### `apps/api/src/platform/` — cross-cutting infra

- `http/{request-id,error-mapper,cors,bearer,rate-limit}.ts`
- `logging/otel-logger.ts`
- `audit/audit-row.ts`
- `security/{jwt-verifier,require-user-context,opt-in-guard}.ts`
- `observability/{otel-sdk,prisma-instrumentation}.ts`

#### `apps/api/src/database/` — Prisma layer

- `prisma.service.ts` — extended client, lifecycle hooks
- `prefixed-ids.extension.ts` — Trafi-pattern `$extends`
- `id-prefixes.config.ts` — central prefix registry
- `prisma-error-mapper.ts` — Prisma errors → typed `PekuloError` subclasses

#### `apps/web/src/lib/` — web-tier shared

- `supabase/{server,client,jwt}.ts` — Auth surfaces only
- `orpc/{client,modules}.ts` — oRPC client init + per-module typed clients
- `zapaction/{context,keys}.ts` — ActionContext + RQ tag registry
- `llm/attest-queue.ts` — IndexedDB durable retry queue (ADR-0008)
- `otel/{tracer,logger,meter}.ts` — OTel SDK init
- `stores/{theme,lang,transactions-filters,compose-draft}-store.ts` — Zustand stores

#### `apps/web/src/components/` — global UI components (NOT in `lib/`)

- `error-boundary.tsx` (consumes `@pekulo/ui` `PekuloErrorBoundary`)
- `toast-container.tsx`
- `user-menu.tsx`
- `install-prompt.tsx`
- `contextual-add-button.tsx`

## Phase 5 — Validation

> Final coherence + self-review pass. All gates passed 2026-05-03 ; user accepted via final A/C gate `[C]`.

### Coherence checklist

- [x] **All technology decisions work together** — Prisma + Elysia + oRPC + zapaction (web bridge) + Tamagui + OTel cohabitation explicit in Phase 2 sections + ADR-0009 ; no double-stack conflict.
- [x] **Every FR/NFR has implementation path** — oracle confirmed 59 FRs referenced ; NFR citations across Phase 2 + Phase 3.
- [x] **Security requirements addressed** — RLS defense-in-depth (ADR-0013), JWT verification, server-side opt-in (DR-7), prompt-builder helper enforcing zero-PII (NFR-12), gitleaks pre-commit, lint customs (`no-prisma-query-without-user-id`, `no-server-action-in-component`).
- [x] **Scale requirements supported** — `apps/api` on Dokploy with vertical scaling, Prisma direct connection 5432 (long-running), React Query caching + tag registry, per-user Elysia rate-limit plugin, cursor-based pagination.
- [x] **No orphan decisions** — every choice cites FR/NFR/DR.

### Self-review checklist

- [x] **Placeholder lint** — `bash .aped/scripts/lint-placeholders.sh docs/architecture.md` exit 0.
- [x] **Oracle pass** — `OK arch oracle: 59 FRs referenced; all components have Owner+Tech stack; all ADR fields filled` (exit 0).
- [x] **FR implementation paths** — 59/59 FRs mapped in Phase 4 § FR → File Mapping with verbatim FR-IDs.
- [x] **No conflicting decisions** — Phase 2 internally consistent ; ADR-0006 explicitly marked `superseded by ADR-0014`.
- [x] **Council minority views recorded** — C1 (Winston / Lena / Maya = A, Nina = C) and C2 (Winston / Maya = C, Raj / Nina = A) ; pivot conditions documented per dispatch.
- [x] **Frontmatter coherent** — `current_subphase: done` after this step ; 6 subphases in `completed_subphases`.

### Final stats

- **Technology decisions**: 50+ across Phase 2 (11 brownfield reaffirmations + 10 Pile B mid-stakes + 3 user additions oxfmt / oxlint / OTel + 2 Council picks).
- **Council dispatches**: 2 (C1 DS strategy, C2 LLM routing) ; 4 specialists each, all in parallel.
- **ADRs**: 14 written (13 active + ADR-0006 superseded by ADR-0014).
- **Validation gaps**: 0.

## Watch Items

> Risks worth surveillance during V1 build and at the (b) ramp flip. Each carries a pivot condition lifting it to a higher-priority decision.

- **W1 — `oxfmt` is alpha (pre-1.0)** — pin a known-good version ; audit on every bump ; revert to Prettier if a rule change breaks the codebase. _(ADR-0004)_
- **W2 — Tamagui Core ↔ Next 16 RSC integration** — pre-flight spike MUST land before any feature story resumes ; if the compiler emits "use client" everywhere or RSC context serialisation breaks, pivot back to A (status quo + V1.5 rebuild). _(ADR-0007)_
- **W3 — Async LLM attestation queue drop rate** — instrument `attest-queue.ts` for queue-flush success rate ; if drops exceed 1 % over a rolling 7-day window, pivot to synchronous attestation (pure A) and accept the latency hit. _(ADR-0008)_
- **W4 — Ollama VPS RAM headroom** — Ollama with a 7B model needs 5–8 GB ; current Dokploy spec to be measured before opening signup ; vertical scaling budget (€20 → €35/mo) stays under B3 ceiling. _(C2 Council, Nina)_
- **W5 — Custom oxlint rules in `@pekulo/oxlint-config`** — `no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`, `no-tailwind-outside-ui` ship as JS rules ; each rule must have its own test fixture set ; rule changes audited.
- **W6 — Prisma `prismaSchemaFolder` is a preview feature** — monitor Prisma release notes ; if removed or breaking-changed before stable promotion, fall back to a single `schema.prisma` with stricter file ordering discipline.
- **W7 — Tamagui Core ecosystem 2026** — track v3 RC announcements ; if compiler regressions or community drift appear, ADR-0007 pivot conditions activate (back to A).

## Residual Gaps

> Known unresolved questions that DO NOT block V1 (a) but require explicit decision before their respective trigger phase.

- **G1 — `apps/mobile` detailed structure deferred to V1.5** — Expo + expo-router skeleton + Tamagui native consumer + Maestro E2E suite ; out of scope for V1 architecture, in scope for V1.5 architecture revision (`aped-arch` re-run before V1.5 mobile work begins).
- **G2 — PSD2 / open-banking connectivity (Powens / Bridge)** — V2+ deferred per DR-9 ; ADR required at decision time covering AISP licence vs agent-of relationship ; not in scope for V1 / V1.5.
- **G3 — Crypto module depth (manual vs exchange API vs xpub tracking)** — V1.5+ scoped grill required per `grill-summary.md` deferred items ; manual entry only at V1 (DR-10 keeps Pekulo out of MiCA CASP perimeter).

## Epic Zero — Foundation Stories

> Stories that MUST land before V1 feature work resumes. They establish the package layout, tooling, and runtime substrate that every subsequent story consumes. Sequenced as a single epic `epic-0-foundations` for `aped-epics` to consume.

- **E0.1 — Packages reorg under `@pekulo/*`** — create `packages/{zod, types, validators, contracts, tsconfig, oxlint-config, ui}` workspaces with placeholder exports + Bun workspace bootstrap. (ADR-0011)
- **E0.2 — oxc adoption** — install `oxlint` + `oxfmt` ; remove `eslint-config-next` ; remove ad-hoc Prettier ; wire pre-commit (lefthook) and CI matrix entries. (ADR-0004)
- **E0.3 — `apps/api` scaffold** — Bun + Elysia entrypoint + `bootstrap/runtime-dependencies.ts` + `app.ts` mount layout + `health` module + `platform/{http,security,observability}` skeletons + Dockerfile + Dokploy mount via Caddy. (ADR-0009)
- **E0.4 — Prisma 7.8.0 setup** — `apps/api/prisma/schema/{_base,enums}.prisma` + `@prisma/adapter-pg` + `prefixed-ids.extension.ts` (Trafi pattern) + `id-prefixes.config.ts` (Pekulo prefix table) + baseline migration collapsing brownfield `apps/web/supabase-schema.sql`. (ADR-0012, ADR-0014)
- **E0.5 — `@pekulo/contracts` oRPC scaffold** — one contract per Elysia module ; sub-tree per module under `/rpc/v1/*` ; client init in `apps/web/src/lib/orpc/`.
- **E0.6 — zapaction ↔ oRPC bridge wiring** — refactor existing `apps/web/src/lib/zapaction/` so server actions become thin `'use server'` wrappers calling the oRPC client ; first migration target = a single existing brownfield module to validate the pattern. (ADR-0009)
- **E0.7 — OTel SDK init in three runtimes** — `apps/web` (`@opentelemetry/sdk-node`), `apps/api` (Elysia + Prisma instrumentations), `apps/prices` (`opentelemetry-instrumentation-fastapi`) ; stdout exporter for V1 (a). (ADR-0005)
- **E0.8 — GitHub Actions `pr.yml`** — full matrix (lint, format-check, typecheck, test:unit, test:e2e:smoke, rls-audit, prisma:check, lighthouse-ci, axe-a11y) + Turborepo remote cache + per-app deploy hooks (Vercel + Dokploy webhook).
- **E0.9 — Tamagui pre-flight spike** — Next 16 RSC integration spike + proto `App.tsx` port spike + WCAG 2.2 AA contrast preservation spike ; gate to E0.10 kickoff. (ADR-0007 pre-flight checks)
- **E0.10 — `@pekulo/ui` Tamagui DS migration** — port `docs/ux-preview/src/tokens/` into Tamagui themes ; build Pekulo\* primitives + components matching UX spec catalog ; visual snapshot suite ; vitest-axe a11y suite. Sequenced as a sub-epic by `aped-story`. (ADR-0007)
- **E0.11 — Pre-commit + secret discipline** — lefthook config (`oxlint --fix --staged`, `oxfmt --staged`, `gitleaks detect --staged`, `prisma format` on `*.prisma`) ; documented onboarding steps in `apps/web/README.md` and `apps/api/README.md`.
- **E0.12 — Custom oxlint rules in `@pekulo/oxlint-config`** — implement and ship `no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`, `no-tailwind-outside-ui` ; rule fixtures + tests ; CI gate.

After E0.\* ships, `aped-epics` may schedule the V1 feature epics: `compass-and-milestones`, `real-estate`, `llm-categorisation`, `crypto-holdings`, `pwa-offline`, `gdpr-flows` (and the brownfield reaffirmations: `accounts`, `holdings-extended`, `transactions-extended`, `monthly-tracking-extended`, `hypothesis-extended`).
