-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
-- against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
--
-- Backfill suggestions (épic 6) — `suggested_attempted_at` marks that the LLM
-- categoriser has RUN on this row, regardless of outcome. It is the idempotency
-- guard for the post-sync + hourly sweep: a row is eligible for (re)categorise
-- only when it is still `category='autre'`, has NO suggestion
-- (suggested_category IS NULL), AND was never attempted (suggested_attempted_at
-- IS NULL). A clean abstention stamps attempted (don't retry); a transport
-- failure leaves it NULL (retry next sweep — the safety net).
--
-- No RLS change — adding columns/indexes adds no table, so db:rls-audit policy
-- counts are unchanged.

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_attempted_at" TIMESTAMPTZ;

-- Backlog probe index: list still-'autre', never-attempted rows per user.
CREATE INDEX IF NOT EXISTS "transactions_user_suggestion_backlog_idx"
  ON "transactions"("user_id", "suggested_attempted_at");
