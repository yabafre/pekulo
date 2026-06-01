# Epics & Stories — Pekulo

**Generated:** 2026-05-03
**Source PRD:** docs/prd.md
**Source Architecture:** docs/architecture.md
**Source UX:** docs/ux/

## Requirements Inventory

### Functional Requirements

- Group A — Compass & Milestones: FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8
- Group B — Accounts: FR-9, FR-10, FR-11, FR-12
- Group C — Holdings & Portfolio: FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20
- Group D — Real-estate: FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27
- Group E — Transactions & LLM categorisation: FR-28, FR-29, FR-30, FR-31, FR-32, FR-33, FR-34, FR-35, FR-36, FR-60, FR-61, FR-62, FR-63, FR-64, FR-65 (FR-60+ added 2026-05-25 per ADR-0015 — bank-aggregator promotion to V1; FR-64/FR-65 added 2026-06-01 via aped-course)
- Group F — Monthly tracking: FR-37, FR-38, FR-39, FR-40
- Group G — Dashboard & KPIs: FR-41, FR-42, FR-43, FR-44
- Group H — Auth, settings, lifecycle: FR-45, FR-46, FR-47, FR-48, FR-49, FR-50, FR-51, FR-52
- Group I — PWA, mobile, design system: FR-53, FR-54, FR-55, FR-56
- Group J — Hypotheses & projections: FR-57, FR-58, FR-59

**Total:** 63 FRs (59 original + 4 added 2026-05-25 per ADR-0015).

### Non-Functional Requirements

- Performance: NFR-1, NFR-2, NFR-3, NFR-4, NFR-5, NFR-6, NFR-7
- Security: NFR-8, NFR-9, NFR-10, NFR-11, NFR-12, NFR-13, NFR-14, NFR-31 (NFR-31 added 2026-05-25 per ADR-0015 — Bridge token encryption at rest)
- Scalability: NFR-15, NFR-16, NFR-17
- Reliability: NFR-18, NFR-19, NFR-20, NFR-21
- Accessibility: NFR-22, NFR-23, NFR-24
- Observability: NFR-25, NFR-26, NFR-27
- Integration: NFR-28, NFR-29, NFR-30, NFR-32, NFR-33 (NFR-32/33 added 2026-05-25 per ADR-0015 — SCA refresh + Bridge webhook signature)

**Total:** 33 NFRs (30 original + 3 added 2026-05-25 per ADR-0015).

### Additional Requirements

- Domain Requirements (regulatory positioning): DR-1, DR-2, DR-3, DR-4, DR-5, DR-6, DR-7, DR-8, DR-9, DR-10, DR-11, DR-12

## FR Coverage Map

Every FR maps to exactly one owning story (the implementer). Surface stories that consume the FR are listed under the same epic but do not duplicate the ownership.

| FR    | Owning story                  | Epic |
| ----- | ----------------------------- | ---- |
| FR-1  | 1-1-compass-domain            | 1    |
| FR-2  | 1-1-compass-domain            | 1    |
| FR-3  | 1-2-milestones-domain         | 1    |
| FR-4  | 1-2-milestones-domain         | 1    |
| FR-5  | 1-1-compass-domain            | 1    |
| FR-6  | 1-2-milestones-domain         | 1    |
| FR-7  | 1-3-compass-curve             | 1    |
| FR-8  | 1-1-compass-domain            | 1    |
| FR-9  | 2-1-accounts-orpc-port        | 2    |
| FR-10 | 2-1-accounts-orpc-port        | 2    |
| FR-11 | 2-2-account-balance-history   | 2    |
| FR-12 | 2-1-accounts-orpc-port        | 2    |
| FR-13 | 3-1-holdings-orpc-port        | 3    |
| FR-14 | 3-1-holdings-orpc-port        | 3    |
| FR-15 | 3-1-holdings-orpc-port        | 3    |
| FR-16 | 3-2-prices-fallback-chain     | 3    |
| FR-17 | 3-2-prices-fallback-chain     | 3    |
| FR-18 | 3-3-portfolio-fx              | 3    |
| FR-19 | 3-3-portfolio-fx              | 3    |
| FR-20 | 3-1-holdings-orpc-port        | 3    |
| FR-21 | 4-1-realestate-domain         | 4    |
| FR-22 | 4-1-realestate-domain         | 4    |
| FR-23 | 4-1-realestate-domain         | 4    |
| FR-24 | 4-2-realestate-derives        | 4    |
| FR-25 | 4-2-realestate-derives        | 4    |
| FR-26 | 4-2-realestate-derives        | 4    |
| FR-27 | 4-1-realestate-domain         | 4    |
| FR-28 | 5-1-transactions-record       | 5    |
| FR-29 | 5-2-csv-import                | 5    |
| FR-30 | 5-3-transfer-rule             | 5    |
| FR-31 | 6-1-llm-routing-and-providers | 6    |
| FR-32 | 6-2-llm-categorise            | 6    |
| FR-33 | 6-4-llm-suggestion-ui         | 6    |
| FR-34 | 6-3-llm-opt-in                | 6    |
| FR-35 | 6-1-llm-routing-and-providers | 6    |
| FR-36 | 6-5-llm-activity-log          | 6    |
| FR-37 | 5-4-monthly-tracking          | 5    |
| FR-38 | 5-4-monthly-tracking          | 5    |
| FR-39 | 5-5-monthly-signoff           | 5    |
| FR-40 | 5-5-monthly-signoff           | 5    |
| FR-41 | 7-2-dashboard-cap-page        | 7    |
| FR-42 | 7-2-dashboard-cap-page        | 7    |
| FR-43 | 7-1-dashboard-orchestration   | 7    |
| FR-44 | 7-1-dashboard-orchestration   | 7    |
| FR-45 | 8-1-supabase-auth-flows       | 8    |
| FR-46 | 8-1-supabase-auth-flows       | 8    |
| FR-47 | 8-1-supabase-auth-flows       | 8    |
| FR-48 | 8-1-supabase-auth-flows       | 8    |
| FR-49 | 11-1-data-export              | 11   |
| FR-50 | 11-2-account-deletion         | 11   |
| FR-51 | 8-2-theme-language-prefs      | 8    |
| FR-52 | 8-2-theme-language-prefs      | 8    |
| FR-53 | 9-1-pwa-manifest-and-install  | 9    |
| FR-54 | 9-2-pwa-offline-cache         | 9    |
| FR-55 | 10-1-visual-snapshot-suite    | 10   |
| FR-56 | 10-1-visual-snapshot-suite    | 10   |
| FR-57 | 7-3-hypothesis-domain         | 7    |
| FR-58 | 7-3-hypothesis-domain         | 7    |
| FR-59 | 7-4-hypothesis-comparison-ui  | 7    |
| FR-60 | 5-6-bridge-connector          | 5    |
| FR-61 | 5-6-bridge-connector          | 5    |
| FR-62 | 5-7-bridge-ui                 | 5    |
| FR-63 | 5-7-bridge-ui                 | 5    |
| FR-64 | 6-9-month-navigator           | 6    |
| FR-65 | 6-10-merchant-logos           | 6    |

**Coverage:** 63/63 FRs owned by exactly one story. No orphans, no multi-cover. (FR-60/61 owned by 5-6-bridge-connector ; FR-62/63 owned by 5-7-bridge-ui ; both added 2026-05-25 per ADR-0015.)

## File Structure Design (epic-level)

| Epic | Path prefix(es)                                                                                                                                                                                                                                                                                                                                                                                                       | Single responsibility                                                                                          | Inputs → Outputs                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `packages/{zod,types,validators,contracts,tsconfig,oxlint-config,ui}/`, `apps/api/src/{bootstrap,platform,database,common}/`, `.github/workflows/`, lefthook                                                                                                                                                                                                                                                          | Workspace primitives + Elysia runtime + Prisma layer + CI/CD + DS migration                                    | brownfield types/schemas → importable `@pekulo/*` + HTTP server + PR check matrix                                                                                                     |
| 1    | `apps/api/src/modules/{compass,milestones}/`, `apps/web/src/app/(cap)/{dashboard,parametres}/_components/compass-*`, `apps/api/src/common/derive/compass-progress.ts`                                                                                                                                                                                                                                                 | Target-capital + horizon + intermediate steps + status compute                                                 | Prisma `Hypothesis` + `CompassHistory` + `Milestone` → oRPC `/compass`, `/milestones` + Cap view fragments                                                                            |
| 2    | `apps/api/src/modules/accounts/`, `apps/web/src/app/(cap)/parametres/_components/accounts-*`                                                                                                                                                                                                                                                                                                                          | Account CRUD + balance log + Patrimoine tab                                                                    | Prisma `Account`, `AccountBalanceLog` → oRPC `/accounts/*` + settings/dashboard?tab=patrimoine fragments                                                                              |
| 3    | `apps/api/src/modules/holdings/` (+ `services/{prices,yahoo,boursorama,twelve-data,frankfurter}-client.ts` + `holdings.cache.ts`), `apps/api/src/common/derive/{portfolio-fx,holding-quantity,holding-pnl}.ts`, `apps/web/src/app/(cap)/portefeuille/_components/`                                                                                                                                                    | Holdings + lots + 4-tier price chain + FX + crypto enum                                                        | Prisma `Holding`, `HoldingLot` + external providers → oRPC `/holdings/*` + portefeuille screen                                                                                        |
| 4    | `apps/api/src/modules/realestate/`, `apps/api/src/common/derive/{rental-cashflow,property-equity}.ts`, `apps/web/src/app/(cap)/immobilier/_components/`                                                                                                                                                                                                                                                               | Properties + mortgage + rental + valuation history                                                             | Prisma `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` → oRPC `/realestate/*` + immobilier screen                                                       |
| 5    | `apps/api/src/modules/{transactions,monthly,bank-aggregator}/` (bank-aggregator/ added 2026-05-25), `apps/api/src/modules/bank-aggregator/services/bridge-client.ts` (BankProvider impl per ADR-0015), `apps/api/src/common/derive/{transfer-rule,monthly-aggregates}.ts`, `apps/web/src/app/(cap)/{transactions,mensuel}/_components/`, `apps/web/src/app/(cap)/parametres/_components/bank-connections-section.tsx` | Transaction CRUD + CSV import + transfer detection + monthly aggregates + sign-off + bank connections (Bridge) | Prisma `Transaction`, `MonthlyRecord`, `BankConnection` → oRPC `/transactions/*`, `/monthly/*`, `/bankaggregator/*` + transactions + mensuel screens + parametres connections section |
| 6    | `apps/api/src/modules/llm/` (+ `providers/{ollama,third-party,foundation-models}-client.ts` + `llm-prompt-builder.ts`), `apps/web/src/lib/llm/attest-queue.ts`, `apps/web/src/app/(cap)/{parametres,transactions}/_components/{llm,suggestion}-*`                                                                                                                                                                     | LLM routing + categorisation + per-call audit + opt-in guard + AI transparency                                 | Prisma `LlmCallLog`, `LlmOptIn` + provider endpoints → oRPC `/llm/*` + suggestion UI + activity log + opt-in toggle                                                                   |
| 7    | `apps/api/src/modules/{dashboard,hypothesis}/` (+ `derive/projection-curve.ts`), `apps/web/src/app/(cap)/dashboard/_components/`                                                                                                                                                                                                                                                                                      | Cross-domain aggregator + total wealth + projection comparison                                                 | compass + accounts + holdings + realestate + hypothesis → oRPC `/dashboard/*`, `/hypothesis/*` + Cap layout + Hypothèse card                                                          |
| 8    | `apps/web/src/app/(auth)/{login,signup,recover}/`, `apps/api/src/modules/{auth,settings}/`, `apps/web/src/lib/stores/{theme,lang}-store.ts`, `apps/web/src/app/(cap)/parametres/_components/{theme,lang}-*`                                                                                                                                                                                                           | Auth flows + theme/lang preferences                                                                            | Supabase Auth + Prisma `UserPref` → session + persisted preferences                                                                                                                   |
| 9    | `apps/web/src/app/manifest.ts`, `apps/web/src/sw.ts`, `apps/web/public/icons/`, `apps/web/src/components/install-prompt.tsx`                                                                                                                                                                                                                                                                                          | PWA install affordance + offline read-only cache                                                               | app metadata + last-snapshot per route → install prompt + Lighthouse PWA ≥90 + offline fallback                                                                                       |
| 10   | `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx`, `apps/mobile/`, `.maestro/`                                                                                                                                                                                                                                                                                                                              | Visual parity web ↔ mobile (V1.5)                                                                              | `@pekulo/ui` components + oRPC client → snapshot artefacts + V1.5 mobile build                                                                                                        |
| 11   | `apps/api/src/modules/settings/{exportData,deleteAccount}.ts`, `docs/exports/schema-v1.json`, `docs/security.md`, axe + RLS-audit gates in `.github/workflows/pr.yml`, GlitchTip OTLP                                                                                                                                                                                                                                 | Pre-(b) public-ramp readiness — GDPR + a11y + ops hardening                                                    | per-user data + Supabase tier + codebase → JSON export + cascade deletion + failing CI on regressions + structured error capture                                                      |

