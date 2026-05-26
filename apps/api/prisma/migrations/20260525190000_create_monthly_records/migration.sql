-- 5-4-monthly-tracking — net-new monthly_records table. FR-37/38 derived
-- aggregates + override + forward-prep `signed_off_at` column (5-5 sign-off).
--
-- The brownfield `monthly_tracking` table stays untouched (consumed by the
-- hypothesis-projection path in apps/web/src/lib/derive-monthly.ts).
--
-- FK to auth.users(id) uses ON DELETE CASCADE so account deletion (story
-- 11-2) removes every monthly record in one shot.
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — monthly_records table
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "monthly_records" (
    "id"              TEXT NOT NULL,
    "user_id"         UUID NOT NULL,
    "year"            INTEGER NOT NULL CHECK ("year" BETWEEN 2026 AND 2099),
    "month_num"       INTEGER NOT NULL CHECK ("month_num" BETWEEN 1 AND 12),
    "income_eur"      NUMERIC NOT NULL CHECK ("income_eur" >= 0),
    "spending_eur"    NUMERIC NOT NULL CHECK ("spending_eur" >= 0),
    "transfers_eur"   NUMERIC NOT NULL CHECK ("transfers_eur" >= 0),
    "net_change_eur"  NUMERIC NOT NULL,
    "signed_off_at"   TIMESTAMPTZ NULL DEFAULT NULL,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "monthly_records"
  ADD CONSTRAINT "monthly_records_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "monthly_records_user_id_year_month_num_key"
  ON "monthly_records" ("user_id", "year", "month_num");

CREATE INDEX "monthly_records_user_year_month_idx"
  ON "monthly_records" ("user_id", "year" DESC, "month_num" DESC);

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — RLS quartet on monthly_records (NFR-8, AC-3 — per-row isolation)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "monthly_records" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own monthly records" ON "monthly_records"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own monthly records" ON "monthly_records"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own monthly records" ON "monthly_records"
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own monthly records" ON "monthly_records"
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
