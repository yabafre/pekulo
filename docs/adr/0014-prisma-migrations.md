# Schema migrations via Prisma migrate (supersedes ADR-0006)

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex
**Supersedes:** ADR-0006 (Schema migrations via Supabase CLI)

## Context

ADR-0006 prescribed Supabase CLI migrations as the schema-change toolchain. With Prisma adopted in `apps/api` (ADR-0012), Prisma owns the data layer ; Prisma Migrate is the natural toolchain. Supabase CLI remains useful for local Supabase environment bootstrapping and the `rls-audit` SQL probe, but no longer pilots applicative schema changes.

## Decision

- **Prisma Migrate** owns every schema change in `apps/api`. Workflow:
  - Local dev: `prisma migrate dev --name <verb_noun>` writes a new directory under `apps/api/prisma/migrations/<timestamp>_<verb_noun>/` and applies it.
  - Production: `prisma migrate deploy` runs in the Dokploy deploy step ; never `migrate dev` outside development.
- **Baseline migration** — the brownfield `apps/web/supabase-schema.sql` is collapsed into the first migration via `prisma db pull` followed by `prisma migrate diff --from-empty --to-schema-datamodel ...`. Manual edits to the baseline migration after the collapse are forbidden.
- **Forward-only** — no `down` migrations ; reversal is via a new forward migration (Prisma's official guidance).
- **RLS policies** — Prisma Migrate handles tables, columns, FKs, enums ; **RLS policy DDL is appended to migration files manually** since Prisma does not introspect Postgres policies. A `rls-audit` CI job re-asserts after every migration deploy that every user-scoped table has 4 policies (NFR-8).
- **Audit-trail policies** — `compass_history`, `real_estate_valuations`, `llm_call_log` migrations include `INSERT` + `SELECT` policies ; intentionally omit `UPDATE` and `DELETE` (append-only enforcement).

## Why

- **Single source of truth** — schema lives in `apps/api/prisma/schema/*.prisma` ; migrations derive from it.
- **Type-safe codegen tied to migrations** — `prisma generate` runs after every `migrate dev` ; client types stay in lock-step with the deployed schema.
- **Operational toolchain alignment** — Prisma Migrate is the deploy mechanism Dokploy can hook into ; Supabase CLI as a deploy tool would split responsibility across two unrelated systems.

## Considered options

- **Stay on Supabase CLI migrations** (ADR-0006) — rejected: requires a parallel SQL writing discipline duplicating Prisma's schema DSL.
- **Atlas / Sqitch / squitch / standalone migration tool** — rejected: gains nothing over Prisma Migrate ; adds operational surface.

## Consequences

- **Two devDep** in `apps/api`: `prisma` (CLI) and `@prisma/client` (runtime).
- **`supabase` (CLI)** stays as a `devDep` for local environment bootstrapping (`supabase start` for the local DB clone) and the `rls-audit` SQL probe ; no longer the migration tool.
- **Onboarding step** in `apps/api/README.md`: `bun install && bun --cwd apps/api prisma migrate dev` for fresh checkouts.
- **CI step**: `bun --cwd apps/api prisma migrate deploy` runs in the Dokploy deploy hook ; gated by all PR checks green (lint, typecheck, test, rls-audit).
- **Manual RLS DDL discipline** — every migration that introduces a user-scoped table includes the four policies ; `rls-audit` job catches omissions.
