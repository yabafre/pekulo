-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
-- against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 7-3 (FR-57): the monthly contribution input of the projection
-- hypothesis. Nullable + default 0 so existing rows and getProjection get a
-- sane value. No RLS change — adds a column, not a table; db:rls-audit count
-- unchanged. Hypothesis is registered `null` in id-prefixes.config.ts (a
-- column add needs no registration change).

ALTER TABLE "hypotheses" ADD COLUMN IF NOT EXISTS "monthly_contribution" DECIMAL DEFAULT 0;
