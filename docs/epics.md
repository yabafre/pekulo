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

**Total:** 65 FRs (59 original + 4 added 2026-05-25 per ADR-0015 + FR-64/FR-65 added 2026-06-01 via aped-course).

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

**Coverage:** 65/65 FRs owned by exactly one story. No orphans, no multi-cover. (FR-60/61 owned by 5-6-bridge-connector ; FR-62/63 owned by 5-7-bridge-ui ; FR-64 owned by 6-9-month-navigator ; FR-65 owned by 6-10-merchant-logos.)

## File Structure Design (epic-level)

| Epic | Path prefix(es)                                                                                                                                                                                                                                                                                                                                                                                                       | Single responsibility                                                                                           | Inputs → Outputs                                                                                                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `packages/{zod,types,validators,contracts,tsconfig,oxlint-config,ui}/`, `apps/api/src/{bootstrap,platform,database,common}/`, `.github/workflows/`, lefthook                                                                                                                                                                                                                                                          | Workspace primitives + Elysia runtime + Prisma layer + CI/CD + DS migration                                     | brownfield types/schemas → importable `@pekulo/*` + HTTP server + PR check matrix                                                                                                     |
| 1    | `apps/api/src/modules/{compass,milestones}/`, `apps/web/src/app/(cap)/{dashboard,parametres}/_components/compass-*`, `apps/api/src/common/derive/compass-progress.ts`                                                                                                                                                                                                                                                 | Target-capital + horizon + intermediate steps + status compute                                                  | Prisma `Hypothesis` + `CompassHistory` + `Milestone` → oRPC `/compass`, `/milestones` + Cap view fragments                                                                            |
| 2    | `apps/api/src/modules/accounts/`, `apps/web/src/app/(cap)/parametres/_components/accounts-*`                                                                                                                                                                                                                                                                                                                          | Account CRUD + balance log + Patrimoine tab                                                                     | Prisma `Account`, `AccountBalanceLog` → oRPC `/accounts/*` + settings/dashboard?tab=patrimoine fragments                                                                              |
| 3    | `apps/api/src/modules/holdings/` (+ `services/{prices,yahoo,boursorama,twelve-data,frankfurter}-client.ts` + `holdings.cache.ts`), `apps/api/src/common/derive/{portfolio-fx,holding-quantity,holding-pnl}.ts`, `apps/web/src/app/(cap)/portefeuille/_components/`                                                                                                                                                    | Holdings + lots + 4-tier price chain + FX + crypto enum                                                         | Prisma `Holding`, `HoldingLot` + external providers → oRPC `/holdings/*` + portefeuille screen                                                                                        |
| 4    | `apps/api/src/modules/realestate/`, `apps/api/src/common/derive/{rental-cashflow,property-equity}.ts`, `apps/web/src/app/(cap)/immobilier/_components/`                                                                                                                                                                                                                                                               | Properties + mortgage + rental + valuation history                                                              | Prisma `RealEstate`, `RealEstateMortgage`, `RealEstateRental`, `RealEstateValuation` → oRPC `/realestate/*` + immobilier screen                                                       |
| 5    | `apps/api/src/modules/{transactions,monthly,bank-aggregator}/` (bank-aggregator/ added 2026-05-25), `apps/api/src/modules/bank-aggregator/services/bridge-client.ts` (BankProvider impl per ADR-0015), `apps/api/src/common/derive/{transfer-rule,monthly-aggregates}.ts`, `apps/web/src/app/(cap)/{transactions,mensuel}/_components/`, `apps/web/src/app/(cap)/parametres/_components/bank-connections-section.tsx` | Transaction CRUD + CSV import + transfer detection + monthly aggregates + sign-off + bank connections (Bridge)  | Prisma `Transaction`, `MonthlyRecord`, `BankConnection` → oRPC `/transactions/*`, `/monthly/*`, `/bankaggregator/*` + transactions + mensuel screens + parametres connections section |
| 6    | `apps/api/src/modules/llm/` (+ `providers/{ollama,third-party,foundation-models}-client.ts` + `llm-prompt-builder.ts`), `apps/web/src/lib/llm/attest-queue.ts`, `apps/web/src/app/(cap)/{parametres,transactions}/_components/{llm,suggestion}-*`                                                                                                                                                                     | LLM routing + categorisation + per-call audit + opt-in guard + AI transparency                                  | Prisma `LlmCallLog`, `LlmOptIn` + provider endpoints → oRPC `/llm/*` + suggestion UI + activity log + opt-in toggle                                                                   |
| 7    | `apps/api/src/modules/{dashboard,hypothesis}/` (+ `derive/projection-curve.ts`), `apps/web/src/app/(cap)/dashboard/_components/`                                                                                                                                                                                                                                                                                      | Cross-domain aggregator + total wealth + projection comparison                                                  | compass + accounts + holdings + realestate + hypothesis → oRPC `/dashboard/*`, `/hypothesis/*` + Cap layout + Hypothèse card                                                          |
| 8    | `apps/web/src/app/(auth)/{login,signup,recover}/`, `apps/api/src/modules/{auth,settings}/`, `apps/web/src/lib/stores/{theme,lang}-store.ts`, `apps/web/src/app/(cap)/parametres/_components/{theme,lang}-*`                                                                                                                                                                                                           | Auth flows + theme/lang preferences                                                                             | Supabase Auth + Prisma `UserPref` → session + persisted preferences                                                                                                                   |
| 9    | `apps/web/src/app/manifest.ts`, `apps/web/src/sw.ts`, `apps/web/public/icons/`, `apps/web/src/components/install-prompt.tsx`                                                                                                                                                                                                                                                                                          | PWA install affordance + offline read-only cache                                                                | app metadata + last-snapshot per route → install prompt + Lighthouse PWA ≥90 + offline fallback                                                                                       |
| 10   | `@pekulo/ui/src/components/<comp>/<comp>.snapshot.test.tsx`, `apps/mobile/`, `.maestro/`                                                                                                                                                                                                                                                                                                                              | Visual parity web ↔ mobile (V1.5)                                                                               | `@pekulo/ui` components + oRPC client → snapshot artefacts + V1.5 mobile build                                                                                                        |
| 11   | `apps/api/src/modules/settings/{exportData,deleteAccount}.ts`, `docs/exports/schema-v1.json`, `docs/security.md`, axe + RLS-audit gates in `.github/workflows/pr.yml`, GlitchTip OTLP                                                                                                                                                                                                                                 | Pre-(b) public-ramp readiness — GDPR + a11y + ops hardening                                                     | per-user data + Supabase tier + codebase → JSON export + cascade deletion + failing CI on regressions + structured error capture                                                      |
| 12   | `apps/api/src/modules/advisory/`, `apps/api/src/common/derive/advisory-snapshot.ts`, `apps/api/src/platform/security/advisory-access-guard.ts`, `apps/web/src/app/(cap)/dashboard/advisory/`                                                                                                                                                                                                                          | Private internal AI advisory tool (non-product, ADR-0016)                                                       | allowlisted user data → deterministic snapshot + encrypted LLM advisory sessions                                                                                                      |
| 13   | `apps/api/src/modules/{advisory,bank-aggregator,settings}/`, `apps/api/src/platform/{http,security}/`, `apps/api/src/common/derive/portfolio-fx.ts`, `apps/web/src/app/(cap)/dashboard/portefeuille/`, `apps/mobile/lib/hooks/use-mobile-queries.ts`                                                                                                                                                                  | Pre-sale hardening — advisory crypto/consent, IBAN blind index, hashed logs, CORS/rate-limit, webhook inbox, FX | audit Lot A + ADR-0019 Step 1 + ADR-0022 → compliant, durable, FX-accurate baseline                                                                                                   |
| 14   | `packages/finance/`, `apps/api/src/modules/{billing,hypothesis,security-events}/`, `apps/api/src/platform/crypto/`, `apps/web/src/app/{page.tsx,calculateur,securite,demo,(legal)}/`, `.github/workflows/pr.yml`                                                                                                                                                                                                      | Web pre-sale, Stripe billing, real-euros projection, acquisition/retention & launch security                    | ADR-0019..0023 + GTM plan → paying web founders, client-side calculator, envelope crypto, 2FA, IDOR CI                                                                                |
| 15   | `apps/mobile/{app/login.tsx,app/(tabs)/transactions,lib/billing,assets,app.json,eas.json,docs}`, `.github/workflows/release-mobile.yml`                                                                                                                                                                                                                                                                               | Mobile store launch — signup/demo, RevenueCat IAP, crash reporting, EAS/OTA, list perf, ASO                     | ADR-0021 + Lot C → App Store & Google Play release builds ready for review                                                                                                            |

## Backlog

### Ramp tiering

| Tier                       | Epics                                                                          |
| -------------------------- | ------------------------------------------------------------------------------ |
| V1                         | epic-0, epic-1, epic-2, epic-3, epic-4, epic-5, epic-6, epic-7, epic-8, epic-9 |
| V1.5 deferred              | epic-10 (10-1 ships V1, 10-2..10-9 V1.5 mobile parity — done)                  |
| Public-ramp backlog        | epic-11 (done)                                                                 |
| Internal (non-product)     | epic-12 (done, ADR-0016 — excluded from paid tiers)                            |
| Pre-sale hardening         | epic-13 (Lot A bugs — immediate next active epic)                              |
| Web pre-sale & launch      | epic-14 (50 paying web clients, Stripe, `@pekulo/finance`, launch security)    |
| Mobile store launch (post) | epic-15 (frozen until after 50 paying web clients)                             |

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

> **Realized scope (2026-06-05) — supersedes the summary above, does not replace it.** During the `aped-story` design gate the scope was expanded (user decision) from a fixed-order Cap page to a **configurable widget system**: every widget can be drag-reordered and shown/hidden, with the layout persisted **server-side per user** (new `dashboard_layout` table + `dashboard.getLayout`/`saveLayout` oRPC procedures). dnd-kit is lazy-loaded behind a `dynamic(ssr:false)` boundary so it never enters the default bundle (AC-3). `recentActivity` was added to the 7-1 dashboard overview DTO (server-resolved label/logo/direction). Composition + Recent-activity are shared between the Cap and Patrimoine views. FR-41 / U1 are guaranteed on the **default layout only** (customisation is opt-in) — see **ADR-0017**. The AC set is now **AC-1..AC-9** (default-order, nav, Lighthouse + dnd bundle isolation, reorder, visibility + reset, graceful fallback, data states, total-wealth source, composition). Shipped as one XL story; doc-sync paid in the same change (lesson 2026-05-31). Realized AC set lives in `docs/stories/7-2-dashboard-cap-page.md` and ticket #39.

**Complexity:** XL (expanded from L)

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

**Summary:** Implement `apps/web/public/sw.js` (app-shell runtime caching) + an encrypted IndexedDB persister for the React Query cache, scoped per userId, per ADR-0018 (which supersedes ADR-0003 — the session is httpOnly and the screens read through Server Actions). Honour the 60-minute staleness ceiling (NFR-20). Kept as one story by user decision 2026-07-25.

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

