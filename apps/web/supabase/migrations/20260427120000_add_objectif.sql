-- Move financial goal (objectif) from hardcoded constant to user-editable hypothesis.

ALTER TABLE public.hypotheses
  ADD COLUMN IF NOT EXISTS objectif NUMERIC NOT NULL DEFAULT 100000;
