-- 5-4-monthly-tracking aped-review fix — relax monthly_records.year CHECK
-- from (BETWEEN 2026 AND 2099) to (BETWEEN 2020 AND 2099).
--
-- Why: upsertMonthlyInputSchema / getMonthlyInputSchema / listMonthlyInputSchema
-- accept year >= 2020 (so the 6-month history window can cross the 2025/2026
-- boundary), but the original CHECK rejected every year < 2026 and would surface
-- as a 500 INTERNAL on the upsert path the moment story 5-5 lands the close UI.
-- The validator → DB boundary needs to match.
--
-- Implementation: the original inline CHECK was anonymous, so we look it up by
-- definition substring in pg_constraint, DROP it, and ADD a named replacement.
-- Idempotent via _prisma_migrations registry.

BEGIN;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.monthly_records'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%year%BETWEEN 2026 AND 2099%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "monthly_records" DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE "monthly_records"
  ADD CONSTRAINT "monthly_records_year_range_check"
  CHECK ("year" BETWEEN 2020 AND 2099);

COMMIT;
