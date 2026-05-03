# Prisma 7.8.0 + schema folder + prefixed IDs

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

The Phase 2 Data Layer originally locked "Supabase JS SDK v2 + Zod, no ORM". Alex's pivot after Phase 3 review adopts the patterns proven on his Bonjour and Trafi projects: Prisma 7.8.0 with the multi-file schema folder feature (Prisma 6+), the `@prisma/adapter-pg` adapter for direct PostgreSQL connection, and the prefixed-IDs Prisma extension pattern published in `yabafre/Trafi-app/apps/api/src/database`.

## Decision

- **Prisma 7.8.0** is the data access layer in `apps/api`. The web tier (`apps/web`) keeps Supabase JS SDK for Auth flows only ; it opens zero direct DB connections.
- **Schema folder** at `apps/api/prisma/schema/`, one file per domain module:
  - `_base.prisma` — `datasource db` + `generator client` + `previewFeatures = ["prismaSchemaFolder"]`
  - `enums.prisma` — every enum (`AccountType`, `HoldingKind`, `TransactionType`, `LotType`, `LlmRoute`, `MilestoneStatus`, …)
  - `compass.prisma`, `holdings.prisma`, `transactions.prisma`, `realestate.prisma`, `llm.prisma`, `monthly.prisma`, `accounts.prisma`, `hypothesis.prisma`, `dashboard.prisma` — one file per Elysia domain module
- **PrismaPg adapter**: `new PrismaPg({ connectionString: process.env.DATABASE_URL })` ; direct connection on port 5432 (Dokploy long-running service, no need for PgBouncer transaction-mode pooling). Pooler (port 6543) reconsidered if edge deployment lands.
- **Prefixed IDs extension** (Trafi pattern, ported as-is):
  - `apps/api/src/database/id-prefixes.config.ts` — `Record<ModelName, prefix>` central config
  - `apps/api/src/database/prefixed-ids.extension.ts` — `Prisma.defineExtension` intercepting `create`, `createMany`, `createManyAndReturn`, `upsert` to inject `{prefix}_{base62_21chars}` (~125 bits entropy) when `id` is undefined
  - Mounted on `apps/api/src/database/prisma.service.ts`'s extended client
- **Pekulo prefix mapping**:
  - `acc` Account · `hld` Holding · `lot` HoldingLot · `tx` Transaction · `kpi` Kpi · `mtr` MonthlyTracking
  - `hyp` Hypothesis · `cph` CompassHistory · `mst` Milestone
  - `res` RealEstate · `resr` RealEstateRental · `resv` RealEstateValuation
  - `llm` LlmCallLog · `llmo` LlmOptIn
  - `User` carries no prefix (managed by Supabase Auth, native UUID)
- **Existing brownfield tables** (`kpis`, `monthly_tracking`, `holding_lots`, …) keep their snake_case names via `@@map("kpis")` in the Prisma schema ; new tables follow the plural-snake convention (`milestones`, `compass_history`, `real_estate`, `real_estate_valuations`, `llm_call_log`).

## Why

- **Pattern parity with Trafi** — Alex carries forward a working, tested pattern instead of re-inventing.
- **Schema folder** scales beyond the single 270-LOC SQL file ; each domain owns its slice, mirroring the Elysia module boundaries.
- **Prefixed IDs** improve debuggability (you read `tx_aB3...` and immediately know it's a Transaction), and make logs / traces / audit rows self-documenting at a glance.
- **Direct connection at 5432** — `apps/api` is a long-running Bun process on Dokploy ; pooled connections would add latency without a serverless cold-start to amortise.
- **`@@map` on existing tables** — zero data migration cost on the brownfield schema ; new tables get the cleaner names from day 1.

## Considered options

- **Stay Supabase JS SDK v2** — rejected: typed query layer + central extension hooks (prefixed IDs, soft-delete, audit) are first-class in Prisma and ad-hoc in Supabase JS.
- **Drizzle ORM** — rejected: smaller community than Prisma ; Trafi's tooling investment doesn't transfer.
- **Kysely (initially proposed)** — rejected by user in favour of Prisma 7.8.0 to align with the Trafi pattern (extension hooks + DB schema folder + tooling familiarity).
- **Single `schema.prisma` file** — rejected: doesn't scale past ~5–7 models ; loses module-boundary clarity that the Elysia layer enforces.
- **PgBouncer transaction mode (port 6543)** — deferred ; `apps/api` long-running ; revisit if edge deploy ever lands.

## Consequences

- **`apps/api/prisma/migrations/`** — Prisma owns the migration toolchain (see ADR-0014 supersedes ADR-0006).
- **`@generated/prisma/client`** — Prisma client output emitted to a workspace-resolvable path (typical Trafi pattern: `apps/api/generated/prisma/`) ; consumed via `import { PrismaClient } from '@generated/prisma/client'`.
- **Prefixed IDs propagate to every wire surface** — oRPC responses, audit log rows, log lines, error messages all carry `{prefix}_{base62}` IDs. No schema-versioning concern for the prefix scheme until V2+.
- **Connection-string secret management** — `DATABASE_URL` (direct 5432) lives in Dokploy env on the VPS only ; never in `apps/web` env. Pre-commit `gitleaks` enforces.
- **NFR-28 amended** — see ADR-0009. Web tier still opens zero direct DB connections ; `apps/api` is the only Postgres consumer aside from Supabase Auth's internal access.