## Backlog

### Ramp tiering

| Tier                | Epics                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| V1                  | epic-0, epic-1, epic-2, epic-3, epic-4, epic-5, epic-6, epic-7, epic-8, epic-9 |
| V1.5 deferred       | epic-10 (10-1 ships V1, 10-2 deferred per G1)                                  |
| Public-ramp backlog | epic-11 (11-3 priorité tôt; reste gated sur (b) decision)                      |

## Epic 0: Foundations — package layout, tooling, runtime substrate

**Goal:** Establish the `@pekulo/*` workspace, oxc toolchain, Bun + Elysia API, Prisma 7 schema, oRPC contracts, OTel instrumentation, CI/CD matrix, and the Pekulo Design System on Tamagui Core — every prerequisite that V1 feature work consumes. Reproduces the Epic Zero stories from `docs/architecture.md` (E0.1 → E0.12) verbatim.

**Sequencing:** V1 prerequisite. Must land before any feature epic (1 → 9, 11) starts.

#### Story 0-1-packages-reorg

**Ticket:** [#1](https://github.com/yabafre/pekulo/issues/1)
**Title:** Bootstrap workspaces under `@pekulo/*`

**Depends on:** none

**As a** Pekulo developer, **I want** a coherent `packages/{zod,types,validators,contracts,tsconfig,oxlint-config,ui}` workspace layout under the `@pekulo/*` namespace, **so that** every shared primitive lands in a single, importable location and downstream stories can depend on stable module identities.

**Summary:** Create the seven `packages/*` workspaces with placeholder exports + Bun workspace bootstrap. Wire `@pekulo/tsconfig` as the shared TS base. Reference: ADR-0011.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** a fresh checkout, **When** I run `bun install`, **Then** Bun resolves all seven `@pekulo/*` workspaces with no errors.
- **Given** `@pekulo/tsconfig` exists, **When** another package extends it, **Then** strict TS settings apply uniformly.

**Complexity:** M

#### Story 0-2-oxc-toolchain

**Ticket:** [#2](https://github.com/yabafre/pekulo/issues/2)
**Title:** Adopt oxlint + oxfmt and remove ESLint/Prettier

**Depends on:** 0-1-packages-reorg

**As a** Pekulo developer, **I want** the oxc toolchain (oxlint + oxfmt) wired across every workspace, **so that** lint + format runs are 50–100× faster and we have a single source of style truth shared with the architecture's W1 watch item.

**Summary:** Install `oxlint` + `oxfmt`, remove `eslint-config-next` and ad-hoc Prettier, wire pre-commit (lefthook in 0-11) and CI matrix entries (0-8). Reference: ADR-0004, W1.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** the new toolchain, **When** `bun run lint` runs, **Then** oxlint exits 0 on a clean tree.
- **Given** the new toolchain, **When** `bun run format` runs, **Then** oxfmt rewrites files idempotently.

**Complexity:** M

#### Story 0-3-api-scaffold

**Ticket:** [#3](https://github.com/yabafre/pekulo/issues/3)
**Title:** Scaffold `apps/api` on Bun + Elysia

**Depends on:** 0-1-packages-reorg

**As a** Pekulo developer, **I want** an `apps/api` Bun + Elysia entrypoint with platform skeletons (HTTP, security, observability) and a Dockerfile mounted on the Dokploy VPS via Caddy, **so that** every domain module from epics 1–8 has a runtime to attach to.

**Summary:** Create `apps/api/src/{bootstrap,platform,database,common}` skeletons, an Elysia entrypoint with a `health` module, runtime-dependencies wiring, and a Dockerfile. Reference: ADR-0009.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** the scaffold, **When** I run `bun --cwd apps/api dev`, **Then** Elysia binds and `/health` returns 200.
- **Given** the Dockerfile, **When** Dokploy builds and deploys, **Then** Caddy routes `/api/*` to the container.

**Complexity:** L

#### Story 0-4-prisma-setup

**Ticket:** [#4](https://github.com/yabafre/pekulo/issues/4)
**Title:** Prisma 7.8 schema folder + prefixed IDs + baseline migration

**Depends on:** 0-3-api-scaffold

**As a** Pekulo developer, **I want** Prisma 7.8 with the schema folder preview feature, the Trafi-pattern `prefixed-ids.extension`, and a baseline migration that collapses `apps/web/supabase-schema.sql` into Prisma migrations, **so that** every domain story can declare its tables in a single canonical place.

**Summary:** Set up `apps/api/prisma/schema/{_base,enums}.prisma`, the `@prisma/adapter-pg` driver adapter, the prefixed-ids `$extends`, the central `id-prefixes.config.ts` registry, and a baseline migration. Reference: ADR-0012, ADR-0014, NFR-28, W6.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** the Prisma setup, **When** I run `prisma migrate deploy` against a Supabase branch, **Then** the baseline applies cleanly.
- **Given** a model decorated with the prefix extension, **When** I create a row, **Then** the ID has the configured prefix.

**Complexity:** L

#### Story 0-5-orpc-contracts-scaffold

**Ticket:** [#5](https://github.com/yabafre/pekulo/issues/5)
**Title:** `@pekulo/contracts` oRPC scaffold per Elysia module

**Depends on:** 0-3-api-scaffold

**As a** Pekulo developer, **I want** one oRPC contract per Elysia module under `/rpc/v1/*` with sub-tree versioning, **so that** the web tier has a typed client surface and each module can bump independently.

**Summary:** Implement `@pekulo/contracts` skeletons for every planned module (auth, compass, milestones, accounts, holdings, real-estate, transactions, llm, monthly, dashboard, settings, hypothesis) and the oRPC client init in `apps/web/src/lib/orpc/`. Reference: ADR-0009.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** the contracts package, **When** the web tier imports `accountsContract`, **Then** TypeScript infers the full request/response types.
- **Given** a contract bump, **When** I increment the sub-tree version, **Then** older clients still resolve the previous tree.

**Complexity:** M

#### Story 0-6-zapaction-orpc-bridge

**Ticket:** [#6](https://github.com/yabafre/pekulo/issues/6)
**Title:** Refactor zapaction server actions into thin oRPC wrappers

**Depends on:** 0-5-orpc-contracts-scaffold

**As a** Pekulo developer, **I want** existing `apps/web/src/lib/zapaction/` server actions refactored to thin `'use server'` wrappers calling the oRPC client, **so that** brownfield modules can be ported domain-by-domain without breaking the web call sites.

**Summary:** Migrate the existing action context and tag registry, then port a single brownfield module first to validate the bridge before fan-out. Reference: ADR-0009.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** the refactor, **When** a server action runs, **Then** it delegates to the oRPC client and the request is observable in OTel traces.
- **Given** a brownfield call site, **When** I switch its action import, **Then** the existing UI renders unchanged.

**Complexity:** M

#### Story 0-7-otel-three-runtimes

**Ticket:** [#7](https://github.com/yabafre/pekulo/issues/7)
**Title:** OpenTelemetry SDK init in web, api, prices

**Depends on:** 0-3-api-scaffold

**As a** Pekulo developer, **I want** OTel SDK init in `apps/web` (`@opentelemetry/sdk-node`), `apps/api` (Elysia + Prisma instrumentations), and `apps/prices` (`opentelemetry-instrumentation-fastapi`) with a stdout exporter for V1 (a), **so that** request tracing exists from day one and a GlitchTip destination can be added at (b) without re-instrumentation.

**Summary:** Configure each runtime's SDK init, add Prisma + Elysia + FastAPI instrumentations, and document the OTLP destination toggle. Reference: ADR-0005, NFR-25, NFR-26, NFR-27.

**Covered FRs:** (foundation — no direct FR; supports NFR-25/26/27)

**Acceptance Criteria:**

- **Given** an authenticated request, **When** it traverses web → api → Prisma, **Then** a single trace ID spans all three with correctly nested spans on stdout.
- **Given** the toggle, **When** `OTEL_EXPORTER_OTLP_ENDPOINT` is set, **Then** spans flow to the configured destination.

**Complexity:** M

#### Story 0-8-github-actions-pr

**Ticket:** [#8](https://github.com/yabafre/pekulo/issues/8)
**Title:** GitHub Actions PR check matrix

**Depends on:** 0-2-oxc-toolchain

**As a** Pekulo developer, **I want** a `pr.yml` matrix covering lint, format-check, typecheck, test:unit, test:e2e:smoke, rls-audit, prisma:check, lighthouse-ci, axe-a11y, with Turborepo remote cache and per-app deploy hooks, **so that** every PR has the same gates and merging cannot regress NFR-3 (Lighthouse ≥90) or NFR-22 (a11y).

**Summary:** Wire the matrix, enable Turborepo cache, configure Vercel + Dokploy webhook deploy hooks. Reference: NFR-3, NFR-22 (gating).

**Covered FRs:** (foundation — no direct FR; gates NFR-3/22)

**Acceptance Criteria:**

- **Given** a PR with a failing axe scan, **When** CI runs, **Then** the merge button is blocked.
- **Given** a passing PR, **When** it merges, **Then** Vercel deploys `apps/web` and Dokploy redeploys `apps/api` + `apps/prices`.

**Complexity:** M

#### Story 0-9-tamagui-spike

**Ticket:** [#9](https://github.com/yabafre/pekulo/issues/9)
**Title:** Tamagui pre-flight spike (RSC + a11y)

**Depends on:** 0-3-api-scaffold

**As a** Pekulo developer, **I want** a pre-flight spike validating Tamagui Core's integration with Next 16 RSC, App.tsx prototype port, and WCAG 2.2 AA contrast preservation, **so that** the W2 watch item is resolved before committing to the full DS migration.

**Summary:** Three-spike package: RSC compatibility, prototype port, contrast tokens. Decision: green-light 0-10 or pivot back to A (Tailwind status quo + V1.5 rebuild). Reference: ADR-0007 pre-flight, W2.

**Covered FRs:** (foundation — no direct FR; resolves W2)

**Acceptance Criteria:**

- **Given** the spike, **When** I render the prototype on a Next 16 RSC page, **Then** Tamagui does not force `'use client'` on every leaf.
- **Given** the contrast spike, **When** I measure dark + light tokens, **Then** every text/background pair meets WCAG 2.2 AA (≥4.5:1 body, ≥3:1 large).

**Complexity:** S

#### Story 0-10-pekulo-ui-migration

**Ticket:** [#10](https://github.com/yabafre/pekulo/issues/10)
**Title:** `@pekulo/ui` Tamagui DS migration

**Depends on:** 0-9-tamagui-spike

**As a** Pekulo developer, **I want** the `@pekulo/ui` package built on Tamagui Core, with `docs/ux-preview/src/tokens/` ported into Tamagui themes and Pekulo\* primitives + components matching the UX spec catalog, plus a visual snapshot suite and vitest-axe a11y suite, **so that** every UI story in epics 1–9 + 11 has a stable component vocabulary.

**Summary:** Multi-step port — tokens, primitives, Pekulo\* components, snapshot suite, a11y suite. Will likely sub-divide at `aped-story` time per the architecture's annotation. Reference: ADR-0007.

**Covered FRs:** (foundation — no direct FR; enables FR-55 enforcement)

**Acceptance Criteria:**

- **Given** the migration, **When** `apps/web` renders the dashboard, **Then** every component is sourced from `@pekulo/ui`.
- **Given** the snapshot suite, **When** I run `bun test:visual`, **Then** every Pekulo\* component has an approved snapshot.
- **Given** the a11y suite, **When** vitest-axe runs, **Then** zero serious violations are reported on Pekulo\* components.

**Complexity:** L

#### Story 0-11-precommit-secrets

**Ticket:** [#11](https://github.com/yabafre/pekulo/issues/11)
**Title:** Pre-commit hooks (lefthook + gitleaks + prisma format)

**Depends on:** 0-2-oxc-toolchain

**As a** Pekulo developer, **I want** lefthook running `oxlint --fix --staged`, `oxfmt --staged`, `gitleaks detect --staged`, and `prisma format` on `*.prisma` staged files, **so that** secrets cannot leak into git history and formatting cannot drift between contributors.

**Summary:** Configure lefthook + gitleaks + prisma format. Document onboarding in `apps/web/README.md` and `apps/api/README.md`. Reference: NFR-12 hygiene.

**Covered FRs:** (foundation — no direct FR)

**Acceptance Criteria:**

- **Given** a staged file containing a secret-like pattern, **When** I commit, **Then** gitleaks blocks the commit with a clear reason.
- **Given** an unformatted Prisma schema, **When** I commit, **Then** `prisma format` rewrites it before commit.

**Complexity:** S

#### Story 0-12-custom-oxlint-rules

**Ticket:** [#12](https://github.com/yabafre/pekulo/issues/12)
**Title:** Custom oxlint rules in `@pekulo/oxlint-config`

**Depends on:** 0-2-oxc-toolchain, 0-10-pekulo-ui-migration

**As a** Pekulo developer, **I want** four custom oxlint rules — `no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`, `no-tailwind-outside-ui` — with rule fixtures + tests + CI gate, **so that** the architecture's invariants are enforced mechanically rather than by review discipline.

**Summary:** Implement the four rules as JS plugins, ship in `@pekulo/oxlint-config`, wire fixtures + tests + CI. Reference: W5 watch item, NFR-8 (RLS lint), FR-55 enforcement.

**Covered FRs:** (foundation — no direct FR; enforces NFR-8 + FR-55)

**Acceptance Criteria:**

- **Given** a Prisma query missing `where: { userId }`, **When** oxlint runs, **Then** the rule fires with the exact missing-clause message.
- **Given** a Tailwind class outside `@pekulo/ui`, **When** oxlint runs, **Then** the rule fires.

**Complexity:** M

## Epic 1: Compass & milestones — V1 differentiator

**Goal:** Deliver Pekulo's central verb _"set a compass, everything aligns"_ — a target capital + horizon, intermediate milestones, and progress computation that anchors every other screen. This is the V1 differentiator vs Trade Republic + Finary (PRD U1, U4).

**Sequencing:** V1 — runs after Epic 0 lands.

#### Story 1-1-compass-domain

**Ticket:** [#13](https://github.com/yabafre/pekulo/issues/13)
**Title:** Compass domain module with audit history and progress compute

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge

**As a** Pekulo user, **I want** to declare and edit my compass (target capital + horizon year), with prior values archived, and to see a progress percentage based on my current wealth, **so that** I always know whether I am on track and can revisit my goal as life changes.

**Summary:** Create the compass module (`apps/api/src/modules/compass/{handler,service,repository}.ts`) reusing the brownfield `Hypothesis` row, add a `CompassHistory` audit table written in `prisma.$transaction`, expose `updateCompass`, `getSetupState` (returns `'incomplete'` when no milestone exists), and the pure `derive/compass-progress.ts` helper.

**Covered FRs:** FR-1, FR-2, FR-5, FR-8

**Acceptance Criteria:**

- **Given** no compass set, **When** I declare `{capital, horizon}`, **Then** the row is persisted and audit history records the creation.
- **Given** an existing compass, **When** I edit it, **Then** the prior values are archived in `CompassHistory`.
- **Given** a wealth snapshot of 60 000 € and a compass of 800 000 €, **When** progress is computed, **Then** it returns 7.5 %.
- **Given** no milestone exists, **When** the dashboard queries setup state, **Then** the response is `'incomplete'`.

**Complexity:** M

#### Story 1-2-milestones-domain

**Ticket:** [#14](https://github.com/yabafre/pekulo/issues/14)
**Title:** Milestones CRUD + reorder + per-milestone status

**Depends on:** 1-1-compass-domain

**As a** Pekulo user, **I want** to add up to 20 intermediate milestones (capital + year), reorder/edit/delete them, and see each one tagged `ahead`, `on-track`, or `behind`, **so that** the long-horizon compass is decomposed into checkpoints I can act on.

**Summary:** Add the milestones module + Prisma `Milestone` model + per-user-row guard. Implement reorder (auto-sort by year ascending), CRUD, and `computeStatuses` against the linear plan from today to compass.

**Covered FRs:** FR-3, FR-4, FR-6

**Acceptance Criteria:**

- **Given** an existing compass, **When** I add a 21st milestone, **Then** the API rejects with a domain error.
- **Given** three milestones, **When** I delete the middle one, **Then** the remaining two re-sort by year ascending.
- **Given** the linear plan and current wealth, **When** statuses compute, **Then** each milestone returns one of `{ahead, on-track, behind}` deterministically.

**Complexity:** M

#### Story 1-3-compass-curve

**Ticket:** [#15](https://github.com/yabafre/pekulo/issues/15)
**Title:** Compass-progress curve from KpiSnapshot history

**Depends on:** 1-1-compass-domain

**As a** Pekulo user, **I want** a curve plotting my projected vs actual wealth from the compass start date to today, **so that** the trajectory is visible at a glance on the Cap dashboard.

**Summary:** Implement `compass.service.getCompassCurve` (inside the compass module, NOT the dashboard module — keeps Epic 1 self-contained and avoids file-clobbering with `7-1-dashboard-orchestration`) aggregating `KpiSnapshot` history rows. The dashboard's `getOverview` will compose this through the compass module, not duplicate it.

**Covered FRs:** FR-7

**Acceptance Criteria:**

- **Given** ≥3 KPI snapshots since the compass start, **When** the curve query runs, **Then** the response contains aligned `actual[]` + `plan[]` series ordered by date.
- **Given** zero snapshots, **When** the curve query runs, **Then** the response returns the plan series only and an empty actual series.

**Complexity:** S

#### Story 1-4-compass-ui-cap

**Ticket:** [#16](https://github.com/yabafre/pekulo/issues/16)
**Title:** Cap view UI primitives — donut, milestones, compass forms, history

**Depends on:** 1-1-compass-domain, 1-2-milestones-domain, 1-3-compass-curve, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the Cap view's compass surfaces — donut, milestone rows, edit form, milestone form, compass history panel, and the setup CTA — to render the live data, **so that** my compass is the first thing I see and edit.

**Summary:** Implement `DonutCard`, `MilestonesSection` + `MilestoneRow` + `StaggerList`, `compass-edit-form`, `add-milestone-form`, `compass-history-panel`, `compass-setup-cta`. Wire React Query hooks via the oRPC client. Likely splits in `aped-story`.

**Covered FRs:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8 (UI surfaces)

**Acceptance Criteria:**

- **Given** a compass with 3 milestones, **When** I land on the Cap view, **Then** the donut shows the percentage and each milestone row shows its status badge.
- **Given** I open the edit form, **When** I change the horizon year and submit, **Then** the previous compass appears in the history panel.
- **Given** no milestones, **When** I land on the dashboard, **Then** the setup CTA shows instead of a misleading progress number.

**Complexity:** L

## Epic 2: Accounts — extended brownfield

**Goal:** Reaffirm the brownfield accounts module under the new oRPC contract + Prisma layer, add a balance log, and surface the Patrimoine tab. Foundation for transactions and total-wealth aggregation.

**Sequencing:** V1 — parallel with epics 1, 3, 4, 5.

#### Story 2-1-accounts-orpc-port

**Ticket:** [#17](https://github.com/yabafre/pekulo/issues/17)
**Title:** Port accounts module to oRPC + Prisma with explicit user_id guards

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge

**As a** Pekulo user, **I want** to create, edit, and delete accounts (with deletion blocked when holdings or transactions reference them), and to see only my accounts via per-row RLS, **so that** my account inventory stays consistent and isolated.

**Summary:** Port the brownfield accounts CRUD into `apps/api/src/modules/accounts/{handler,service,repository}.ts` with the FK guard for delete and explicit `where: { userId }` clauses (defense in depth per ADR-0013).

**Covered FRs:** FR-9, FR-10, FR-12

**Acceptance Criteria:**

- **Given** an account with a referenced holding, **When** I attempt deletion, **Then** the API rejects with a `ReferencedFKError`.
- **Given** two users, **When** user A queries accounts, **Then** only their accounts are returned (verified via RLS test).

**Complexity:** M

#### Story 2-2-account-balance-history

**Ticket:** [#18](https://github.com/yabafre/pekulo/issues/18)
**Title:** Manual cash-balance change with date

**Depends on:** 2-1-accounts-orpc-port

**As a** Pekulo user, **I want** to record a manual cash-balance change on an account at a given date, **so that** historical wealth snapshots reflect the timing of cash movements.

**Summary:** Add `recordBalanceChange(date, amount)` + Prisma `AccountBalanceLog` table. Per-user-row guard.

**Covered FRs:** FR-11

**Acceptance Criteria:**

- **Given** an account, **When** I record a balance change, **Then** an `AccountBalanceLog` row is created and the account's `cash_balance` reflects the new value.

**Complexity:** S

#### Story 2-3-accounts-ui

**Ticket:** [#19](https://github.com/yabafre/pekulo/issues/19)
**Title:** Accounts UI + Patrimoine tab assembly

**Depends on:** 2-1-accounts-orpc-port, 2-2-account-balance-history, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the accounts section in `parametres` and the Patrimoine tab on the dashboard, **so that** I can manage my accounts from settings and see them aggregated under Patrimoine.

**Summary:** Implement `accounts-section.tsx`, `account-create-form.tsx`, `account-edit-form.tsx`, `account-delete-confirm.tsx`, `account-balance-form.tsx`, plus the Patrimoine tab layout (hero with split sub-line, AccountsSection, CompositionSection, RecentActivitySection).

**Covered FRs:** FR-9, FR-10, FR-11, FR-12 (UI surfaces)

**Acceptance Criteria:**

- **Given** I open the accounts section, **When** I create an account, **Then** the new row appears in the list and the Patrimoine tab updates.
- **Given** I attempt to delete a referenced account, **When** the API rejects, **Then** the UI surfaces the FK error in the confirmation dialog.

**Complexity:** M

## Epic 3: Holdings & portfolio — extended brownfield + crypto

**Goal:** Reaffirm the holdings module under oRPC + Prisma, port the 4-tier price chain + 60 s cache + FX snapshot, extend the `holding_kind` enum with `crypto`, and surface the portefeuille screen.

**Sequencing:** V1 — parallel with epics 1, 2, 4, 5.

#### Story 3-1-holdings-orpc-port

**Ticket:** [#20](https://github.com/yabafre/pekulo/issues/20)
**Title:** Port holdings + lots module with crypto enum from day one

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge

**As a** Pekulo user, **I want** to create holdings (ETF, action, crypto, autre), record buy/sell lots, see derived quantity + WAC, and mark holdings as closed, **so that** my brokerage and crypto positions live in one place from V1.

**Summary:** Port the holdings CRUD + lots into `apps/api/src/modules/holdings/{handler,service,repository}.ts`, Prisma `Holding` + `HoldingLot`, the `holding_kind` enum extended with `crypto`, the pure `derive/holding-quantity.ts` (back-compat: zero-lot = manual entry mode), and the close flow that preserves lots.

**Covered FRs:** FR-13, FR-14, FR-15, FR-20

**Acceptance Criteria:**

- **Given** a holding with three buy lots, **When** I query the derived quantity + WAC, **Then** the result matches the weighted-average computation.
- **Given** a closed holding, **When** the active portfolio renders, **Then** the closed holding is hidden but its lots remain queryable for historical computation.
- **Given** a `crypto` kind, **When** I create a holding for `BTC-USD`, **Then** the row is persisted with the crypto enum value.

**Complexity:** L

#### Story 3-2-prices-fallback-chain

**Ticket:** [#21](https://github.com/yabafre/pekulo/issues/21)
**Title:** 4-tier price chain + 60 s in-memory cache

**Depends on:** 3-1-holdings-orpc-port

**As a** Pekulo user, **I want** holding price quotes resolved via a four-tier provider chain (`prices-service` → `yahoo-finance2` → Boursorama → Twelve Data) with a 60-second cache, **so that** the dashboard's portfolio value is fresh, fast, and resilient to single-provider outages.

**Summary:** Port the 4-tier orchestrator from `apps/web/src/lib/services/prices.ts` into `apps/api/src/modules/holdings/services/*` + `holdings.cache.ts` (Map keyed by `ticker|kind|currency`). Includes the typed per-provider error classes and the composite `PriceProviderError.attempts` array. BTC/ETH coverage validated as part of this story.

**Covered FRs:** FR-16, FR-17

**Acceptance Criteria:**

- **Given** a tier-1 timeout, **When** I request a quote, **Then** the orchestrator falls back to tier-2 within 500 ms (NFR-18) and the response indicates the winning provider.
- **Given** repeated requests for the same `ticker|kind|currency`, **When** within 60 s of the first, **Then** the second hit returns from cache with no provider call.
- **Given** all four providers fail, **When** I request a quote, **Then** `PriceProviderError` is thrown with `.attempts` listing every failure reason.
- **Given** a BTC-EUR or ETH-EUR query, **When** the chain runs, **Then** Yahoo or Twelve Data returns a quote.

**Complexity:** M

#### Story 3-3-portfolio-fx

**Ticket:** [#22](https://github.com/yabafre/pekulo/issues/22)
**Title:** FX-adjusted EUR snapshot + per-holding PnL

**Depends on:** 3-1-holdings-orpc-port, 3-2-prices-fallback-chain

**As a** Pekulo user, **I want** my portfolio snapshot in EUR with FX rates applied (falling back to 1:1 transparently) and per-holding unrealised PnL in both holding currency and EUR, **so that** Pekulo's compass and dashboard see consistent EUR figures.

**Summary:** Port `derive-portfolio-fx.ts` into `apps/api/src/common/derive/portfolio-fx.ts`, add the `frankfurter-client.ts` (best-effort, fallback 1:1 with `fxSource` field), and `derive/holding-pnl.ts` for per-holding PnL.

**Covered FRs:** FR-18, FR-19

**Acceptance Criteria:**

- **Given** a USD-denominated holding and a missing FX rate, **When** the snapshot computes, **Then** the result uses 1:1 and the snapshot records `fxSource: 'fallback'`.
- **Given** lots and current price, **When** PnL computes, **Then** both the holding-currency and EUR PnL are returned.

**Complexity:** M

#### Story 3-4-portfolio-ui

**Ticket:** [#23](https://github.com/yabafre/pekulo/issues/23)
**Title:** Portefeuille screen — hero, répartition, lignes, forms

**Depends on:** 3-1-holdings-orpc-port, 3-2-prices-fallback-chain, 3-3-portfolio-fx, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the portefeuille screen with hero (total value + unrealised PnL), répartition by sub-class (ETF/Actions/Crypto), holding rows, plus create/lot/close forms, **so that** I can manage my placements end-to-end on web from V1.

**Summary:** Implement the portefeuille screen layout, `ClassRow` mini-donut entries, `HoldingRow` rows, `holding-create-form.tsx`, `lot-form.tsx`, `holding-close-confirm.tsx`. Likely splits in `aped-story`.

**Covered FRs:** FR-13, FR-14, FR-15, FR-16, FR-17, FR-18, FR-19, FR-20 (UI surfaces)

**Acceptance Criteria:**

- **Given** six holdings (CW8, PE500, VWCE, AAPL, BTC, ETH), **When** I land on portefeuille, **Then** the hero shows total EUR value with signed PnL and the répartition shows ETF/Actions/Crypto with mini-donuts.
- **Given** I open the lot form, **When** I record a sell lot, **Then** the holding's WAC re-derives and the row updates.

**Complexity:** L

## Epic 4: Real-estate — V1 new module

**Goal:** Add the V1 tracker-tier real-estate module — manual valuation + optional mortgage + simple rental block — so the user's apartment counts toward the compass (PRD J6).

**Sequencing:** V1 — parallel with epics 1, 2, 3, 5.

#### Story 4-1-realestate-domain

**Ticket:** [#24](https://github.com/yabafre/pekulo/issues/24)
**Title:** Real-estate module — properties, mortgage, rental, valuation history

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold

**As a** Pekulo user, **I want** to create a property with valuation, attach a single mortgage and a single rental block, and update valuations with the prior amount preserved, **so that** my real-estate footprint is tracked alongside cash and brokerage.

**Summary:** Implement the realestate module + Prisma `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation`. Valuation update writes both `RealEstate` + `RealEstateValuation` in `prisma.$transaction`.

**Covered FRs:** FR-21, FR-22, FR-23, FR-27

**Acceptance Criteria:**

- **Given** a property, **When** I attach a mortgage and a rental block, **Then** both rows persist with the property's foreign key.
- **Given** a property valuation update, **When** the transaction commits, **Then** the prior amount is queryable from `RealEstateValuation`.

**Complexity:** L

#### Story 4-2-realestate-derives

**Ticket:** [#25](https://github.com/yabafre/pekulo/issues/25)
**Title:** Cash-flow + net equity derivations + total-wealth integration

**Depends on:** 4-1-realestate-domain

**As a** Pekulo user, **I want** monthly rental cash-flow and net property equity computed automatically and included in my total wealth and compass progress, **so that** my apartment contributes to the compass without manual aggregation.

**Summary:** `derive/rental-cashflow.ts` (rent − charges − mortgage payment) + `derive/property-equity.ts` (valuation − outstanding principal). Integrate net equity into the dashboard total-wealth aggregator (consumed by 7-1).

**Covered FRs:** FR-24, FR-25, FR-26

**Acceptance Criteria:**

- **Given** a rental block (1 200 € rent, 200 € charges) and a 600 € monthly mortgage, **When** cash-flow computes, **Then** the result is +400 €.
- **Given** a property at 250 000 € valuation with 180 000 € outstanding principal, **When** equity computes, **Then** the result is 70 000 €.
- **Given** the total-wealth aggregator, **When** it runs, **Then** the property's equity contributes to the sum.

**Complexity:** S

#### Story 4-3-realestate-ui

**Ticket:** [#26](https://github.com/yabafre/pekulo/issues/26)
**Title:** Immobilier screen — hero + PropertyCard + forms

**Depends on:** 4-1-realestate-domain, 4-2-realestate-derives, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the immobilier screen with the hero (equity, valuation, debt remaining), per-property cards, and forms for create / mortgage / rental / valuation update, **so that** I can manage my real-estate footprint end-to-end on web from V1.

**Summary:** Implement the immobilier screen layout, `PropertyCard` (with % remboursé donut), `property-create-form.tsx`, `mortgage-form.tsx`, `rental-form.tsx`, `valuation-update-form.tsx`.

**Covered FRs:** FR-21, FR-22, FR-23, FR-24, FR-25, FR-26, FR-27 (UI surfaces)

**Acceptance Criteria:**

- **Given** a property with mortgage and rental, **When** I land on immobilier, **Then** the hero shows equity, valuation, and debt remaining and the PropertyCard shows the % remboursé donut.
- **Given** a valuation update, **When** I submit the form, **Then** the audit trail is queryable from the card detail.

**Complexity:** M

## Epic 5: Transactions & monthly tracking

**Goal:** Reaffirm transactions + monthly under oRPC + Prisma, add CSV import, the rule-based transfer detection (bypass LLM), the monthly sign-off lifecycle (immutable freeze + explicit re-open), AND the Bridge bank-aggregator connector + UI (added 2026-05-25 per ADR-0015 — bank-account connectivity promoted from Vision V2+ to V1 MVP). LLM categorisation lives in epic 6 — this epic covers the structural plumbing, the manual flow, and the automated bank-API flow.

**Sequencing:** V1 — depends on 2-1 (accounts referenced by transactions). Parallel with epics 1, 3, 4, 6. The bank-aggregator stories (5-6, 5-7) depend on 5-1 (transactions module + Prisma `Transaction`) being landed first so bank-pulled rows can flow into the same persistence path.

#### Story 5-1-transactions-record

**Ticket:** [#27](https://github.com/yabafre/pekulo/issues/27)
**Title:** Transactions CRUD module + manual record UI

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge, 2-1-accounts-orpc-port

**As a** Pekulo user, **I want** to record a transaction (date, amount, type, category, account, label) and see it in the recent list, **so that** my manual transaction flow is preserved while the LLM-driven flows are built on top.

**Summary:** Port the transactions module + Prisma `Transaction` + the `transaction-form.tsx` + Récentes section in the transactions screen.

**Covered FRs:** FR-28

**Acceptance Criteria:**

- **Given** I open the transaction form, **When** I submit a valid transaction, **Then** it persists and appears in the Récentes section.
- **Given** an invalid input (amount, category), **When** I submit, **Then** the form surfaces the validation error from the Zod schema.

**Complexity:** M

#### Story 5-2-csv-import

**Ticket:** [#28](https://github.com/yabafre/pekulo/issues/28)
**Title:** CSV bulk import with preview before persistence

**Depends on:** 5-1-transactions-record, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to paste a CSV (date, amount, label, account-label) and preview the parsed rows before they persist, **so that** I can correct headers or mappings before any row lands in the database.

**Summary:** Implement `transactions.service.importCsv` + `csv-import-form.tsx` + `csv-preview-table.tsx` + `use-import-transactions-csv-form.ts`. Reject malformed rows with row-level errors in the preview.

**Covered FRs:** FR-29

**Acceptance Criteria:**

- **Given** a 50-row CSV, **When** I paste it, **Then** the preview table renders with each row tagged valid/invalid.
- **Given** I confirm a clean preview, **When** I submit, **Then** all valid rows persist atomically.

**Complexity:** M

#### Story 5-3-transfer-rule

**Ticket:** [#29](https://github.com/yabafre/pekulo/issues/29)
**Title:** Rule-based transfer detection — bypass LLM

**Depends on:** 5-1-transactions-record

**As a** Pekulo user, **I want** outflows that are clearly transfers between my own accounts to be classified by rule rather than by LLM, **so that** Pekulo saves tokens and improves accuracy on the simplest cases.

**Summary:** Pure `derive/transfer-rule.ts` (account-pair match) called by `transactions.service.categorise`. Surface a transfer badge in the recent list.

**Covered FRs:** FR-30

**Acceptance Criteria:**

- **Given** an outflow on account A and an inflow on account B (same user, same date, same amount), **When** the rule runs, **Then** both are tagged `transfer` and the LLM is not called.
- **Given** a non-paired outflow, **When** the rule runs, **Then** the transaction is forwarded to LLM categorisation (epic 6).

**Complexity:** S

#### Story 5-4-monthly-tracking

**Ticket:** [#30](https://github.com/yabafre/pekulo/issues/30)
**Title:** Monthly aggregates module + Mois en cours UI

**Depends on:** 5-1-transactions-record, 5-3-transfer-rule, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** monthly aggregates (income, spending, transfers, net) derived from categorised transactions and presented as a default I can override before sign-off, **so that** my month-end review starts from a sensible draft.

**Summary:** Port the monthly module + Prisma `MonthlyRecord` + pure `derive/monthly-aggregates.ts` (port of brownfield) + `monthly-form.tsx` + Mois en cours section in the mensuel screen.

**Covered FRs:** FR-37, FR-38

**Acceptance Criteria:**

- **Given** 30 categorised transactions for May 2026, **When** the aggregator runs, **Then** the four aggregates are computed correctly.
- **Given** the default aggregates, **When** I edit one before sign-off, **Then** the override is persisted on the `MonthlyRecord`.

**Complexity:** M

#### Story 5-5-monthly-signoff

**Ticket:** [#31](https://github.com/yabafre/pekulo/issues/31)
**Title:** Monthly sign-off lifecycle — freeze + explicit re-open

**Depends on:** 5-4-monthly-tracking, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to sign off a month (freezing it from automatic recomputation) and to re-open a signed month with an explicit confirmation, **so that** my historical months stay stable while remaining editable when I genuinely need to.

**Summary:** Add `monthly.service.{signOff, reopen}` (sets/clears `signedOffAt`, blocks UPDATE in service when signed) + `sign-off-button.tsx` + `reopen-confirm.tsx` + Historique section.

**Covered FRs:** FR-39, FR-40

**Acceptance Criteria:**

- **Given** a month with no pending transactions, **When** I sign it off, **Then** the `MonthlyRecord` is marked `signedOffAt: <now>` and edits are rejected by the service.
- **Given** a signed month, **When** I trigger re-open and confirm, **Then** `signedOffAt` is cleared and edits resume.

**Complexity:** S

#### Story 5-6-bridge-connector

**Ticket:** [#93](https://github.com/yabafre/pekulo/issues/93)
**Title:** Bridge bank-aggregator connector + Prisma BankConnection + cron refresh

**Depends on:** 5-1-transactions-record, 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge

**As a** Pekulo user, **I want** to connect my Société Générale and Revolut accounts to Pekulo via Bridge (OAuth + SCA), with transactions pulled automatically every N hours and deduplicated against existing rows, **so that** my daily bank flow lands in Pekulo without manual entry.

**Summary:** Implement the bank-aggregator module (`apps/api/src/modules/bank-aggregator/{handler,service,repository}.ts`) + `BankProvider` interface + `BridgeProvider` implementation under `services/bridge-client.ts` (iso-pattern with holdings price clients) + Prisma `BankConnection` model (`bnk` prefix, `pgcrypto`-encrypted `access_token` + `refresh_token` columns, RLS per-row guard) + Bun-scheduled `refreshAll` task + Bridge webhook receiver mounted at `/internal/bridge/webhook` with HMAC signature verification (NFR-33). Transactions ingested by Bridge are written via `transactions.service.ts#importFromProvider` with dedup on `(provider, provider_transaction_id)`. Reference: ADR-0015.

**Covered FRs:** FR-60, FR-61

**Acceptance Criteria:**

- **Given** a valid Bridge OAuth callback (`access_token` + `refresh_token` + `item_id`), **When** I call `initiateConnection` then complete the redirect, **Then** a `BankConnection` row is persisted with the tokens encrypted at rest via `pgcrypto` and the connection appears in `listConnections` for the user.
- **Given** an existing `BankConnection`, **When** the cron-refresh job runs and Bridge returns 50 transactions including 10 already in Pekulo, **Then** only the 40 new transactions are persisted (dedup on `provider_transaction_id`) and the `transactions.service.ts#categorise` pipeline runs on the new rows.
- **Given** an inbound Bridge webhook with an invalid HMAC signature, **When** the receiver processes it, **Then** the request is rejected with a 401 within 100 ms (NFR-33) and no `BankConnection` row mutates.
- **Given** a Prisma query against `BankConnection`, **When** the oRPC handler returns the row to the client, **Then** the `access_token` and `refresh_token` columns are stripped by the DTO mapper (verified by a unit test) — NFR-31 enforcement.

**Complexity:** L

#### Story 5-7-bridge-ui

**Ticket:** [#94](https://github.com/yabafre/pekulo/issues/94)
**Title:** Bridge connection UI — Connect widget redirect + settings page + SCA-expired badge

**Depends on:** 5-6-bridge-connector, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** a dedicated connections section in `parametres` to add, rename, revoke, and reconnect my bank connections, with an SCA-expired badge that prompts me to re-authenticate when Bridge requires it, **so that** I can manage my bank ingestion end-to-end without leaving Pekulo.

**Summary:** Implement `bank-connections-section.tsx` (parametres tab + connections list) + `bank-connect-redirect.tsx` (handles the post-OAuth callback page) + `bank-connection-row.tsx` (per-connection display with SCA badge driven by `getConnectionState`) + `bank-connection-rename-form.tsx` + `bank-connection-revoke-confirm.tsx` + `bank-reconnect-button.tsx` (triggers the SCA re-auth flow). Hooks via the oRPC client. The dashboard's compass-progress query must NOT block on bank refresh (NFR-1 budget unchanged). Reference: ADR-0015.

**Covered FRs:** FR-62, FR-63

**Acceptance Criteria:**

- **Given** I open `parametres` → connexions, **When** I click "Connecter une banque", **Then** I am redirected to the Bridge Connect widget and on return the new connection appears in the list with status `OK`.
- **Given** a connection whose state is `SCA_REQUIRED`, **When** I land on the connections page, **Then** the row shows the SCA-expired badge and the "Reconnecter" CTA opens the SCA re-auth flow.
- **Given** I confirm revocation of a connection, **When** the mutation completes, **Then** Bridge token-revoke is called server-side AND the local `BankConnection` is soft-deleted AND the connection disappears from the list.
- **Given** the dashboard renders while a bank refresh is in progress, **When** the compass-progress query fires, **Then** it returns within the NFR-1 300 ms p95 budget and is not blocked by the refresh job.

**Complexity:** M

## Epic 6: LLM auto-categorisation

**Goal:** Implement the hybrid LLM routing (Apple FoundationModels / Ollama / third-party) for automatic transaction categorisation with per-call audit, opt-in for third-party, suggestion UI with override-wins semantics, 90-day activity log, and the durable async attestation queue (W3).

**Sequencing:** V1 — depends on transactions epic; parallel with everything else.

#### Story 6-1-llm-routing-and-providers

**Ticket:** [#32](https://github.com/yabafre/pekulo/issues/32)
**Title:** LLM routing policy + per-call audit + provider clients

**Depends on:** 0-3-api-scaffold, 0-4-prisma-setup, 0-5-orpc-contracts-scaffold

**As a** Pekulo user, **I want** the LLM router to choose the right endpoint per request (Apple FoundationModels on capable iOS, Ollama on the Dokploy VPS by default, third-party only when I have opted in) and to record every call's routing decision, latency, and outcome without persisting prompt content, **so that** my categorisation is fast, private, and auditable.

**Summary:** Implement `llm.service.route(intent) → {route, providerCall}` + Prisma `LlmCallLog` + `llm.service.recordLlmCall(intent | outcome)` + the three provider clients (`ollama-client.ts`, `third-party-client.ts`, `foundation-models-client.ts`) + `llm-prompt-builder.ts` enforcing zero-PII envelope (NFR-12).

**Covered FRs:** FR-31, FR-35

**Acceptance Criteria:**

- **Given** an iOS-capable client, **When** the router decides, **Then** the response selects `foundation_models` and the call log records the route.
- **Given** a non-iOS client and `optIn: false`, **When** the router decides, **Then** the response selects `ollama` (third-party is excluded).
- **Given** the prompt builder, **When** I attempt to include a user identifier, **Then** the builder strips it and the resulting envelope is ≤2 kb.

**Complexity:** L

#### Story 6-2-llm-categorise

**Ticket:** [#33](https://github.com/yabafre/pekulo/issues/33)
**Title:** LLM categorisation pipeline integrated into transactions

**Depends on:** 5-1-transactions-record, 5-3-transfer-rule, 6-1-llm-routing-and-providers

**As a** Pekulo user, **I want** non-transfer transactions to receive an LLM-suggested category and a confidence score, **so that** the boring categorisation work is done for me.

**Summary:** Implement `llm.service.categorise(tx) → {category, confidence}` and integrate it into `transactions.service.categorise` after the transfer-rule bypass. Latency budgets per NFR-5.

**Covered FRs:** FR-32

**Acceptance Criteria:**

- **Given** a non-transfer transaction routed to Ollama, **When** categorisation runs, **Then** the response returns `{category, confidence}` with confidence in `[0, 1]`.
- **Given** a Foundation Models call, **When** it completes, **Then** the p95 latency is under 600 ms (NFR-5 enforcement).

**Complexity:** M

#### Story 6-3-llm-opt-in

**Ticket:** [#34](https://github.com/yabafre/pekulo/issues/34)
**Title:** Third-party LLM opt-in toggle + server-side guard

**Depends on:** 6-1-llm-routing-and-providers, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** an opt-in toggle in settings for the third-party LLM API (default off) with a server-side guard that prevents any prompt from leaving without my opt-in, **so that** I retain full control over data egress.

**Summary:** Implement `settings.service.updateLlmOptIn` + Prisma `LlmOptIn` row + `llm-opt-in-toggle.tsx` in `parametres` + server-side guard in the router (DR-7, NFR-13).

**Covered FRs:** FR-34

**Acceptance Criteria:**

- **Given** opt-in `false`, **When** the router selects a route, **Then** `third_party` is never returned and a guard test fails the build if it ever is.
- **Given** I toggle opt-in to true, **When** the next ambiguous case arises, **Then** the router may select `third_party`.

**Complexity:** M

#### Story 6-4-llm-suggestion-ui

**Ticket:** [#35](https://github.com/yabafre/pekulo/issues/35)
**Title:** Suggestion row + accept/override flow + AI transparency notice

**Depends on:** 5-1-transactions-record, 6-2-llm-categorise, 6-3-llm-opt-in, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the suggestion row in transactions with confidence + route badge + accept/modify actions, plus an AI transparency notice the first time the LLM produces a user-visible suggestion, **so that** I confirm or override quickly and I am informed of the AI involvement.

**Summary:** Implement `suggestion-row.tsx` + `use-confirm-categorisation.ts` (override wins) + the AI transparency notice surfaced once per opt-in transition (DR-12). Confirmation under 30 seconds per imported transaction (PRD U3).

**Covered FRs:** FR-33

**Acceptance Criteria:**

- **Given** a pending suggestion, **When** I accept it, **Then** the transaction's category persists as the suggested value.
- **Given** I override the suggestion, **When** I save, **Then** the override is persisted and the LLM call log records `outcome: overridden`.
- **Given** my first LLM-visible suggestion, **When** the row renders, **Then** the AI transparency notice appears once.

**Complexity:** M

#### Story 6-5-llm-activity-log

**Ticket:** [#36](https://github.com/yabafre/pekulo/issues/36)
**Title:** 90-day LLM activity log in settings

**Depends on:** 6-1-llm-routing-and-providers, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to view the LLM activity log for the last 90 days from settings, **so that** I have an auditable record of routing decisions and outcomes.

**Summary:** Implement `llm.repository.findByUserSince(90 days)` + `llm-activity-log.tsx` in `parametres`. Renders route, latency, outcome — never prompt content (NFR-26).

**Covered FRs:** FR-36

**Acceptance Criteria:**

- **Given** 200 LLM calls in the last 90 days, **When** I open the activity log, **Then** rows render paginated with route + latency + outcome.
- **Given** a row in the log, **When** I inspect it, **Then** no prompt content is exposed.

**Complexity:** S

#### Story 6-6-llm-async-attestation

**Ticket:** [#37](https://github.com/yabafre/pekulo/issues/37)
**Title:** Durable IndexedDB attestation queue (W3)

**Depends on:** 6-1-llm-routing-and-providers, 6-2-llm-categorise

**As a** Pekulo developer, **I want** a durable IndexedDB-backed retry queue for client-side attestation events, with queue-flush success-rate instrumentation, **so that** the attestation drop rate stays under 1 % over a rolling 7-day window (W3 pivot threshold).

**Summary:** Implement `apps/web/src/lib/llm/attest-queue.ts` per ADR-0008 with retry-with-backoff. Instrument flush success rate; if drops exceed 1 %, the W3 pivot triggers (synchronous attestation fallback).

**Covered FRs:** (no own FR — addresses W3, supports FR-31 routing semantics)

**Acceptance Criteria:**

- **Given** a categorisation call where attestation fails, **When** the queue retries, **Then** the next online window flushes successfully and the metric records the recovery.
- **Given** a 7-day rolling drop rate above 1 %, **When** the metric crosses the threshold, **Then** an alert is emitted (and W3 pivot is on the table).

**Complexity:** M

<!-- Stories 6-7 → 6-10 added 2026-06-01 via aped-course (scope correction). Epic 5
     is closed, so the two transaction-enrichment stories (6-9 month-navigator,
     6-10 merchant-logos) land here despite pushing Epic 6 to 10 stories — explicit
     [O]verride of the ≤8 soft cap, on the user's call. -->

#### Story 6-7-auto-categorise-on-import

**Ticket:** TBD (created when scheduled)
**Title:** Auto-apply LLM category on bulk import (FR-33 amended)

**Depends on:** 6-2-llm-categorise, 6-4-llm-suggestion-ui

**As a** Pekulo user importing many transactions, **I want** the LLM-suggested category applied automatically on bulk import/sync (correctable anytime) instead of confirming each by hand, **so that** I'm not stuck validating hundreds of rows one by one.

**Summary:** On the bulk path (CSV import / Bridge sync), apply the suggested category directly (no pending `autre`+suggestion state) and surface the row in Récentes already categorised; interactive single-transaction creation keeps the manual confirm/override flow (6-4). Update the DR-12 transparency notice to "categories applied by AI — editable anytime". Manual override (transaction edit) always wins. Reuses 6-4's bulk/pagination surface.

**Covered FRs:** FR-33 (amended path; owning story stays 6-4 for the interactive path).

**Acceptance Criteria:**

- **Given** a bulk import producing N suggestions, **When** ingestion completes, **Then** each transaction is persisted with its suggested category (no manual confirm) and appears in Récentes, editable.
- **Given** the first auto-applied batch, **When** the transactions surface renders, **Then** the AI transparency notice states the categories were applied by AI and are correctable.

**Complexity:** M

#### Story 6-8-category-taxonomy-expansion

**Ticket:** TBD (created when scheduled)
**Title:** Expand category taxonomy + category icons (DR-13)

**Depends on:** 6-2-llm-categorise, 6-4-llm-suggestion-ui

**As a** Pekulo user, **I want** richer categories (factures, restauration, abonnements, retrait) each with an icon, **so that** the AI categorisation covers my real spending and the UI is readable.

**Summary:** Extend the `transactionCategory` enum + `TRANSACTION_CATEGORY_LABELS` with `factures, restauration, abonnements, retrait`; thread them into the LLM prompt allowlist (`llm-prompt-builder`), `SUGGESTABLE_TRANSACTION_CATEGORIES`, and `CategoryPicker`. Add a per-category display icon (lucide) shown in `CategoryPicker` + `PekuloSuggestionRow` + activity rows. No compass/budget remap (DR-13). Verify no CHECK constraint blocks the new values.

**Covered FRs:** (no own FR — implements DR-13.)

**Acceptance Criteria:**

- **Given** the expanded enum, **When** the LLM categorises, **Then** the four new categories are valid suggestion targets and render with their icon in the picker + rows.
- **Given** `db:rls-audit` / `prisma:check`, **When** the gate runs, **Then** it passes (no category CHECK regression).

**Complexity:** M

#### Story 6-9-month-navigator

**Ticket:** TBD (created when scheduled)
**Title:** Month navigator for transactions + stats (FR-64)

**Depends on:** 5-1-transactions-record, 5-4-monthly-tracking

**As a** Pekulo user, **I want** to browse my transactions and monthly stat cards month by month, **so that** the Net/Entrées/Sorties reflect a chosen month instead of only the current (often empty) one.

**Summary:** A month navigator (‹ prev / next ›) on `/dashboard/transactions` driving the `TransactionsStatsRow` aggregates AND the Récentes list; defaults to the most recent month with recorded activity. Replaces the hardcoded current-month filter.

**Covered FRs:** FR-64.

**Acceptance Criteria:**

- **Given** transactions only in February while today is June, **When** the page loads, **Then** the navigator defaults to February and the stat cards show February's real Net/Entrées/Sorties.
- **Given** the navigator, **When** I move prev/next, **Then** both the stat cards and the Récentes list re-scope to the selected month.

**Complexity:** M

#### Story 6-10-merchant-logos

**Ticket:** TBD (created when scheduled)
**Title:** Merchant logos on transactions (FR-65)

**Depends on:** 5-6-bridge-connector, 5-1-transactions-record

**As a** Pekulo user, **I want** the merchant's logo on each transaction, **so that** I recognise my spending at a glance.

**Summary:** Capture the provider-supplied merchant logo (Bridge `logo_url`) in the bank-aggregator ingestion, thread it through the `Transaction` DTO, and display it in `PekuloSuggestionRow` + activity rows, falling back to the category icon (6-8) when absent. No logo persisted for manually-created transactions.

**Covered FRs:** FR-65.

**Acceptance Criteria:**

- **Given** a Bridge transaction with a `logo_url`, **When** it renders, **Then** the merchant logo is shown; **When** absent, **Then** the category icon is shown instead.
- **Given** the prompt builder, **When** a logo is captured, **Then** it never enters an LLM prompt (NFR-12 allowlist unchanged).

**Complexity:** M

## Epic 7: Dashboard & projection

**Goal:** Assemble the Cap view (HeroBlock + navigation + composition + recent activity), the cross-domain total-wealth aggregator, and the hypothesis projection vs compass-required curve. Anchors PRD J2 (daily check) + J3 (monthly closing reach via nav) + J7 (milestone review).

**Sequencing:** V1 — depends on epics 1, 2, 3, 4 for the wealth inputs; epic 7 stories themselves are partly parallel.

#### Story 7-1-dashboard-orchestration

**Ticket:** [#38](https://github.com/yabafre/pekulo/issues/38)
**Title:** Dashboard cross-domain aggregator + total wealth + cache invalidation

**Depends on:** 1-1-compass-domain, 2-1-accounts-orpc-port, 3-1-holdings-orpc-port, 4-1-realestate-domain

**As a** Pekulo user, **I want** the dashboard to compute total wealth as cash + FX-adjusted holdings + net real-estate equity, and to refresh after any wealth-affecting mutation via the cache invalidation registry, **so that** my dashboard always reflects the current state.

**Summary:** Implement `apps/api/src/modules/dashboard/dashboard.service.ts` with `getOverview` aggregator + `computeTotalWealth` consuming accounts + holdings + realestate. Wire the `setTagRegistry` graph in `apps/web/src/lib/zapaction/keys.ts` so every wealth-affecting mutation tags the dashboard.

**Covered FRs:** FR-43, FR-44

**Acceptance Criteria:**

- **Given** 5 accounts, 6 holdings, 1 property, **When** total-wealth computes, **Then** the result equals the explicit sum and matches a hand-computed reference.
- **Given** I record a transaction that changes a cash balance, **When** the mutation completes, **Then** the dashboard query refetches via the invalidation tag.

**Complexity:** M

#### Story 7-2-dashboard-cap-page

**Ticket:** [#39](https://github.com/yabafre/pekulo/issues/39)
**Title:** Cap page layout — HeroBlock, navigation, composition, recent activity

**Depends on:** 7-1-dashboard-orchestration, 1-4-compass-ui-cap, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the Cap view's first viewport to show — in order — total wealth in EUR, compass progress percentage, and the next upcoming milestone with delta, plus one-tap navigation to every detail page, **so that** I answer "am I on track?" in under five seconds (PRD U1).

**Summary:** Implement `HeroBlock` (with `CountUpEUR`), `MiniKpis` (mobile only), `CompositionSection` + `CompositionRow`, `RecentActivitySection` + `ActivityRow`, `PekuloNavRail` (lg) + bottom nav (mobile). Honour the FR-41 ordering exactly.

**Covered FRs:** FR-41, FR-42

**Acceptance Criteria:**

- **Given** the Cap view loads, **When** I look at the first viewport, **Then** total wealth + compass % + next milestone delta appear in that order.
- **Given** the navigation, **When** I tap any of {transactions, monthly, portefeuille, immobilier, parametres}, **Then** the target screen mounts in one tap.
- **Given** the Lighthouse scan on `/dashboard`, **When** CI runs, **Then** the score is ≥90 (NFR-3).

**Complexity:** L

#### Story 7-3-hypothesis-domain

**Ticket:** [#40](https://github.com/yabafre/pekulo/issues/40)
**Title:** Hypothesis module + projection-curve derivation

**Depends on:** 0-4-prisma-setup, 0-5-orpc-contracts-scaffold, 0-6-zapaction-orpc-bridge

**As a** Pekulo user, **I want** to record a hypothesis (target capital + horizon + monthly contribution + assumed annual rate) and see a projected wealth curve, **so that** I can gut-check whether my plan is realistic.

**Summary:** Port the hypothesis module + Prisma `Hypothesis` row reuse + pure `derive/projection-curve.ts`.

**Covered FRs:** FR-57, FR-58

**Acceptance Criteria:**

- **Given** current wealth 60 000 €, monthly contribution 1 000 €, rate 5 % over 30 years, **When** the curve computes, **Then** the year-by-year series matches the closed-form annuity formula.

**Complexity:** M

#### Story 7-4-hypothesis-comparison-ui

**Ticket:** [#41](https://github.com/yabafre/pekulo/issues/41)
**Title:** Hypothèse card — projection vs compass-required curve + verdict

**Depends on:** 7-3-hypothesis-domain, 7-2-dashboard-cap-page, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the Hypothèse card on the dashboard with the projected curve, the compass-required curve, the gap in EUR per month, and the read-only entry in `parametres`, **so that** I see whether my current plan reaches the compass and how much I would need to add per month if not.

**Summary:** Implement `dashboard.service.getHypothesisGap → {gapEurPerMonth}`, `HypothesisCard`, `ProjectionChart`, `HypothesisVerdict`, and the read-only entry in parametres.

**Covered FRs:** FR-59

**Acceptance Criteria:**

- **Given** a hypothesis projection ending at 700 000 € and a compass at 800 000 €, **When** the gap computes, **Then** the result returns the EUR-per-month delta required to close the gap.
- **Given** the dashboard, **When** I look at the Hypothèse card, **Then** both curves render and the verdict text reflects the gap sign.

**Complexity:** M

## Epic 8: Auth & preferences

**Goal:** Reaffirm the brownfield Supabase auth flows (signup, login, logout, password reset) and add user preferences (theme + language) persisted server-side. Light epic — auth is mostly brownfield, preferences are new.

**Sequencing:** V1 — depends on Epic 0 only.

#### Story 8-1-supabase-auth-flows

**Ticket:** [#42](https://github.com/yabafre/pekulo/issues/42)
**Title:** Supabase auth flows — signup, login, logout, password reset

**Depends on:** 0-3-api-scaffold

**As a** Pekulo user, **I want** to sign up with email + 12-character password, log in with SSR cookie session, log out from any page, and request a password reset by email link, **so that** my account lifecycle is complete and secure.

**Summary:** Reaffirm brownfield signup/login/logout flows; add the password-reset path. Enforce the 12-char policy (NFR-11) and rate-limit failed logins to 10 per IP per hour.

**Covered FRs:** FR-45, FR-46, FR-47, FR-48

**Acceptance Criteria:**

- **Given** a signup with a 10-char password, **When** I submit, **Then** Supabase rejects with the policy message.
- **Given** 11 failed login attempts in an hour, **When** the 11th attempts, **Then** the rate limiter blocks (NFR-11).
- **Given** I click the reset link in my inbox, **When** I land on `/auth/recover`, **Then** I can set a new password and immediately log in.

**Complexity:** M

#### Story 8-2-theme-language-prefs

**Ticket:** [#43](https://github.com/yabafre/pekulo/issues/43)
**Title:** Theme + language preferences (persisted server-side + client mirror)

**Depends on:** 8-1-supabase-auth-flows, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to switch the UI theme (dark/light/system) and language (FR/EN) from settings with the choice persisted across sessions and devices, **so that** my preferences follow me everywhere.

**Summary:** Implement `settings.service.updateTheme` + `settings.service.updateLang` + Prisma `UserPref` + `theme-segmented-control.tsx` + `lang-segmented-control.tsx` + Zustand `theme-store` and `lang-store` (persist) for client-side mirror.

**Covered FRs:** FR-51, FR-52

**Acceptance Criteria:**

- **Given** I switch the theme to dark, **When** I reload the page, **Then** the theme is dark.
- **Given** I open Pekulo on another device, **When** I authenticate, **Then** my last preferences are applied.

**Complexity:** M

## Epic 9: PWA install + offline

**Goal:** Make Pekulo installable on iOS/Android home screens and tolerate offline read-only views on dashboard/portefeuille/immobilier from the last cached snapshot. Aligns with PRD MVP item 7.

**Sequencing:** V1 — needs `@pekulo/ui` (0-10) but otherwise free of feature-epic deps.

#### Story 9-1-pwa-manifest-and-install

**Ticket:** [#44](https://github.com/yabafre/pekulo/issues/44)
**Title:** PWA manifest + icons + install prompt + Lighthouse ≥90

**Depends on:** 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to install Pekulo on my iPhone and Android home screens via the platform install affordance, **so that** Pekulo opens like a native app.

**Summary:** Implement `apps/web/src/app/manifest.ts`, ship `apps/web/public/icons/*`, render `install-prompt.tsx`. Lighthouse PWA ≥90 (NFR-3, M5) is the gating criterion.

**Covered FRs:** FR-53

**Acceptance Criteria:**

- **Given** I open Pekulo in mobile Safari, **When** I tap _Add to Home Screen_, **Then** the icon installs and the launch screen reflects the manifest.
- **Given** the Lighthouse PWA audit on `/dashboard`, **When** CI runs, **Then** the score is ≥90.

**Complexity:** S

#### Story 9-2-pwa-offline-cache

**Ticket:** [#45](https://github.com/yabafre/pekulo/issues/45)
**Title:** Service worker + encrypted IndexedDB scoped per userId

**Depends on:** 9-1-pwa-manifest-and-install, 7-2-dashboard-cap-page, 3-4-portfolio-ui, 4-3-realestate-ui

**As a** Pekulo user, **I want** to open dashboard, portefeuille, and immobilier in read-only mode when offline (served from the last cached snapshot for up to 60 minutes), **so that** I can check my compass even on a flaky train.

**Summary:** Implement `apps/web/src/sw.ts` + an encrypted IndexedDB cache scoped per userId per ADR-0003. Honour the 60-minute staleness ceiling (NFR-20). Likely splits in `aped-story`.

**Covered FRs:** FR-54

**Acceptance Criteria:**

- **Given** I have visited the dashboard once online, **When** I go offline and open the dashboard, **Then** the read-only snapshot renders within 1 s.
- **Given** the IndexedDB cache, **When** I inspect it, **Then** the payload is encrypted with a key derived from the userId (no plaintext PII at rest in the browser).

**Complexity:** L

## Epic 10: Design system parity (V1.5)

**Goal:** Reach visual parity between the web PWA and the V1.5 React Native app via per-component snapshot tests and a Maestro E2E suite — addresses FR-55 / FR-56 sequencing clauses and the G1 residual gap.

**Sequencing:** **V1.5 deferred.** `10-1` (web snapshot suite) ships in V1; `10-2` (mobile bootstrap + Maestro) is gated on a re-run of `aped-arch` per G1.

#### Story 10-1-visual-snapshot-suite

**Ticket:** [#46](https://github.com/yabafre/pekulo/issues/46)
**Title:** Per-component visual snapshot suite for `@pekulo/ui` (web)

**Depends on:** 0-10-pekulo-ui-migration, 0-12-custom-oxlint-rules

**As a** Pekulo developer, **I want** every Pekulo\* component covered by a per-component visual snapshot test, **so that** unintentional UI regressions are caught in CI before they ship.

**Summary:** Add `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx` for every Pekulo\* component. Enforced together with the `no-tailwind-outside-ui` rule from 0-12 (FR-55 enforcement).

**Covered FRs:** FR-55, FR-56 (web side)

**Acceptance Criteria:**

- **Given** every component, **When** the snapshot suite runs, **Then** each has at least one snapshot covering the default state.
- **Given** an accidental Tailwind class drift outside `@pekulo/ui`, **When** oxlint runs, **Then** the rule fires and CI fails.

**Complexity:** M

#### Story 10-2-mobile-app-bootstrap

**Ticket:** [#47](https://github.com/yabafre/pekulo/issues/47)
**Title:** **(V1.5 deferred)** Expo + expo-router skeleton + Tamagui native consumer + Maestro

**Depends on:** 10-1-visual-snapshot-suite, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** the Pekulo native app to render the same Pekulo\* components as the web PWA with visual parity validated by Maestro, **so that** my experience is consistent across devices.

**Summary:** **Deferred to V1.5.** Bootstrap `apps/mobile` (Expo + expo-router), wire the Tamagui native consumer, port the Pekulo\* components to native, write the Maestro E2E suite. The architecture explicitly defers detailed structure to a V1.5 `aped-arch` re-run (G1).

**Covered FRs:** FR-56 (mobile parity)

**Acceptance Criteria:**

- **Given** the V1.5 mobile bootstrap, **When** I render any Pekulo\* component on iOS, **Then** the visual diff against the web snapshot is below the agreed pixel threshold.
- **Given** the Maestro suite, **When** CI runs, **Then** the E2E happy-path passes on iOS + Android emulators.

**Complexity:** L

## Epic 11: Public-ramp readiness

**Goal:** Land every gate that must be green before the (a)→(b) public ramp triggers — GDPR data export + account deletion, RLS audit + at-rest encryption documentation, axe + WCAG gates, AI transparency notice, restore-from-snapshot drill, and GlitchTip wiring.

**Sequencing:** Backlog. `11-3` (RLS audit + encryption doc) is priorité — it prevents regressions in every new domain story. The other five wait for the (b) decision.

#### Story 11-1-data-export

**Ticket:** [#48](https://github.com/yabafre/pekulo/issues/48)
**Title:** GDPR data export (FR-49) — JSON conforming to schema-v1

**Depends on:** 8-1-supabase-auth-flows, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to export all of my data as a single JSON file from settings, **so that** I have GDPR portability.

**Summary:** Implement `settings.service.exportData` (streams JSON conforming to `docs/exports/schema-v1.json`) + `export-data-row.tsx` + `use-export-data.ts`. Honour the 60 s budget (NFR-6) and the 100 MB ceiling (NFR-30).

**Covered FRs:** FR-49

**Acceptance Criteria:**

- **Given** Persona #1's data volume, **When** I trigger export, **Then** the JSON download starts within 60 s and validates against `schema-v1.json`.
- **Given** the schema, **When** the payload renders, **Then** every top-level node has a `schema_version` field.

**Complexity:** M

#### Story 11-2-account-deletion

**Ticket:** [#49](https://github.com/yabafre/pekulo/issues/49)
**Title:** Cascade account deletion within 60 s (FR-50)

**Depends on:** 8-1-supabase-auth-flows, 0-10-pekulo-ui-migration

**As a** Pekulo user, **I want** to delete my account from settings with cascading deletion across every user-scoped table within 60 seconds, **so that** I can exercise GDPR right-to-erasure.

**Summary:** Implement `settings.service.deleteAccount` (Prisma cascade via FK + Supabase Auth user erase) + `delete-account-confirm.tsx` (destructive variant). Honour the 60 s budget (NFR-7).

**Covered FRs:** FR-50

**Acceptance Criteria:**

- **Given** an account with data across all user-scoped tables, **When** I confirm deletion, **Then** all rows cascade-delete and the Supabase Auth user is erased within 60 s.
- **Given** the deletion, **When** I attempt to log in afterwards, **Then** Supabase rejects.

**Complexity:** M

#### Story 11-3-rls-audit-and-encryption-doc

**Ticket:** [#50](https://github.com/yabafre/pekulo/issues/50)
**Title:** RLS audit script (CI gate) + at-rest encryption doc

**Depends on:** 0-3-api-scaffold, 0-12-custom-oxlint-rules

**As a** Pekulo developer, **I want** a CI-gating script that fails the build if any user-data table is missing the `auth.uid() = user_id` policy on SELECT/INSERT/UPDATE/DELETE, plus the at-rest encryption posture documented in `docs/security.md`, **so that** the (b) ramp opens with verifiable security guarantees.

**Summary:** Implement the RLS audit script + a section in `pr.yml` + the at-rest encryption verification documented in `docs/security.md`. Reference: DR-4, DR-11, NFR-8, NFR-14.

**Covered FRs:** (no own FR — gates DR-4/11 + NFR-8/14)

**Acceptance Criteria:**

- **Given** a new table without RLS policies, **When** CI runs, **Then** the audit fails with the table name surfaced.
- **Given** `docs/security.md`, **When** I read the encryption section, **Then** the Supabase tier's at-rest encryption mechanism is documented with verification steps.

**Complexity:** M

#### Story 11-4-axe-and-wcag-gates

**Ticket:** [#51](https://github.com/yabafre/pekulo/issues/51)
**Title:** axe-core CI gate + manual screen-reader pass

**Depends on:** 0-8-github-actions-pr, 0-10-pekulo-ui-migration

**As a** Pekulo developer, **I want** axe-core failing the build on serious violations across the seven priority routes, plus a manual screen-reader pass before the (b) ramp, **so that** WCAG 2.2 AA is verified mechanically and manually before public.

**Summary:** Wire axe-core gates in `pr.yml` for {dashboard, transactions, monthly, portefeuille, immobilier, parametres, auth}. Run the manual screen-reader pass once. Reference: DR-8, NFR-22, NFR-23, NFR-24.

**Covered FRs:** (no own FR — gates DR-8 + NFR-22/23/24)

**Acceptance Criteria:**

- **Given** any seven-route page with a contrast violation, **When** CI runs axe, **Then** the build fails with the offending element surfaced.
- **Given** the manual pass, **When** I navigate the app via VoiceOver, **Then** every interactive element is reachable and labelled.

**Complexity:** M

#### Story 11-5-ai-transparency-notice

**Ticket:** [#52](https://github.com/yabafre/pekulo/issues/52)
**Title:** First-LLM-suggestion notice + opt-in re-trigger

**Depends on:** 6-3-llm-opt-in, 6-4-llm-suggestion-ui

**As a** Pekulo user, **I want** an AI transparency notice the first time the LLM produces a user-visible suggestion (and re-shown on opt-out → opt-in transitions), **so that** I am informed of AI involvement per EU AI Act transparency obligations.

**Summary:** Owns the cross-route AI transparency notice **component** + opt-in → opt-out → opt-in re-trigger plumbing. Story `6-4-llm-suggestion-ui` _mounts_ the component on the suggestion row (per-row trigger); this story owns the component lifecycle, the re-trigger logic, and the parametres-side surface. Reference: DR-12.

**Covered FRs:** (no own FR — gates DR-12)

**Acceptance Criteria:**

- **Given** my first ever LLM-visible suggestion, **When** the row renders, **Then** the notice appears once and is dismissible.
- **Given** I opt out then opt back in, **When** the next suggestion appears, **Then** the notice is re-shown.

**Complexity:** S

#### Story 11-6-restore-drill-and-glitchtip

**Ticket:** [#53](https://github.com/yabafre/pekulo/issues/53)
**Title:** Supabase restore-from-snapshot drill + GlitchTip OTLP exporter

**Depends on:** 0-7-otel-three-runtimes, 0-3-api-scaffold

**As a** Pekulo developer, **I want** a restore-from-snapshot drill performed and documented within 30 days before the (b) ramp, plus a GlitchTip OTLP exporter wired into the OTel SDK, **so that** error capture (NFR-27) and recovery posture (NFR-21) are real before public.

**Summary:** Run the drill, write up the result in `docs/security.md`. Wire the GlitchTip OTLP destination on the OTel SDK with PII scrubbing enabled. Reference: NFR-21, NFR-25, NFR-27.

**Covered FRs:** (no own FR — gates NFR-21/25/27)

**Acceptance Criteria:**

- **Given** the drill, **When** I restore the latest snapshot to a staging Supabase project, **Then** the result is documented in `docs/security.md` and the procedure is runnable from the doc.
- **Given** an unhandled error in `apps/api`, **When** it fires, **Then** the trace lands in GlitchTip with PII scrubbed.

**Complexity:** M
