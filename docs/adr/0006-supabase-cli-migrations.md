# Schema migrations via Supabase CLI

**Date:** 2026-05-03
**Status:** superseded by ADR-0014
**Decided by:** Alex

## Context

The brownfield schema lives in a single idempotent SQL file at `apps/web/supabase-schema.sql`. V1 introduces three new tables (`milestones`, `real_estate`, `real_estate_rental`) plus two audit sister tables (`compass_history`, `real_estate_valuations`, see ADR-0001) plus the LLM audit table (`llm_call_log`). The audit guarantees of FR-2, FR-27, and DR-5 require traceable, ordered, reversible schema changes.

## Decision

Adopt **Supabase CLI migrations** (`supabase db push` workflow). Versioned migration files live at `apps/web/supabase/migrations/NNNN_description.sql`. The current single schema file is collapsed into `0001_baseline.sql` on the first migration PR. Every subsequent PR that touches the schema adds a new numbered file ; manual edits to `0001_baseline.sql` are forbidden after the collapse.

## Why

- **FR-2 / FR-27 / DR-5** — auditability of schema changes is now first-class (commit + migration ID).
- **NFR-8 (RLS coverage)** — the RLS-audit CI probe runs after every migration apply ; build fails if a new table lands without policies.
- **Brownfield integration** — Supabase CLI is already a devDep (`supabase ^2.95.4`) ; adopting migrations does not add a new dependency.

## Considered options

- **Stay on the single SQL file** — rejected: no audit of schema deltas, manual rebuild on every dev environment, no reverse migration path.
- **Generic ORM migrations (Prisma, Drizzle)** — rejected: would force an ORM adoption that violates NFR-28 (Supabase JS SDK v2 only).

## Consequences

- Onboarding new contributors requires a `supabase start` step before first PR ; documented in `apps/web/README.md`.
- The first migration PR (the baseline collapse) is mechanical ; subsequent PRs MUST include a forward-only migration even for trivial changes (e.g. adding a column).
