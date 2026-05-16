-- Sidecar (story 2-2) — restore RLS on three brownfield tables whose
-- `rowsecurity` flag was flipped off in the Supabase instance between
-- story 2-1 merge and 2-2 dev start. Policies themselves are intact
-- (3 each, mirroring 0_baseline_brownfield/migration.sql:218-238) —
-- only `ENABLE ROW LEVEL SECURITY` needs re-applying so `db:rls-audit`
-- can return to OK. Idempotent: `ENABLE ROW LEVEL SECURITY` is a no-op
-- when already enabled (Postgres swallows it).
--
-- Out-of-strict-scope for 2-2's audit-table work but documented as a
-- deviation in the Dev Agent Record. Same workaround pattern story 2-1
-- T1 codified for the Supabase pooler / migrate resolve quirks.

BEGIN;

ALTER TABLE "kpis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monthly_tracking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hypotheses" ENABLE ROW LEVEL SECURITY;

COMMIT;
