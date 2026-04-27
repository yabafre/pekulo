-- Add projection horizon to hypotheses (already applied manually in production).
-- For an existing linked database, mark this as already applied:
--   supabase migration repair --status applied 20260427000000

ALTER TABLE public.hypotheses
  ADD COLUMN IF NOT EXISTS horizon_years SMALLINT NOT NULL DEFAULT 5;
