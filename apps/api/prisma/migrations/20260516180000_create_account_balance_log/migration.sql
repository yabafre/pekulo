-- 2-2-account-balance-history — append-only audit sister of `accounts` per
-- ADR-0001 (sister-table pattern). One row per recorded balance change.
-- RLS quartet: INSERT + SELECT only (no UPDATE/DELETE), enforcing append-only.
-- Deletion happens only via FK cascade when the parent `accounts` row is
-- removed (ON DELETE CASCADE) — the parent delete is itself gated by the
-- holdings-FK probe at the service layer (story 2-1 AC-2).
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- Step 1 — CREATE TABLE. id is TEXT (prefixed-ids policy from the start,
-- no brownfield UUID legacy to migrate). account_id is TEXT to match the
-- post-story-2-1 accounts.id column type.
CREATE TABLE "account_balance_log" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT NOT NULL,
    "cash_balance" NUMERIC NOT NULL CHECK ("cash_balance" >= 0),
    "valued_on" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_balance_log_pkey" PRIMARY KEY ("id")
);

-- Step 2 — FK to accounts(id) with ON DELETE CASCADE (DR-5 — when the
-- parent account is removed the audit log goes with it; aligns with how
-- holdings.account_id is wired post-2-1 T1).
ALTER TABLE "account_balance_log"
  ADD CONSTRAINT "account_balance_log_account_id_fkey"
  FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE;

-- Step 3 — composite index supporting (a) "history of one account ordered
-- by date desc" (UI in story 2-3) and (b) "latest balance <= a given date"
-- (compass curve in story 7-1). Sort = Desc on valued_on so the most-recent
-- row lands at the index head.
CREATE INDEX "account_balance_log_user_account_valued_idx"
  ON "account_balance_log" ("user_id", "account_id", "valued_on" DESC);

-- Step 4 — RLS policies. Audit sister (ADR-0001) → SELECT + INSERT only,
-- mirrors compass_history (story 1-1 migration). The lack of UPDATE/DELETE
-- policies enforces append-only writes at the database layer; rls-audit
-- asserts the count of 2 (AC-2).
ALTER TABLE "account_balance_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own account balance log" ON "account_balance_log"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own account balance log" ON "account_balance_log"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
