-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate dev`
-- against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-2: pending LLM suggestion columns on transactions (FR-32). `category`
-- stays 'autre' until the user confirms in 6-4 (FR-33).
-- No RLS change — the transactions table already carries its policy quartet
-- (story 5-1). Adding columns adds no table, so db:rls-audit counts are
-- unchanged (AC-7).

ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_category" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_confidence" DOUBLE PRECISION;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_route" TEXT;
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "suggested_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "transactions_user_suggestion_idx"
  ON "transactions"("user_id", "suggested_category");
