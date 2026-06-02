-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
-- against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-10 (FR-65): the Bridge institution provider_id on accounts, so the
-- bank-logo tier resolves for IBAN accounts (whose dedup key carries no
-- provider_id). No RLS change — adds a column, not a table; db:rls-audit counts
-- unchanged.

ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "provider_id" TEXT;
