-- 5-1-transactions-record — id-type switch (UUID → prefixed) + account FK.
-- Per Alex D3 (2026-05-24): wipe & replay since the brownfield transactions
-- are in (a) personal-use phase and re-entry is trivial.
--
-- Hand-written (Supabase pooler hang on `prisma migrate dev` — codified by
-- ADR-0014). Apply via `bun --filter='@pekulo/api' run prisma:migrate:deploy`.
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.
--
-- Touched table: public.transactions (id column type flip + account_id FK + index).
-- RLS policies preserved verbatim (no DROP/CREATE) — db:rls-audit asserts
-- `transactions: 4` post-deploy. AC-7.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — wipe brownfield rows so the id-type switch doesn't need a UPDATE
-- ───────────────────────────────────────────────────────────────────────────
TRUNCATE TABLE "transactions" RESTART IDENTITY CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — flip id from UUID-with-default to plain TEXT
-- The prefixed-ids extension (ADR-0012) injects `tx_<base62>` at insert time.
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "id" TYPE TEXT USING "id"::TEXT;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 3 — add account_id FK (NOT NULL, CASCADE on parent delete)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  ADD COLUMN "account_id" TEXT NOT NULL;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 4 — cursor-pagination index (user_id, account_id, occurred_on desc)
-- supplements the existing transactions_user_date_idx for account-scoped queries.
-- ───────────────────────────────────────────────────────────────────────────
CREATE INDEX "transactions_user_account_date_idx"
  ON "transactions" ("user_id", "account_id", "occurred_on" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS policies preserved verbatim — no DROP, no re-CREATE. AC-7.
-- ───────────────────────────────────────────────────────────────────────────

COMMIT;