> **Realized scope (2026-11-16, Option A split) — supersedes the summary above without deleting it.** Rescoped at `aped-story` step-04 (user-approved) per Lesson 2026-06-05: `10-2` aligns the monorepo on `react@19.3.0` + `next@16.4.6` and delivers the `@pekulo/mobile` Expo SDK 58 Dev Build (`expo-dev-client`) + `expo-router` (`expo-router/native-tabs` + `Stack`, 5 tabs + Paramètres modal), the `@pekulo/ui` dual web/native foundation (`animations.{ts,native.ts}`, `fonts.{ts,native.ts}`, `provider/index.native.tsx`, `index.native.ts` via `"react-native"` export condition), Tamagui optimizing compiler (`@tamagui/babel-plugin` + `@tamagui/metro-plugin`), two cross-platform pilot components (`PekuloHero`, `PekuloStat`), Jest 30 / RNTL tests, and `.maestro/smoke.yaml`. Remaining V1.5 work is split into three follow-up stories below.

**Complexity:** M (rescoped from L via Option A split)

#### Story 10-3-ui-native-parity

**Ticket:** [#154](https://github.com/yabafre/pekulo/issues/154)
**Title:** Port remaining 41 web-coupled `@pekulo/ui` files to cross-platform React Native

**Depends on:** 10-2-mobile-app-bootstrap

**As a** Pekulo developer, **I want** all remaining `@pekulo/ui` primitives and `Pekulo*` components (`lucide-react-native`, `react-native-svg` for `PekuloDonut`/charts, native sheets/pickers, removal of `var(--)` / `<style>`) ported to native and re-exported from `index.native.ts`, **so that** mobile screens consume the complete Pekulo Design System without web-DOM forks.

**Covered FRs:** FR-55, FR-56 (native DS component parity)
**Complexity:** L

#### Story 10-4-mobile-auth-and-orpc

**Ticket:** [#155](https://github.com/yabafre/pekulo/issues/155)
**Title:** Wire Supabase Auth (`expo-secure-store`) and `@pekulo/contracts` oRPC client in `apps/mobile`

**Depends on:** 10-2-mobile-app-bootstrap, 10-3-ui-native-parity

**As a** Pekulo user, **I want** to sign in on mobile and view my live Cap, Transactions, Mensuel, Portefeuille, and Immobilier data via `@pekulo/contracts`, **so that** my mobile app mirrors my live Pekulo account.

**Covered FRs:** FR-46, FR-56 (live mobile data)
**Complexity:** L

#### Story 10-5-mobile-parity-and-maestro

**Ticket:** [#156](https://github.com/yabafre/pekulo/issues/156)
**Title:** Automated iOS/Android pixel-diff parity assertions and CI Maestro E2E suite

**Depends on:** 10-3-ui-native-parity, 10-4-mobile-auth-and-orpc

**As a** Pekulo developer, **I want** visual parity checks against the `10-1` web snapshots and the full Maestro E2E suite wired into CI, **so that** visual regressions and navigation breaks are caught before App Store / Play Store release.

**Covered FRs:** FR-56 (parity verification & Maestro CI)
**Complexity:** M

> **Realized scope (2026-11-22, step-04, user-approved) — supersedes the title and summary above without deleting them.** The 10-1 web snapshots are DOM/atomic-class inline snapshots, not images, so "pixel-diff against the 10-1 snapshots" is implemented as a hybrid: (1) a deterministic web ↔ native **text-style token-parity gate** — `@pekulo/ui/parity` catalog covering all 42 components, web baseline `packages/ui/src/parity/__baseline__/web-text-styles.json` (vitest), native comparison `apps/mobile/__tests__/ds-token-parity.test.tsx` (Jest); (2) **iOS screenshot goldens** of every component from a flag-gated in-app DS gallery (`pekulo://ds/<case>`), asserted by Maestro. The Maestro suite (`smoke`, `navigation`, `preview-guard`, `ds-gallery`) runs on **EAS Workflows** via a custom `runs_on: macos-medium` job (Free-plan compatible, non-required check) against an iOS Simulator build in preview mode, on PRs to `main` touching mobile-relevant paths. **iOS only** — Android moves to `10-6`. Primitives parity is a follow-up. _(Superseded by 10-6, 2026-11-26: the EAS iOS workflows were replaced by `.github/workflows/e2e-mobile.yml` on GitHub Actions and the single `ds-gallery.yaml` by generated per-platform shards — see the 10-6 realized scope below.)_

**Complexity:** L (re-estimated from M)

#### Story 10-6-android-parity-and-maestro

**Ticket:** [#162](https://github.com/yabafre/pekulo/issues/162)
**Title:** Android build, native-surface adaptation, and Maestro E2E on an Android emulator

**Depends on:** 10-5-mobile-parity-and-maestro

**As a** Pekulo user on Android, **I want** the mobile app to build, behave, and pass the same Maestro suite on Android, **so that** the V1.5 app ships on both stores with the parity guarantees 10-5 established for iOS.

**Summary:** Run the first `android/` prebuild, replace the iOS-only surfaces shipped in 10-4 (`ActionSheetIOS`, `Alert.prompt`, iOS `formSheet` detents, SF Symbols) with cross-platform equivalents, add an Android build + custom Android emulator Maestro job to the EAS workflows, and capture Android goldens for the `ds-gallery` flow.

**Covered FRs:** FR-56 (Android parity)
**Complexity:** M

> **Realized scope (2026-11-24, step-04, user-approved) — supersedes the summary above without deleting it.** The Android audit found `Stack.Toolbar` throws on Android without `@expo/ui` (tabs, Paramètres, all form sheets), `Alert.alert` caps menus at 3 buttons, and `Alert.prompt` is iOS-only. Delivered: platform-split headers (`headerRight` tabs, in-content sheet header, headerless sheets with `sheetElevation: 0`), a DS `ActionSheetHost` (`PekuloDrawer`) for Android menus, an Android-only `sheets/delete-account` typed-email sheet sharing `isDeletionEmailConfirmed` with iOS, Material Symbol names for every `SymbolView` (meta-test), labelled grayscale Android tab bar, a Jest `android` project (`jest-expo/android`), the `e2e-test` APK and 42 Android goldens. Mid-story (user request, 2026-11-26) the Maestro E2E moved from EAS Workflows to GitHub Actions (`.github/workflows/e2e-mobile.yml`: iOS on `macos-26`, Android on `ubuntu-24.04`, iOS native build cached under `@expo/fingerprint`, DS gallery gated on DS/gallery/golden paths and split into 4 shards per platform with a per-case Maestro `retry`). iOS app behaviour unchanged.

**Complexity:** L (re-estimated from M)

#### Story 10-7-store-compliance-and-agent-testers

**Ticket:** [#163](https://github.com/yabafre/pekulo/issues/163)
**Title:** App Store / Google Play pre-submission compliance hardening & Mobile Agent Testers kit

**Depends on:** 10-5-mobile-parity-and-maestro

**As a** Pekulo user and app publisher, **I want** public web legal and account-deletion pages, an accurate iOS Privacy Manifest, export compliance, RGB no-alpha app icons, Keychain backup exclusion, a release fail-fast guard, Apple 5.1.2(i) AI consent and EU AI Act Art. 50 notice on mobile, tactile haptics, and a Mobile Agent Testers kit, **so that** Pekulo V1.5 passes Apple App Store and Google Play pre-submission audits cleanly.

**Summary:** Adds public HTTP 200 `/privacy`, `/terms` (including EAA Annex V), `/support`, and `/account-deletion` routes in `apps/web`, wires in-app legal links, canonical RGB no-alpha icons, `usesNonExemptEncryption: false`, complete `privacyManifests`, Keychain `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`, release Supabase fail-fast guard, Apple 5.1.2(i) provider-naming AI consent modal, mobile `AiTransparencyNotice` (story 11-5 parity), `expo-haptics`, `.app-review-readiness.json`, `REVIEW-NOTES.md`, English `apps/mobile/.agent-testers/` kit for the public Bun/Expo monorepo, vendored skills, and a class-killer `store-compliance.test.ts` meta-test. Runs in parallel with `10-6-android-parity-and-maestro`.

**Covered FRs:** FR-34, FR-50, FR-55, FR-56 (store compliance & AI testing readiness)
**Complexity:** L

#### Story 10-8-native-geist-font

**Ticket:** [#166](https://github.com/yabafre/pekulo/issues/166)
**Title:** Render every `@pekulo/ui` text in Geist on iOS and Android

**Depends on:** 10-6-android-parity-and-maestro

**As a** Pekulo mobile user, **I want** every `@pekulo/ui` text on iOS and Android to render in Geist like the web PWA, **so that** the native app matches the design system instead of falling back to SF Pro / Roboto.

**Summary:** Two defects kept native DS text in the system font: no native `Text` default `fontFamily` (Tamagui only swaps in the weight-matched face when a family is set), and `@tamagui/static` loading the compiler config with a Node `require()` that resolves the web `fonts.ts`. Shared `createPekuloConfig()` factory, a native compiler config importing `fonts.native` explicitly, a native-only `defaultProps.Text.fontFamily = "$body"`, Geist on native inputs and the breadcrumb link, parity gate reading weight from the face, Jest proof on iOS + Android, web output byte-identical, goldens recaptured on both platforms.

**Covered FRs:** FR-56 (native typography parity)
**Complexity:** M

#### Story 10-9-android-e2e-emulator-stability

**Ticket:** [#168](https://github.com/yabafre/pekulo/issues/168)
**Title:** Make the Android core Maestro job green on main and PRs

**Depends on:** 10-6-android-parity-and-maestro

**As a** Pekulo maintainer, **I want** the e2e-mobile Android core job to pass on `main` and on every mobile PR, **so that** Android end-to-end results are a signal again.

**Summary:** The post-job `actions/cache` save never ran because the job failed, so every run cold-booted a fresh AVD snapshotted 3 s after boot; the launcher then raised a system ANR dialog ("Quickstep isn't responding") over the app and every core flow failed on its first Cap check. Split AVD cache restore/save (key v2), settle the emulator (launcher idle, ANR answered with Wait) before snapshot and tests, shared Maestro Cap-wait subflow that answers the dialog, `centerElement` on the preview-guard toggle (it sat under the navigation bar with taller text), Jest drift guard, green CI proof.

**Covered FRs:** FR-56 (Android E2E signal)
**Complexity:** S

## Epic 11: Public-ramp readiness

**Goal:** Land every gate that must be green before the (a)→(b) public ramp triggers — GDPR data export + account deletion, RLS audit + at-rest encryption documentation, axe + WCAG gates, AI transparency notice, restore-from-snapshot drill, and GlitchTip wiring.

**Sequencing:** Mixed tier. `11-3` (RLS audit + encryption doc) shipped first — it prevents regressions in every new domain story. `11-1` (export) and `11-2` (deletion) are **V1 (a)**, not (b)-gated: `docs/rgpd-readiness.md` establishes that GDPR applies from the first user other than the author, and V1 (a) onboards proches. `11-4` (axe + WCAG gates) is pulled into V1 (a) by `docs/v1-definition-of-done.md` §1. `11-5` and `11-6` are now unblocked: the (b) ramp decision has been taken, staging Supabase is available, and the self-hosted GlitchTip instance is deployed on Dokploy (`11-6` records the transport correction — Sentry SDK for errors, OTel/SigNoz for traces).

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

**Summary:** Implement `settings.service.deleteAccount` — Bridge erasure first (fail-closed), then an explicit `DELETION_NODES` fan-out over all 21 user-scoped tables in one transaction, then `auth.admin.deleteUser` — plus `delete-account-row.tsx` + `delete-account-confirm.tsx` (destructive variant, typed-email confirmation). Adds the four missing `auth.users` FK cascades and a static gate that keeps them. Honour the 60 s budget (NFR-7).

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
**Title:** Supabase restore-from-snapshot drill + GlitchTip error capture

**Depends on:** 0-7-otel-three-runtimes, 0-3-api-scaffold

**As a** Pekulo developer, **I want** a restore-from-snapshot drill performed and documented within 30 days before the (b) ramp, plus a GlitchTip OTLP exporter wired into the OTel SDK, **so that** error capture (NFR-27) and recovery posture (NFR-21) are real before public.

**Summary:** Run the drill, write up the result in `docs/security.md`. Wire the GlitchTip OTLP destination on the OTel SDK with PII scrubbing enabled. Reference: NFR-21, NFR-25, NFR-27.

**Covered FRs:** (no own FR — gates NFR-21/25/27)

**Acceptance Criteria:**

- **Given** the drill, **When** I restore the latest snapshot to a staging Supabase project, **Then** the result is documented in `docs/security.md` and the procedure is runnable from the doc.
- **Given** an unhandled 5xx in `apps/api` or `apps/web`, **When** it fires, **Then** one error event lands in GlitchTip with PII scrubbed (Sentry SDK; GlitchTip 6.2 has no OTLP trace receiver), while the trace stays in SigNoz via OTel.

**Complexity:** M

## Epic 12: Private internal AI advisory tool — 🔒 internal / non-product

**Goal:** A private, access-gated surface where the owner and a closed circle of name-authorized users get LLM analysis + recommendations (including instrument-level) over their own Pekulo data, backed by a deterministic analysis engine. This is **NOT** part of the public product.

**Requirement source:** `docs/adr/0016-private-internal-ai-advisory-surface.md` — NOT the public PRD FR set. The public 63/63 FR coverage is unchanged; this epic introduces no public FR, no orphan, no phantom. The public **DR-3** ("no buy/sell recommendation, ever") and **NFR-12** ("0 amounts to LLM") remain fully in force everywhere else — ADR-0016 scopes the two exceptions to this surface only.

**Regulatory guardrail (binding):** lawful only while the surface stays private / free / closed-circle / non-habitual. The allowlist + ban (story 12-1) is the **technical control** that enforces the boundary; opening to the public or growing the circle is the flip point → `conseil en investissement` → CIF/PSI or licensed partner (ADR-0016 §2, Pivot conditions).

**Sequencing:** standalone, post-V1-foundation. Reuses done modules (epics 1-6) + the epic-6 LLM foundation. No forward dependency on pending epics (7/8). **Registered, NOT added to the active sprint** (active epic stays 6).

**Tiering:** Internal tools (non-product) — outside the V1 / V1.5 / public-ramp tiering.

#### Story 12-1-advisory-access-gate

**Ticket:** [#114](https://github.com/yabafre/pekulo/issues/114)
**Title:** Allowlist + ban access gate for the private advisory surface

**Depends on:** none

**As a** the advisory-surface owner, **I want** to authorize specific Pekulo users (and ban them) so the tool stays a closed private circle, **so that** the regulatory boundary of ADR-0016 is enforced in code, not by policy.

**Summary:** New `advisory_access` RLS table (`user_id` → `auth.users(id) ON DELETE CASCADE`, `status: active | banned`, `granted_by`, `granted_at`, `banned_at`) + `apps/api/src/platform/security/advisory-access-guard.ts` (iso `opt-in-guard.ts`) enforcing membership server-side on every advisory request; ban takes effect on the next request. Creates the `apps/api/src/modules/advisory/` module skeleton + `advisoryContract` scaffold at `/rpc/v1/advisory`. This is the compliance control of ADR-0016 §2/§4. `advisory_access` ships its per-row RLS quartet (`auth.uid() = user_id` on SELECT/INSERT/UPDATE/DELETE) so the 11-3 RLS-audit CI gate passes. Reference: ADR-0013 (RLS + `where: { userId }` + `no-prisma-query-without-user-id`), ADR-0016.

**Covered FRs:** (internal advisory surface — ADR-0016 §4 + §2 guardrail; no public-PRD FR)

**Acceptance Criteria:**

- **Given** a non-allowlisted user, **When** they hit any `/rpc/v1/advisory` route, **Then** the gate rejects with 403 in < 100 ms (iso NFR-9) and no advisory data is computed.
- **Given** an allowlisted `active` user, **When** they hit an advisory route, **Then** the gate resolves and the request proceeds.
- **Given** the owner bans a user, **When** that user makes their next request, **Then** the gate rejects immediately (no cached pass).
- **Given** a previously banned user re-set to `active`, **When** they request again, **Then** access is restored.

**Complexity:** M

#### Story 12-2-advisory-analysis-engine

**Ticket:** [#115](https://github.com/yabafre/pekulo/issues/115)
**Title:** Deterministic advisory analysis engine (the numbers layer)

**Depends on:** 12-1-advisory-access-gate, 1-1-compass-domain, 3-1-holdings-orpc-port, 4-1-realestate-domain, 5-1-transactions-record

**As a** an authorized advisory user, **I want** a deterministic snapshot of my financial situation (wealth, allocation, gap-to-compass, cashflow, fiscalité signals), **so that** any recommendation is grounded in computed figures, never LLM-invented numbers.

**Summary:** `apps/api/src/common/derive/advisory-*.ts` composes the existing done derives (`compass-progress`, `portfolio-fx`, `property-equity`, `monthly-aggregates`) into a structured advisory snapshot, exposed through the `advisory` module service. **The engine owns every number** (ADR-0016 §3 / NFR-12 exception); no LLM call in this story. Degrades gracefully when a domain is empty (no holdings / no real-estate). Reference: ADR-0016 §3.

**Covered FRs:** (internal advisory surface — ADR-0016 §3; no public-PRD FR)

**Acceptance Criteria:**

- **Given** a user with compass + portfolio + accounts + real-estate + transactions, **When** the engine runs, **Then** it returns a deterministic snapshot with total wealth, allocation %, gap-to-cap, and monthly cashflow — every figure computed by the engine.
- **Given** a user with no holdings, **When** the engine runs, **Then** the snapshot omits the portfolio block without error (graceful degradation).
- **Given** the same inputs twice, **When** the engine runs, **Then** the snapshot is identical (deterministic).

**Complexity:** L

#### Story 12-3-advisory-llm-surface

**Ticket:** [#116](https://github.com/yabafre/pekulo/issues/116)
**Title:** Advisory LLM surface — analysis + recommendations over the deterministic snapshot

**Depends on:** 12-2-advisory-analysis-engine, 6-1-llm-routing-and-providers

**As a** an authorized advisory user, **I want** the LLM to analyse my deterministic snapshot and produce analysis + recommendations (including instrument-level), **so that** I get goal-aligned guidance on my own data — privately.

**Summary:** Dedicated `apps/api/src/modules/advisory/advisory-prompt-builder.ts` (DISTINCT from `llm-prompt-builder.ts`, which keeps the NFR-12-strict categorisation allowlist untouched) + an advisory task that feeds 12-2's snapshot to the LLM and returns analysis + recommendations. Routes through the epic-6 LLM foundation (`LlmProvider`, routing); writes its own `llm_call_log` intent/outcome pairs through the single server-side writer (ADR-0008, server-as-authority). Advisory sessions persisted with per-user RLS + **field-level encryption at rest** (`advisory_session`, iso ADR-0015; ships its per-row RLS policies for the 11-3 RLS-audit gate). Provider posture: no-train default + EU region + ZDR. The DR-3 carve-out + NFR-12 exception (ADR-0016 §2/§3) live here. The LLM explains/recommends but never emits a figure absent from the snapshot. Reference: ADR-0008, ADR-0015, ADR-0016 §2/§3/§5.

**Covered FRs:** (internal advisory surface — ADR-0016 §2 + §3 + §5; no public-PRD FR)

**Acceptance Criteria:**

- **Given** a deterministic snapshot, **When** the advisory task runs, **Then** the LLM returns analysis + recommendations and surfaces no monetary figure that is not present in the snapshot.
- **Given** an advisory call, **When** it completes, **Then** an intent + outcome pair is written via the single LLM writer with no prompt content persisted (NFR-26 iso).
- **Given** a persisted advisory session, **When** it is stored, **Then** it is per-user RLS-scoped and field-level encrypted at rest.
- **Given** the configured provider, **When** the surface initialises, **Then** the no-train + EU-region posture is asserted (build/config check).

**Complexity:** L

#### Story 12-4-advisory-private-page

**Ticket:** [#117](https://github.com/yabafre/pekulo/issues/117)
**Title:** Private advisory page (gated route + UI + disclaimer)

**Depends on:** 12-1-advisory-access-gate, 12-3-advisory-llm-surface, 0-10-pekulo-ui-migration

**As a** an authorized advisory user, **I want** a private page that shows my advisory analysis + recommendations, **so that** I can use the tool through the app behind the access gate.

**Summary:** Private route/page at `apps/web/src/app/(cap)/dashboard/advisory/` (under `dashboard/` so the CapShell layout applies — lesson 2026-05-27), gated by 12-1, rendering 12-3's analysis + recommendations plus a clear **"private internal tool — not regulated investment advice"** notice. UI sourced from `@pekulo/ui`; provider/route transparency surfaced iso the epic-6 badge. Reference: ADR-0016 §1/§2.

**Covered FRs:** (internal advisory surface — ADR-0016 §1 + §2; no public-PRD FR)

**Acceptance Criteria:**

- **Given** an allowlisted user, **When** they open `/dashboard/advisory`, **Then** the analysis + recommendations render with the "not regulated advice" notice visible.
- **Given** a non-allowlisted or banned user, **When** they navigate to `/dashboard/advisory`, **Then** they cannot reach the surface (server-side gate, no advisory data leaks to the client).
- **Given** the rendered page, **When** a recommendation is shown, **Then** the active provider/route is surfaced for transparency.

**Complexity:** M

## Epic 13: Pre-sale security, GDPR & financial accuracy hardening

**Goal:** Close every confirmed security, GDPR, webhook durability, and multi-currency portfolio accuracy defect surfaced by the 9-agent audit and Architecture Council (C3, C5) before onboarding paying customers.

**Requirement source:** `docs/triage-decision.md` (Lot A A1–A8), `docs/adr/0019-per-user-envelope-encryption-and-crypto-shredding.md` (Step 1), `docs/adr/0022-webhook-inbox-durability-and-api-security-perimeter.md`, NFR-13/14/19/25/33, FR-18/19/49/60/61/63. Existing 65/65 PRD FR ownership stays intact; these stories harden shipped requirements before public monetization.

**Sequencing:** Immediate next active epic (`active_epic: 13`). All 5 stories carry `depends_on: none` and can execute in parallel.

#### Story 13-1-advisory-crypto-and-consent

**Ticket:** [#171](https://github.com/yabafre/pekulo/issues/171)
**Title:** Fix advisory encryption key, EU provider posture, opt-in consent, and GDPR export decryption

**Depends on:** none

**As a** closed-circle advisory user, **I want** my advisory sessions encrypted with a dedicated key, sent only to verified EU providers after explicit consent, and decrypted cleanly in my GDPR export, **so that** my financial data stays compliant and portable.

**Summary:** Require fail-closed `ADVISORY_ENCRYPTION_KEY` in `env.ts` (removing the hardcoded fallback in `apps/api/src/modules/advisory/advisory.module.ts:51` and `SUPABASE_SERVICE_ROLE_KEY` reuse in `apps/api/src/bootstrap/runtime-dependencies.ts:318`) with a versioned ciphertext prefix `v1:<keyId>:` and legacy dual-read migration; restrict `advisory-posture.ts` to verified EU endpoints (removing `openrouter.ai` and the `hostname.startsWith("eu-")` bypass); enforce explicit user opt-in in `advisory-llm.service.ts` before invoking external LLMs (NFR-13); decrypt `advisory_sessions.encrypted_payload` inside `settings.export.ts` for GDPR Art. 20 portability (FR-49). Reference: ADR-0016, ADR-0019 Step 1.

**Covered FRs:** FR-49 (hardens GDPR export integrity for advisory sessions); gates NFR-13, NFR-14, ADR-0016, ADR-0019 Step 1.

**Acceptance Criteria:**

- **Given** `ADVISORY_ENCRYPTION_KEY` is missing or weak in non-test environments, **When** `apps/api` boots, **Then** boot fails fast with a configuration error and no hardcoded fallback key is ever used.
- **Given** an advisory provider URL pointing to `openrouter.ai` or `eu-evil.example`, **When** `assertAdvisoryProviderPosture` runs, **Then** it throws `BAD_REQUEST`.
- **Given** an allowlisted user who has not opted in to third-party LLM processing, **When** they call `advisory.generateAnalysis`, **Then** the request is rejected before any external LLM call is made.
- **Given** an allowlisted user with persisted advisory sessions, **When** they download `GET /v1/export`, **Then** `advisory_sessions` entries contain decrypted JSON rather than raw ciphertext.

**Complexity:** M

#### Story 13-2-iban-blind-index-and-logs

**Ticket:** [#172](https://github.com/yabafre/pekulo/issues/172)
**Title:** Hash userId in API request logs and replace plaintext IBAN keys with user-scoped HMAC blind indexes

**Depends on:** none

**As a** Pekulo user who links bank accounts, **I want** my raw user ID absent from stdout logs and my IBAN never stored in plaintext in Postgres, **so that** log leaks or logical database dumps cannot expose my banking identity.

**Summary:** Replace raw `userId` in `apps/api/src/platform/http/request-log.ts:28` and `orpc-mount.ts:74,87` with `hashUserId()` (NFR-25) and scrub raw IBANs from `bank-aggregator.service.ts:220` warnings. Backfill `accounts.providerId` on legacy `pid:...` rows so `logos.service.ts` stays intact, normalize IBANs (`trim().toUpperCase().replace(/\s+/g, "")`), and migrate `accounts.provider_account_key` `iban:*` values to user-scoped HMAC-SHA-256 blind indexes (`iban_hmac:<hex>` via `HMAC-SHA256(IBAN_HMAC_KEY, "${userId}:${normalizedIban}")`), fail-closed at boot in `env.ts`. Reference: ADR-0019 Step 1, NFR-14, NFR-25.

**Covered FRs:** FR-60, FR-61 (hardens Bridge account deduplication); gates NFR-14, NFR-25, ADR-0019 Step 1.

**Acceptance Criteria:**

- **Given** any authenticated oRPC request, **When** `logRpcRequest` emits a stdout JSON line, **Then** `userId` is a deterministic 16-hex SHA-256 hash and never the raw UUID.
- **Given** a Bridge sync returning an account with an IBAN, **When** `findOrCreateAutoFromProvider` persists the account, **Then** `provider_account_key` stores `iban_hmac:<hex>` scoped to `userId` and reconnecting the same bank deduplicates without creating duplicate accounts.
- **Given** two different users sharing a joint-account IBAN, **When** both link the account, **Then** their `provider_account_key` HMAC digests differ.

**Complexity:** M

#### Story 13-3-api-cors-and-rate-limiting

**Ticket:** [#173](https://github.com/yabafre/pekulo/issues/173)
**Title:** Enforce Elysia CORS allowlist and bounded per-user/IP rate limiting across API entry points

**Depends on:** none

**As a** Pekulo operator, **I want** `apps/api` to enforce origin allowlists and per-user/IP request budgets across every endpoint, **so that** browser cross-origin abuse and runaway API traffic cannot degrade service for other users.

**Summary:** Mount `@elysiajs/cors` in `apps/api/src/app.ts` with a strict `apps/web` + dev origin allowlist (`credentials: false`), allowing requests with missing `Origin` (SSR Server Actions, native mobile, webhooks) while preserving `bridge-webhook-router.ts`'s `onParse` raw `Uint8Array` body capture. Enforce a bounded-LRU per-`userId` rate limiter inside `requireUserContext` (covering `orpc-mount.ts`, `settings.export-routes.ts`, and `llm.attest-router.ts`, with tighter budgets on `/v1/export`, `refreshConnection`, and `advisory.*`) plus a bounded-LRU Caddy-pinned client-IP limiter on public routes (`/v1/logos`, future public endpoints). Exempt HMAC-verified webhooks. Reference: ADR-0022, NFR-9, NFR-15.

**Covered FRs:** (hardens platform perimeter across FR-1..FR-65); gates NFR-9, NFR-15, ADR-0022.

**Acceptance Criteria:**

- **Given** a browser request with a disallowed `Origin`, **When** it hits `apps/api`, **Then** no permissive `Access-Control-Allow-Origin` header is returned, while configured web origins and requests without `Origin` (SSR/mobile/webhooks) succeed.
- **Given** an authenticated user exceeding their per-minute quota on `/rpc/v1/*`, `/v1/export`, or `/internal/llm/attest`, **When** the next request arrives, **Then** `apps/api` returns HTTP 429 without throttling other users sharing the same Vercel egress IP.
- **Given** a Bridge webhook POST with raw JSON bytes, **When** CORS middleware is active, **Then** `onParse` still captures the exact `Uint8Array` and HMAC verification passes.

**Complexity:** M

#### Story 13-4-durable-webhook-inbox

**Ticket:** [#174](https://github.com/yabafre/pekulo/issues/174)
**Title:** Persist verified Bridge webhooks in a durable Postgres inbox with replay dedup and ordered draining

**Depends on:** none

**As a** Pekulo user with connected bank accounts, **I want** incoming Bridge sync and SCA notifications to survive server deploys and never be silently dropped or replayed, **so that** my balances and SCA alerts stay reliable.

**Summary:** Add Postgres `webhook_inbox` table (`provider`, `dedup_key`, `event_type`, `resource_key`, `payload_minimal`, `status`, `attempts`, `next_retry_at`, `locked_until`; RLS enabled with 0 policies; registered in `ID_PREFIXES`, `NON_USER_MODELS`, and `rls-migration-audit.ts`). Persist verified Bridge webhooks idempotently strictly **after** the 256 KB cap + HMAC check and **before** returning HTTP `204`, keying `dedup_key` on verified body event identity (closing the unsigned `t=` header replay vector in `webhook-verifier.ts`). Wire a drainer in `apps/api/src/bootstrap/schedulers.ts` using `FOR UPDATE SKIP LOCKED`, `locked_until > SHUTDOWN_TIMEOUT_MS`, 3–5 worker concurrency cap, per-`providerItemId` serialization preserving distinct status transitions (`1010/sca_required`), exponential backoff, dead-letter capture to GlitchTip, and 14–30 day auto-pruning. Reference: ADR-0022, NFR-33.

**Covered FRs:** FR-61, FR-63 (hardens Bridge webhook ingestion); gates NFR-33, ADR-0022.

**Acceptance Criteria:**

- **Given** an invalid HMAC signature on `/internal/bridge/webhook`, **When** received, **Then** `apps/api` returns 401 in < 100 ms with zero rows written to `webhook_inbox`.
- **Given** a valid Bridge webhook, **When** `apps/api` returns HTTP `204`, **Then** the event is already committed to `webhook_inbox` and a replayed request with a modified `t=` header is deduplicated with no duplicate sync.
- **Given** a `status_code=1010` (`sca_required`) webhook arriving while a `status_code=0` refresh is in flight for the same item, **When** the inbox drains, **Then** both transitions are processed in order and `sca_required` is never dropped.
- **Given** a container restart mid-processing, **When** the `locked_until` lease expires, **Then** the drainer reclaims and completes or dead-letters the row with a GlitchTip alert.

**Complexity:** M

#### Story 13-5-fx-accuracy-and-ui-badges

**Ticket:** [#175](https://github.com/yabafre/pekulo/issues/175)
**Title:** Fix multi-currency FX conversion on web/mobile Portfolio and surface fallback warning badges

**Depends on:** none

**As an** investor holding USD, GBP, or CHF assets, **I want** my portfolio totals converted accurately to EUR on both web and mobile — and a clear warning whenever any currency falls back to 1:1 — **so that** my displayed net worth is never silently distorted.

**Summary:** Update `apps/api/src/common/derive/portfolio-fx.ts` so a missing per-currency rate flips `fxSource` to `"fallback"` and exposes `missingCurrencies: string[]` instead of claiming `"live"`. Replace raw native-currency summation in `apps/web/src/app/(cap)/dashboard/portefeuille/_components/portfolio-section.tsx` (`approxEurValue`) and `apps/mobile/lib/hooks/use-mobile-queries.ts:715` (`useMobilePortfolioData`) with the FX-resolved snapshot. Render an accessible FX-fallback warning banner/badge on web Dashboard, web Portefeuille, and mobile Cap/Portefeuille whenever `fxSource === "fallback"`. Reference: NFR-19, FR-18, FR-19, `docs/architecture.md:92`.

**Covered FRs:** FR-18, FR-19 (fixes FX accuracy & transparency); gates NFR-19.

**Acceptance Criteria:**

- **Given** a portfolio containing a USD holding when `rates.rates.USD` is absent (even if other currencies succeeded), **When** `computeSnapshotFx` runs, **Then** `fxSource` is `"fallback"` and `missingCurrencies` includes `"USD"`.
- **Given** a user with USD/GBP/CHF holdings and live ECB rates, **When** they open `/dashboard/portefeuille` on web or the Portefeuille tab on mobile, **Then** totals and P&L reflect EUR-converted values matching `/dashboard`.
- **Given** `fxSource === "fallback"`, **When** the user views Dashboard or Portefeuille on web or mobile, **Then** a visible, accessible warning indicates approximate 1:1 conversion.

**Complexity:** M

## Epic 14: Web pre-sale, Stripe billing, real-euros projection & launch security

**Goal:** Enable prospective French FIRE investors to discover Pekulo, test a real-euros projection calculator and fictional demo mode, subscribe to the Founder €49/yr or Plus plan with full French B2C legal compliance, and rely on production-grade envelope encryption, 2FA, automated IDOR tests, and instant session revocation.

**Requirement source:** `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`, `docs/spikes/2026-11-26-securite-chiffrement-rust.md`, `docs/triage-decision.md` (Lot B), ADR-0019 (Step 2), ADR-0021 (Web Stripe), ADR-0022 (JWT revocation), ADR-0023 (`@pekulo/finance`). _(Numbering note: the GTM plan and `docs/triage-decision.md` referred to this pre-sale work as "Epic 13" prior to splitting Lot A hardening out into Epic 13.)_

**Sequencing:** Follows Epic 13 (stories with `depends_on: none` may start in parallel as Epic 13 wraps). Targets 50 paying web clients before unfreezing Epic 15.

#### Story 14-1-shared-finance-real-projection

**Ticket:** [#176](https://github.com/yabafre/pekulo/issues/176)
**Title:** Extract `@pekulo/finance` real-euros Fisher projection engine with 3 deterministic scenarios

**Depends on:** none

**As a** long-term saver planning a 20–30 year horizon, **I want** my Cap projection adjusted for inflation and fees with pessimistic, realistic, and optimistic trajectories in constant today's euros, **so that** my monthly gap verdict reflects real purchasing power.

**Summary:** Create zero-dependency workspace package `packages/finance` migrating `projection-curve.ts`, `hypothesis-gap.ts`, and `compass-curve.ts`. Implement exact Fisher real-rate (`r_real = (1 + r_net) / (1 + inflationRate) - 1`), `r_net = annualRate - annualFeeDrag`, effective monthly compounding `i_m = (1 + r)^(1/12) - 1` using `Math.expm1(m * Math.log1p(i_m))` with linear fallback for `|i_m| < 1e-12`, negative real-rate bounds (`r > -0.5`), `P < 0` band-inversion guard (`max(0, P)` + uncompounded debt offset), 3 deterministic scenarios (`r_net ± scenarioSpread`), and `displayMode: 'real' | 'nominal'` (default `'real'`) with exact `FV_real === FV_nom / (1 + inf)^k` and real-basis `gapEurPerMonth` parity. Add backward-compatible defaulted columns to `hypotheses` and update `apps/web` dashboard/settings projection UI with a "Comment c'est calculé" explainer and AMF non-advice disclaimer (mobile disclaimer parity lands in Epic 15). Reference: ADR-0023, FR-57..FR-59, DR-3.

**Covered FRs:** FR-57, FR-58, FR-59 (extends projection to real euros + 3 scenarios); gates NFR-1, DR-3, ADR-0023.

**Acceptance Criteria:**

- **Given** `annualRate = 0.03`, `annualFeeDrag = 0.005`, and `inflationRate = 0.03`, **When** `@pekulo/finance` computes the projection, **Then** negative real rates compute cleanly without error and `FV_real(k) === FV_nom(k) / (1 + inflationRate)^k` holds within floating-point tolerance.
- **Given** `currentWealthEur < 0` (underwater real estate), **When** the 3-scenario curves compute, **Then** `pessimistic[k] <= realistic[k] <= optimistic[k]` holds for every year `k`.
- **Given** a user toggles between `real` and `nominal` display modes, **When** the verdict renders, **Then** `reachesCap` stays anchored in real purchasing power and displays the AMF non-advice / user-hypotheses disclaimer.

**Complexity:** L

#### Story 14-2-landing-pricing-and-waitlist

**Ticket:** [#177](https://github.com/yabafre/pekulo/issues/177)
**Title:** Build public landing page, pricing tiers, security/neutrality page, and rate-limited waitlist capture

**Depends on:** 13-3-api-cors-and-rate-limiting

**As a** visitor arriving at `pekulo.app`, **I want** to understand Pekulo's promise, pricing, and security/neutrality commitments — and join the waitlist or start my account — **so that** I can evaluate Pekulo before hitting a login wall.

**Summary:** Replace `apps/web/src/app/page.tsx`'s redirect to `/login` with a public French landing + pricing page (promise, old vs new way, 3 differentiators, verdict preview, Free vs Plus €69/yr / €7.99/mo vs Founder €49/yr 100 spots guaranteed while active, FAQ, founder presentation, waitlist signup) and a dedicated `/securite` page (verified security controls, ACPR Bridge read-only posture, neutrality, 90-day reversibility commitment). Persist waitlist signups in a new Postgres `waitlist_entries` table (`email` unique, `consented_at`, `source`; `ENABLE ROW LEVEL SECURITY` with **0 policies**, registered in `NON_USER_MODELS`, `ID_PREFIXES`, and `rls-migration-audit.ts#NON_USER_TABLES`) via an unauthenticated `POST /v1/waitlist` endpoint guarded by story `13-3`'s Caddy-pinned IP rate-limiter. Harmonize tutoiement across Settings ("Vos données") and exempt exact public routes in `proxy.ts`. Reference: GTM `13-1`, `13-14`, DR-1..DR-3.

**Covered FRs:** (GTM acquisition surface; DR-1..DR-3 compliant copy — no yield promises).

**Acceptance Criteria:**

- **Given** an unauthenticated visitor hitting `/`, **When** the page loads, **Then** the landing + pricing page renders HTTP 200 with zero auth redirect and Lighthouse Performance ≥ 90 (NFR-3).
- **Given** a visitor opening `/securite`, **When** the page renders, **Then** security controls, read-only Bridge framing, neutrality, and reversibility guarantees match verified codebase posture with zero false E2EE claims.
- **Given** a visitor submitting a valid email with explicit consent on `/`, **When** `POST /v1/waitlist` runs, **Then** the row persists idempotently in `waitlist_entries` (protected by IP rate limiting and RLS 0-policy deny-all).

**Complexity:** M

#### Story 14-3-legal-cgv-and-funnel-analytics

**Ticket:** [#178](https://github.com/yabafre/pekulo/issues/178)
**Title:** Add French B2C legal pages (mentions légales, CGV, security.txt) and privacy-first funnel analytics

**Depends on:** 14-2-landing-pricing-and-waitlist

**As a** prospective French customer, **I want** clear legal notices, CGV with withdrawal/mediator rights, and transparent privacy-respecting analytics, **so that** I can subscribe in full confidence and regulatory compliance.

**Summary:** Add public `/mentions-legales` and `/cgv` pages (publisher/SIRET, hosts, _médiateur de la consommation_ Art. L.612-1, 14-day withdrawal right + immediate-access waiver terms, updated sub-processor list including Stripe), publish `/.well-known/security.txt` + vulnerability disclosure guidance + verify HSTS preload headers (CSP is already enforced per story 11-7), and wire EU privacy-first cookieless/consent-gated funnel analytics (landing → signup → cap set → checkout). Reference: GTM `13-4`, `13-5`, `13-12`.

**Covered FRs:** (legal compliance & funnel instrumentation; GDPR / CNIL / Loi consommation).

**Acceptance Criteria:**

- **Given** an unauthenticated visitor or bot hitting `/mentions-legales`, `/cgv`, or `/.well-known/security.txt`, **When** requested, **Then** each returns HTTP 200 with required French B2C disclosures.
- **Given** funnel analytics enabled on `apps/web`, **When** a visitor navigates landing → signup → cap set, **Then** anonymized conversion events are recorded without tracking cookies or PII (or strictly after consent).

**Complexity:** S

#### Story 14-4-stripe-billing-entitlements

**Ticket:** [#179](https://github.com/yabafre/pekulo/issues/179)
**Title:** Implement Stripe Checkout, multi-grant entitlements, Founder 100-spot lock, 3-click cancel & FR-50 cleanup

**Depends on:** 13-4-durable-webhook-inbox

**As a** Pekulo user, **I want** to subscribe to Founder (€49/yr) or Plus via Stripe Checkout, manage or cancel my subscription in 3 clicks from Settings, and have my subscription automatically canceled if I delete my account, **so that** billing is effortless and compliant.

**Summary:** Create `apps/api/src/modules/billing/` with Postgres `subscription_grants` (keyed by `(provider, external_subscription_id)`, RLS + `ON DELETE CASCADE`, `EXPORT_NODES`/`DELETION_NODES`), `founder_reservations` (atomic 100-spot cap via `pg_advisory_xact_lock` + TTL sweep), Stripe Checkout session creation (recording 14-day withdrawal waiver + 7–14 day `past_due` grace for 3DS retries), signed idempotent Stripe webhook ingestion via `webhook_inbox` (story 13-4), Stripe Billing Portal + dedicated ≤ 3-click Settings cancellation calling the Stripe API (with cancellation confirmation email sent natively by Stripe Billing customer notifications — zero `apps/api` SMTP port needed here, satisfying Loi 2022-1158), and Step 1 Stripe subscription cancellation inside `settings.deletion.ts` bounded within `settings.deletion-budget.test.ts` (< 60 s NFR-7). Extend the IDOR isolation harness (if `14-11` is already shipped) to cover `/rpc/v1/billing`. Keep Epic 12 advisory strictly excluded. Reference: ADR-0021, ADR-0022.

**Covered FRs:** FR-50 (extends account deletion to cancel Stripe); gates NFR-7, ADR-0021.

**Acceptance Criteria:**

- **Given** concurrent users clicking the 100th Founder spot, **When** Checkout sessions are created, **Then** `founder_reservations` guarantees at most 100 active/reserved spots and releases expired abandoned sessions automatically.
- **Given** a Stripe webhook (`checkout.session.completed`, `invoice.payment_failed`, `customer.subscription.deleted`), **When** delivered out-of-order or replayed, **Then** `webhook_inbox` deduplicates and updates `subscription_grants` monotonically while honoring the 7–14 day `past_due` grace window.
- **Given** an active subscriber in Settings, **When** they click "Résilier mon abonnement" and confirm (≤ 3 clicks), **Then** the Stripe subscription cancels at period end and Stripe triggers the customer cancellation confirmation email.
- **Given** a paying user deleting their account (FR-50), **When** `deleteAccount` runs, **Then** Stripe subscription cancellation executes in Step 1 inside the 60 s NFR-7 budget before local rows are erased.

**Complexity:** L

#### Story 14-5-paywall-and-downgrade-safety

**Ticket:** [#180](https://github.com/yabafre/pekulo/issues/180)
**Title:** Enforce server-side Free vs Plus entitlements, post-verdict web paywall, and non-destructive downgrade

**Depends on:** 14-4-stripe-billing-entitlements

**As a** free Pekulo user, **I want** to set my Cap, track 2 milestones, and import CSVs freely before seeing an upgrade prompt — and if I cancel Plus later, I want my existing data preserved while automated bank sync pauses cleanly, **so that** I never feel locked out of my own data.

**Summary:** Enforce server-authoritative `hasPlus` entitlement checks in `apps/api` (Free: 1 cap, 2 milestones, manual + CSV; Plus: Bridge sync, unlimited milestones, real estate, monthly sign-off/digest). On downgrade to Free: **pause** automated Bridge cron/webhook sync (`bank-aggregator.service.ts`) without revoking the user's bank consent, and enforce Free limits **only on creation** (existing milestones/properties stay readable, editable, deletable, and exportable). Render web paywall prompts strictly after the user sees their first verdict; keep `apps/mobile` strictly free of pricing/upgrade CTAs (ADR-0021 interim Apple 3.1.3(b) posture). Reference: ADR-0021, GTM `13-9`.

**Covered FRs:** (entitlement gating across existing FRs); gates ADR-0021.

**Acceptance Criteria:**

- **Given** a Free user attempting to create a 3rd milestone, add a real-estate property, or initiate a Bridge bank connection, **When** the oRPC call reaches `apps/api`, **Then** the server rejects with a typed `UPGRADE_REQUIRED` error.
- **Given** a former Plus user whose subscription expires, **When** the 6 h `refreshAll` cron or Bridge webhook fires, **Then** automated Bridge sync is skipped (paused, not revoked) and all existing milestones/properties remain readable, editable, and exportable.
- **Given** `apps/mobile` builds during Epic 14, **When** a Free user navigates the mobile app, **Then** zero pricing text or external checkout links appear.

**Complexity:** M

#### Story 14-6-onboarding-and-demo-mode

**Ticket:** [#181](https://github.com/yabafre/pekulo/issues/181)
**Title:** Guided 3-step onboarding to first verdict and unauthenticated demo mode with fictional wealth

**Depends on:** 14-1-shared-finance-real-projection, 14-2-landing-pricing-and-waitlist

**As a** new visitor or freshly registered user, **I want** to test Pekulo immediately on a realistic fictional portfolio or reach my own Cap verdict in under 3 minutes, **so that** I experience the core value before connecting a bank or paying.

**Summary:** Build a 3-step guided web onboarding flow (Cap target with adjustable 25× annual-expenses helper → 1 milestone → 1 manual account or CSV import → live real-euros verdict, accepting optional URL-prefilled hypothesis assumptions from `/calculateur`) and an unauthenticated `/demo` read/explore mode preloaded with a realistic fictional French FIRE portfolio (zero account creation or bank connection required). Reference: GTM `13-3`, `13-13`.

**Covered FRs:** FR-1, FR-3, FR-41, FR-58 (guided activation flow).

**Acceptance Criteria:**

- **Given** a newly signed-up user with no compass or accounts, **When** they enter `/dashboard`, **Then** the 3-step onboarding guides them to set a Cap, add 1 milestone, add 1 account/CSV, and displays their live verdict in < 3 minutes.
- **Given** an unauthenticated visitor clicking "Essayer la démo" on `/`, **When** `/demo` loads, **Then** the Cap dashboard, milestones, real-euros projection, and verdict render interactively on fictional data with zero API mutations.

**Complexity:** M

#### Story 14-7-public-cap-calculator

**Ticket:** [#182](https://github.com/yabafre/pekulo/issues/182)
**Title:** Build unauthenticated client-side public Cap calculator powered by `@pekulo/finance`

**Depends on:** 14-1-shared-finance-real-projection, 14-2-landing-pricing-and-waitlist, 14-6-onboarding-and-demo-mode

**As a** visitor searching for a French FIRE simulator, **I want** to calculate my target capital, real-euro trajectory, and monthly gap directly without creating an account, **so that** I can test my assumptions and carry them into Pekulo if I sign up.

**Summary:** Create public `/calculateur` route in `apps/web` importing `@pekulo/finance` **100 % client-side** (zero API calls, zero VPS CPU load, zero PII stored): interactive sliders for current wealth, monthly savings, target capital/25× helper, horizon, nominal return, fee drag, inflation, and real/nominal toggle; displays 3-scenario band, monthly gap verdict, "Comment c'est calculé" explainer, AMF non-advice disclaimer, and CTA carrying non-sensitive query parameters into `14-6`'s signup/onboarding flow. Reference: ADR-0023, GTM `13-6`.

**Covered FRs:** (public acquisition tool reusing ADR-0023 engine); gates DR-3, NFR-3.

**Acceptance Criteria:**

- **Given** an unauthenticated visitor adjusting sliders on `/calculateur`, **When** inputs change, **Then** the 3-scenario curve and monthly gap update client-side in < 16 ms with zero backend API requests and exact numeric parity with `apps/api`.
- **Given** a visitor clicking "Suivre mon cap automatiquement", **When** they complete signup and enter onboarding (`14-6`), **Then** their hypothesis parameters prefill Step 1 without storing PII prior to signup.

**Complexity:** M

#### Story 14-8-monthly-cap-digest-email

**Ticket:** [#183](https://github.com/yabafre/pekulo/issues/183)
**Title:** Automated 1st-of-month Cap digest email and transactional security alerts via custom SMTP

**Depends on:** 14-1-shared-finance-real-projection, 14-5-paywall-and-downgrade-safety

**As a** Plus subscriber, **I want** a monthly email on the 1st summarizing my real-euro Cap verdict and next milestone — plus immediate email alerts on sensitive security events — **so that** I stay engaged and informed without daily logins.

**Summary:** Wire a transactional email port in `apps/api` (Brevo/Resend SMTP/API, verified SPF/DKIM) powering: (1) a scheduled 1st-of-month Cap digest for opted-in Plus users (current verdict, real-euro monthly gap, next milestone delta, one-click unsubscribe, non-advice disclaimer — idempotent per `(userId, YYYY-MM)`), and (2) immediate security notification emails on new bank connection, 90-day Bridge SCA expiry, and password change (triggered via an explicit post-`updateUser` `apps/api` notification call from `apps/web`'s `updatePassword` action since Supabase Auth processes password updates directly). Reference: GTM `13-7`, `13-10` alerts, `docs/security.md` Custom SMTP.

**Covered FRs:** (retention & security notifications; GDPR consent/opt-out compliant).

**Acceptance Criteria:**

- **Given** an opted-in Plus subscriber on the 1st of the month, **When** the monthly digest job runs, **Then** exactly one email is sent per `(userId, YYYY-MM)` with their real-euro verdict and a working one-click unsubscribe link.
- **Given** a user completes a new Bridge bank connection, updates their password, or hits a `SCA_REQUIRED` webhook, **When** the event commits, **Then** a security alert email is dispatched without leaking account numbers or balances.

**Complexity:** M

#### Story 14-9-discreet-mode-and-share-card

**Ticket:** [#184](https://github.com/yabafre/pekulo/issues/184)
**Title:** Add discreet privacy mode and amount-free shareable Cap progress card

**Depends on:** none

**As a** Pekulo user, **I want** to hide my euro amounts with one click when browsing in public and generate a shareable progress card without disclosing amounts, **so that** I protect my financial privacy while sharing milestones.

**Summary:** Add a persisted client-side "mode discret" toggle (Zustand store + eye icon in the Cap header) masking displayed monetary amounts (`•••• €`) across Dashboard, Portefeuille, Immobilier, and Transactions while preserving percentages; build a privacy-safe shareable Cap progress card ("Je suis à X % de mon cap YYYY" — strictly zero monetary amounts or account labels). Reference: GTM `13-8` card, `13-11`.

**Covered FRs:** (privacy & shareable progress UX).

**Acceptance Criteria:**

- **Given** a user toggles discreet mode on, **When** they navigate across Dashboard, Portefeuille, Immobilier, and Transactions, **Then** all monetary amounts are masked (`•••• €`) while progress percentages remain visible.
- **Given** a user generates a shareable Cap card, **When** rendered or exported, **Then** it displays progress percentage and target year with zero euro amounts or account names.

**Complexity:** S

#### Story 14-10-referral-reward-loop

**Ticket:** [#185](https://github.com/yabafre/pekulo/issues/185)
**Title:** Implement per-user referral codes and 1-month Stripe subscription credit loop

**Depends on:** 14-4-stripe-billing-entitlements

**As a** Pekulo subscriber, **I want** to share a personal referral link that grants me 1 free month when a friend subscribes to Plus, **so that** recommending Pekulo is rewarded automatically.

**Summary:** Add a `referrals` Prisma model (`referrer_user_id`, `referee_user_id`, `code`, `status`, `stripe_credit_applied_at`; RLS + `ON DELETE CASCADE` + `ID_PREFIXES` + `EXPORT_NODES` + `DELETION_NODES`), signup attribution capturing `?ref=<code>`, anti-self-referral guards, and automatic 1-month Stripe invoice credit/coupon application triggered when a referred user completes their first paid Stripe checkout webhook inside `apps/api/src/modules/billing/`. Reference: GTM `13-8` referral.

**Covered FRs:** (growth & referral billing loop; GDPR export/deletion compliant).

**Acceptance Criteria:**

- **Given** user B signs up via user A's referral link and completes a paid Stripe checkout, **When** the billing webhook processes, **Then** user A receives a 1-month Stripe credit exactly once and the referral row marks as rewarded.
- **Given** user A attempts to redeem their own referral code, **When** attributed, **Then** self-referral is rejected with zero credit applied.

**Complexity:** M

#### Story 14-11-idor-isolation-test-suite

**Ticket:** [#186](https://github.com/yabafre/pekulo/issues/186)
**Title:** Automated cross-tenant IDOR isolation test suite covering all shipped authenticated API routes

**Depends on:** none

**As a** Pekulo security owner, **I want** CI to verify automatically that user B can never read, modify, or delete any resource belonging to user A across every API route, **so that** ADR-0013's single-layer `where: { userId }` isolation is continuously proven.

**Summary:** Build a comprehensive integration test suite in `apps/api` seeding two distinct users (`userA`, `userB`) across all shipped Epics 1–12 domain modules (compass, milestones, accounts, holdings, lots, realestate, transactions, monthly, dashboard, hypothesis, bank-aggregator, llm, settings, advisory) and asserting that every read/update/delete/export call made by `userB` against `userA`'s IDs fails with 403/404 and zero cross-tenant data leak. Gate merges on this suite in `.github/workflows/pr.yml` and enforce a module-registration meta-test so every future module (`billing`, `referrals`, `security-events`) must join the IDOR harness when added. Reference: ADR-0013, spike `13-16`.

**Covered FRs:** (continuous enforcement of NFR-8 / ADR-0013 across all modules).

**Acceptance Criteria:**

- **Given** seeded resources owned by `userA` across every shipped module, **When** `userB` invokes every oRPC procedure and Elysia authenticated route with `userA`'s resource IDs, **Then** 100 % of cross-tenant attempts return 403/404 with zero leakage of `userA`'s data.
- **Given** a deliberately broken repository omitting `where: { userId }` or a new oRPC module omitted from the IDOR registry, **When** CI runs, **Then** the build fails naming the violating route or module.

**Complexity:** M

#### Story 14-12-ci-security-pipeline

**Ticket:** [#187](https://github.com/yabafre/pekulo/issues/187)
**Title:** Add automated dependency CVE scanning, SAST, and dependency update automation in CI

**Depends on:** none

**As a** solo founder operating a financial app, **I want** automated vulnerability scanning and dependency update PRs on every commit, **so that** known CVEs and insecure code patterns are caught before reaching production.

**Summary:** Extend `.github/workflows/pr.yml` (and scheduled weekly run) with dependency CVE scanning (`osv-scanner` / `bun audit`), static security analysis (`CodeQL` or `Semgrep` tailored for TypeScript/Bun/Next.js), and repository-level `Dependabot` or `Renovate` config for security updates. Reference: Spike `13-17`, `docs/rgpd-readiness.md:56`.

**Covered FRs:** (CI security hygiene; GDPR Art. 32).

**Acceptance Criteria:**

- **Given** a PR opened against `main`, **When** CI runs, **Then** dependency vulnerability scanning and SAST execute automatically and fail on high/critical findings.
- **Given** `.github/dependabot.yml` (or Renovate config) committed, **When** validated, **Then** root, `apps/api`, `apps/web`, `apps/mobile`, `apps/prices`, and GitHub Actions ecosystems are tracked.

**Complexity:** S

#### Story 14-13-totp-mfa-enrollment

**Ticket:** [#188](https://github.com/yabafre/pekulo/issues/188)
**Title:** Add Supabase TOTP 2FA enrollment, login challenge, and post-bank-link prompt on web

**Depends on:** none

**As a** Pekulo user connecting my bank accounts, **I want** to protect my account with an authenticator-app 2FA code (TOTP), **so that** a leaked password alone cannot expose my financial data.

**Summary:** Implement Supabase Auth TOTP MFA flows (`mfa.enroll`, `mfa.challenge`, `mfa.verify`, `mfa.unenroll`) in `apps/web`: QR code + manual secret setup in Settings → Sécurité, MFA verification step in `/login` when an enrolled factor requires AAL2, and a non-blocking prompt encouraging 2FA right after a user's first Bridge bank connection. Reference: `docs/architecture.md:137`, `docs/rgpd-readiness.md:54`, GTM `13-10`.

**Covered FRs:** FR-46 (extends login security with AAL2); gates NFR-11, GDPR Art. 32.

**Acceptance Criteria:**

- **Given** an authenticated user in Settings → Sécurité, **When** they enroll a TOTP authenticator app and enter a valid 6-digit code, **Then** MFA is active on their Supabase Auth account.
- **Given** a user with TOTP MFA enabled, **When** they sign in with email + password, **Then** they must pass the TOTP challenge before accessing `/dashboard`.
- **Given** a user with MFA disabled finishing their first bank link, **When** they return to the dashboard, **Then** a dismissible prompt suggests enabling 2FA.

**Complexity:** M

#### Story 14-14-jwt-revocation-and-401-fix

**Ticket:** [#189](https://github.com/yabafre/pekulo/issues/189)
**Title:** Fix mobile/web 401 refresh-retry and enforce API JWT revocation (`tokens_revoked_before`)

**Depends on:** 13-3-api-cors-and-rate-limiting

**As a** Pekulo user, **I want** signing out or revoking all sessions to invalidate active API tokens immediately without causing spurious mobile logouts when short-lived tokens refresh, **so that** my sessions are both secure and reliable.

**Summary:** Implement ADR-0022 JWT revocation in safe rollout order: (1) fix `apps/mobile/lib/auth/auth-context.tsx` to proactively refresh access tokens when `exp - now < 60 s` and attempt one silent Supabase refresh + retry on 401 before calling `signOut()`, and verify web Server Action near-expiry refresh, unlocking Supabase Dashboard JWT TTL reduction from 60 min to 10–15 min (documented in `docs/security.md`); (2) extract and require integer `iat` in `jwt-verifier.ts`; (3) add `tokens_revoked_before` (`user_id` PK → `auth.users(id) ON DELETE CASCADE`, `revoked_before_sec BIGINT`, RLS, `DELETION_NODES`, excluded from `EXPORT_NODES`, strict `<` whole-second comparison preventing clock-skew self-lockout, 15–30 s bounded write-through memory cache, **direct-DB bypass** on `/v1/export`, `deleteAccount`, `bankAggregator.*`, `advisory.*`), stamped on `signOut`, password reset, FR-50, and a new "Déconnecter tous les appareils" Settings action. Reference: ADR-0022, FR-47, NFR-9.

**Covered FRs:** FR-47 (closes stateless API revocation gap); gates NFR-9, ADR-0022.

**Acceptance Criteria:**

- **Given** a mobile access token expiring mid-request over 4G, **When** `apps/api` returns 401, **Then** `apps/mobile` performs one silent Supabase refresh and retries the oRPC call before ever signing the user out.
- **Given** a user clicks "Déconnecter tous les appareils" or signs out, **When** a previously captured access JWT (`iat < revoked_before_sec`) hits `/rpc/v1/*`, `/v1/export`, or `deleteAccount`, **Then** `apps/api` rejects it with 401 in < 100 ms, while a fresh login in the same second is never locked out.

**Complexity:** M

#### Story 14-15-security-events-audit-log

**Ticket:** [#190](https://github.com/yabafre/pekulo/issues/190)
**Title:** Add append-only `security_events` audit log and Settings → Sécurité history view

**Depends on:** 14-13-totp-mfa-enrollment, 14-14-jwt-revocation-and-401-fix

**As a** Pekulo user, **I want** to inspect an immutable history of sensitive actions on my account (sign-ins, bank connections, exports, MFA/password changes, session revocations), **so that** I can spot suspicious activity immediately.

**Summary:** Add an append-only `security_events` table following ADR-0001 (RLS `INSERT` + `SELECT` only, `ON DELETE CASCADE`, `EXPORT_NODES`, `DELETION_NODES`, `ID_PREFIXES`), emit structured non-PII event records from `apps/api` on bank connect/revoke, GDPR export, global session revocation, and explicit post-action hooks from `apps/web` for sign-in, password update, and TOTP MFA enroll/unenroll, and surface the paginated timeline in Settings → Sécurité. Reference: ADR-0001, spike `13-18`.

**Covered FRs:** (user-facing security audit log; ADR-0001 append-only pattern).

**Acceptance Criteria:**

- **Given** a user connects/revokes a bank, exports data, enrolls/unenrolls 2FA, updates their password, or revokes all sessions, **When** each action completes, **Then** an append-only row is recorded in `security_events` with zero raw secrets or PII.
- **Given** a user opens Settings → Sécurité, **When** the timeline loads, **Then** recent security events display cleanly in reverse chronological order and RLS rejects `UPDATE`/`DELETE` attempts.

**Complexity:** M

#### Story 14-16-per-user-envelope-crypto

**Ticket:** [#191](https://github.com/yabafre/pekulo/issues/191)
**Title:** Implement explicit `UserCryptoService` per-user envelope encryption (`KEK → DEK`) and cryptographic erasure

**Depends on:** 13-1-advisory-crypto-and-consent, 13-2-iban-blind-index-and-logs

**As a** Pekulo user trusting the app with my transaction labels and property details, **I want** my sensitive text fields encrypted with a per-user key separate from Postgres, **so that** a database dump is unreadable and deleting my account cryptographically shreds my data.

**Summary:** Implement ADR-0019 Step 2 (all 9 controls; spike `13-15`): create `user_keys` table (`user_id` PK → `auth.users(id) ON DELETE CASCADE`, `wrapped_dek`, `kek_version`, `ENABLE ROW LEVEL SECURITY` with **0 policies**, delete-only in `DELETION_NODES`, excluded from `EXPORT_NODES`, `ID_PREFIXES: null`, guard-test exemptions documented). Build an explicit repository-boundary **`UserCryptoService`** behind `KeyProvider` using native `node:crypto` AES-256-GCM + HKDF-SHA-256 + AAD `table|column|rowId|userId|formatVersion` + boot canary + bounded LRU DEK cache (evicted unconditionally on `deleteAccount`, provisioned outside `$transaction` — **never** blanket Prisma `$extends`). Encrypt sensitive free-text fields (`transactions.label`, `transactions.notes`, `accounts.notes`, `holdings.notes`, `real_estate.label`, `bank_connections.display_name`, `milestones.label`, and `advisory_sessions.encrypted_payload`) with versioned prefix `pk1.<iv>.<tag>.<ct>`, add `label_bidx` / bounded in-memory filtering for `listDistinctProviderLabels` and `llm_call_log.label_hash` (keeping `Account.label` unencrypted so CSV import's `findAccountIdByLabelForUser` continues working), pre-validate DEK before streaming `GET /v1/export`, append hashed `userId` to the external erasure ledger on deletion (replayed on restore), and ship forward backfill + KEK re-wrap (`PEKULO_KEK_V1` → `V2`) scripts plus updated NFR-21 escrowed-KEK restore drill. Reference: ADR-0019 Step 2, NFR-14, NFR-21, FR-49, FR-50.

**Covered FRs:** FR-49, FR-50 (hardens export/deletion with per-user envelope crypto); gates NFR-6, NFR-7, NFR-14, NFR-21, ADR-0019.

**Acceptance Criteria:**

- **Given** a transaction or note written through its repository, **When** inspected directly in Postgres, **Then** the stored column contains `pk1.<iv>.<tag>.<ct>` AES-256-GCM ciphertext authenticated with `table|column|rowId|userId|formatVersion` AAD, while amounts, dates, categories, and `Account.label` remain queryable.
- **Given** ciphertext copied from user A's row into user B's row or another column, **When** `UserCryptoService` attempts decryption, **Then** GCM authentication fails cleanly.
- **Given** a user triggers `GET /v1/export` (FR-49) or `deleteAccount` (FR-50), **When** completed, **Then** exports return decrypted plaintext within 60 s (NFR-6), `deleteAccount` records the external erasure ledger entry + erases `user_keys` + evicts the DEK cache within 60 s (NFR-7), and `rls-migration-audit` + export/deletion guard tests stay green.
- **Given** a KEK rotation from `PEKULO_KEK_V1` to `V2`, **When** the re-wrap script runs, **Then** all `user_keys` rows re-wrap under `V2` without re-encrypting field ciphertexts and boot canary verifies all referenced versions.

**Complexity:** L

## Epic 15: Mobile store launch & native IAP readiness

**Goal:** Prepare `apps/mobile` (iOS & Android) for public App Store and Google Play distribution with native signup/demo onboarding, smooth virtualized transaction scrolling, mobile crash reporting into GlitchTip, compliant RevenueCat IAP synced with `subscription_grants`, automated EAS/OTA releases, and branded ASO store assets.

**Requirement source:** `docs/triage-decision.md` (Lot C C1–C6), ADR-0021 (mobile RevenueCat IAP), ADR-0023 (mobile real-euros disclaimer parity), NFR-16, NFR-27, Apple App Review & Google Play policies. _(Numbering note: `docs/triage-decision.md` referred to this store-launch work as "Epic 14" prior to splitting Lot A hardening out into Epic 13.)_

**Sequencing / Tiering:** Post-50-web-clients store launch (frozen during Epic 13/14 web pre-sale per `docs/gtm/2026-11-26-plan-50-clients-janvier-2027.md`).

#### Story 15-1-mobile-signup-and-demo

**Ticket:** [#192](https://github.com/yabafre/pekulo/issues/192)
**Title:** Add native account signup, password reset, and interactive demo mode on mobile

**Depends on:** none

**As a** mobile user installing Pekulo from the App Store or Google Play, **I want** to create an account, reset my password, or explore a fictional demo directly inside the app, **so that** I am not blocked by a login-only wall.

**Summary:** Extend `apps/mobile/app/login.tsx` (and add native signup / password-reset screens) with Supabase email+password signup enforcing the 12-char policy (NFR-11, FR-45), password reset (FR-48), and an explicit "Essayer en mode démo" option available even when `requireAuth === true` (replacing the hidden preview-only flag). Include ADR-0023's real-euros projection disclaimer parity on the mobile Cap screen. Reference: FR-45, FR-48, NFR-11, ADR-0023, triage C2.

**Covered FRs:** FR-45, FR-48 (mobile parity); gates NFR-11.

**Acceptance Criteria:**

- **Given** a new mobile user on the Auth screen, **When** they tap "Créer un compte" and enter an email + ≥ 12-char password, **Then** Supabase Auth creates the account and displays confirmation guidance.
- **Given** a production mobile build (`requireAuth === true`), **When** the user taps "Essayer en mode démo", **Then** they can browse all 5 tabs on realistic fictional data with a clear demo banner and signup CTA.

**Complexity:** M

#### Story 15-2-mobile-transactions-list-perf

**Ticket:** [#193](https://github.com/yabafre/pekulo/issues/193)
**Title:** Virtualize mobile transactions list for smooth scrolling at high monthly volumes

**Depends on:** none

**As a** mobile user with hundreds of monthly transactions, **I want** smooth 60 fps scrolling and instant search on the Transactions tab without UI stutter, **so that** reviewing my monthly spending stays responsive.

**Summary:** Refactor `apps/mobile/app/(tabs)/transactions/index.tsx` to render transaction rows inside a virtualized `FlatList` / `FlashList` (replacing `.map()` inside `<ScrollView>`), preserving iOS `NativeTabs` automatic insets, pull-to-refresh, month navigation, search, and pending AI suggestions header. Reference: NFR-16, triage C5.

**Covered FRs:** FR-28, FR-64 (mobile list virtualization); gates NFR-16.

**Acceptance Criteria:**

- **Given** a month with 500–1,000 transactions loaded on iOS or Android, **When** the user scrolls and filters by search query, **Then** only visible rows + window buffer mount (virtualized) with pull-to-refresh and iOS Large Title/NativeTabs insets preserved.

**Complexity:** S

#### Story 15-3-mobile-sentry-glitchtip

**Ticket:** [#194](https://github.com/yabafre/pekulo/issues/194)
**Title:** Wire `@sentry/react-native` mobile crash reporting to GlitchTip with PII scrubbing

**Depends on:** none

**As a** Pekulo operator publishing to iOS and Android stores, **I want** unhandled JS and native mobile crashes captured automatically in GlitchTip with PII scrubbed, **so that** production regressions are diagnosed immediately.

**Summary:** Add `@sentry/react-native` to `apps/mobile` targeting the existing self-hosted GlitchTip DSN, apply the same PII scrubbing rules as `@pekulo/observability` (`beforeSend` stripping emails, IBANs, tokens, hashing `user.id`), configure source-map / dSYM upload for EAS release builds, and guarantee fail-open initialization when DSN is unset. Reference: ADR-0005, NFR-27, triage C3.

**Covered FRs:** (mobile observability parity); gates NFR-27, ADR-0005.

**Acceptance Criteria:**

- **Given** an unhandled JS exception in `apps/mobile` with `EXPO_PUBLIC_GLITCHTIP_DSN` configured, **When** it fires, **Then** one scrubbed event reaches GlitchTip with zero raw emails, IBANs, or JWTs.
- **Given** GlitchTip is unreachable or DSN is unset, **When** the app launches, **Then** startup succeeds fail-open with zero user-facing errors.

**Complexity:** S

#### Story 15-4-mobile-revenuecat-iap

**Ticket:** [#195](https://github.com/yabafre/pekulo/issues/195)
**Title:** Integrate RevenueCat mobile-only IAP synced into `subscription_grants` with anti-double-billing

**Depends on:** 14-4-stripe-billing-entitlements, 14-5-paywall-and-downgrade-safety, 15-1-mobile-signup-and-demo

**As an** iOS or Android user, **I want** to subscribe to Pekulo Plus via native Apple/Google in-app purchase without ever being double-billed if I already subscribed on the web, **so that** upgrading on mobile is seamless and safe.

**Summary:** Integrate RevenueCat SDK in `apps/mobile` for Apple/Google IAP only (Web Stripe stays completely outside RevenueCat's MTR meter per ADR-0021); ingest RevenueCat webhooks via `webhook_inbox` into `subscription_grants`; suppress mobile IAP purchase flows when `apps/api` reports an active Stripe grant (directing management to web); add Apple Guideline 5.1.1(v) store-cancellation guidance to `apps/mobile/app/sheets/delete-account.tsx`; update `apps/mobile/app.json` Privacy Manifest (`NSPrivacyCollectedDataTypePurchaseHistory`, keeping `NSPrivacyTracking: false`). Reference: ADR-0021, triage C1.

**Covered FRs:** FR-50 (mobile IAP deletion guidance); gates ADR-0021, Apple 3.1.1 / 5.1.1(v).

**Acceptance Criteria:**

- **Given** a Free mobile user purchasing Plus via Apple/Google IAP, **When** RevenueCat delivers the webhook, **Then** `subscription_grants` activates the `apple`/`google` grant idempotently and Plus features unlock immediately across mobile and web.
- **Given** an active Web Stripe subscriber opening mobile Settings, **When** they inspect their plan, **Then** Plus shows as active via Web and the native IAP buy button is hidden/blocked to prevent double-billing.
- **Given** an iOS IAP subscriber initiating in-app account deletion, **When** the confirmation sheet opens, **Then** it explicitly reminds them to cancel their Apple subscription in iOS Settings (Apple 5.1.1(v)).

**Complexity:** L

#### Story 15-5-eas-release-and-ota-pipeline

**Ticket:** [#196](https://github.com/yabafre/pekulo/issues/196)
**Title:** Configure EAS production build/submit pipeline and `expo-updates` OTA channels

**Depends on:** 15-3-mobile-sentry-glitchtip

**As a** solo developer maintaining iOS and Android store builds, **I want** a repeatable CI pipeline for EAS release builds, store submission, and emergency OTA JS patches, **so that** releases are low-friction and reversible.

**Summary:** Install and configure `expo-updates` (`runtimeVersion: { policy: "appVersion" }`, `preview` and `production` channels) in `apps/mobile/app.json` and `eas.json`, complete `submit.production` metadata, and add a manually-triggered / tag-gated `.github/workflows/release-mobile.yml` running Jest + typecheck + store-compliance tests before invoking `eas build`, `eas submit`, or `eas update`. Reference: Triage C4.

**Covered FRs:** (mobile release engineering); gates NFR-27, store release readiness.

**Acceptance Criteria:**

- **Given** `apps/mobile/app.json` and `eas.json`, **When** validated against Expo/EAS config, **Then** `runtimeVersion` and distinct `preview`/`production` OTA channels are configured with `submit.production` populated.
- **Given** a tagged mobile release or manual workflow dispatch, **When** `.github/workflows/release-mobile.yml` runs, **Then** it gates EAS build/OTA behind green Jest, typecheck, and `store-compliance.test.ts`.

**Complexity:** M

#### Story 15-6-aso-listing-and-brand-icon

**Ticket:** [#197](https://github.com/yabafre/pekulo/issues/197)
**Title:** Ship branded Pekulo compass app icon, FR/EN ASO store listings, screenshots, and readiness sign-off

**Depends on:** 15-1-mobile-signup-and-demo, 15-4-mobile-revenuecat-iap

**As a** user browsing the App Store or Google Play, **I want** a recognizable branded Pekulo icon, clear French/English store listings, and accurate screenshots and privacy labels, **so that** I trust the app and understand its value before downloading.

**Summary:** Replace generic black "P" `apps/mobile/assets/{icon,adaptive-icon,splash-icon*}.png` with the branded Pekulo compass icon (1024×1024 RGB no-alpha); author FR & EN ASO store metadata (title, subtitle, keywords, description, release notes) under `apps/mobile/docs/store-listing/`; capture release-build screenshots (iPhone 6.9", iPad 13", Android phone/tablet); reconcile App Store Connect privacy labels, Google Play Data Safety, Apple Small Business Program (15 %), and EU DSA trader status (`2027-02-01` deadline); update `REVIEW-NOTES.md` and flip `.app-review-readiness.json` checks to `pass`. Reference: Triage C6, ADR-0021.

**Covered FRs:** (store launch & compliance readiness); gates Apple/Google store review.

**Acceptance Criteria:**

- **Given** `apps/mobile/assets/icon.png`, **When** `store-compliance.test.ts` and visual inspection run, **Then** the icon is 1024×1024 RGB without alpha channel and displays the branded Pekulo compass mark.
- **Given** `apps/mobile/.app-review-readiness.json`, **When** pre-submission checks are audited, **Then** `demo_account`, `live_backend`, `review_notes`, `screenshots_match_build`, `account_deletion_device_test`, `privacy_labels_match_runtime`, and `iap_reachable_by_reviewer` are all `pass`.

**Complexity:** M
