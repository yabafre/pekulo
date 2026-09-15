-- 11-2-account-deletion — close the auth.users cascade gap.
--
-- Four user-scoped tables were created WITHOUT a foreign key to auth.users:
--   compass_history   (20260509150000_create_compass_history)
--   milestones        (20260510120000_create_milestones)
--   dashboard_layout  (20260604172000_dashboard_layout)
--   user_pref         (20260616120000_create_user_pref)
--
-- Three of those four migrations carry a comment stating that "row removal
-- happens only via cascade from auth.users (story 11-2)". The comment was
-- aspirational; the constraint was never written, so deleting the auth.users
-- row left those four tables orphaned — an incomplete GDPR erasure that every
-- existing test passed. This migration makes the schema match the claim.
--
-- account_balance_log is deliberately NOT in this list: it has no direct FK to
-- auth.users either, but it cascades through accounts(id) ON DELETE CASCADE,
-- which does. The gate added in T2 accepts that indirect path.
--
-- Idempotent (DO $$ … EXCEPTION WHEN duplicate_object) so a re-run against a
-- database that already carries the constraint is a no-op. Apply via
-- `bun --filter=@pekulo/api run prisma:migrate:deploy` (ADR-0014 + the
-- 2026-05-05 lesson — never `prisma migrate dev` against the Supabase pooler).

BEGIN;

DO $$ BEGIN
  ALTER TABLE "compass_history"
    ADD CONSTRAINT "compass_history_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "milestones"
    ADD CONSTRAINT "milestones_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "dashboard_layout"
    ADD CONSTRAINT "dashboard_layout_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_pref"
    ADD CONSTRAINT "user_pref_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

COMMIT;
