-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 12-1 (ADR-0016 §2/§4): allowlist + ban gate for the private advisory
-- surface. One row per user; the request-time gate reads `status` on every
-- call (no cache, AC-3).

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "advisory_access_status" AS ENUM ('active', 'banned');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: advisory_access (one row/user — PK user_id).
CREATE TABLE IF NOT EXISTS "advisory_access" (
    "user_id" UUID NOT NULL,
    "status" "advisory_access_status" NOT NULL DEFAULT 'active',
    "granted_by" UUID,
    "granted_at" TIMESTAMPTZ,
    "banned_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisory_access_pkey" PRIMARY KEY ("user_id")
);

-- FK to auth.users with ON DELETE CASCADE (GDPR erasure, story 11-2).
-- ADD CONSTRAINT is not idempotent on its own, so guard it with a catalog
-- check; a re-run on an already-migrated database must be a no-op.
DO $$ BEGIN
  ALTER TABLE "advisory_access"
    ADD CONSTRAINT "advisory_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS quartet (manually appended — Prisma does not introspect policies, ADR-0013).
-- The table is user-scoped and mutable: the owner of the row may read,
-- insert, update and delete it. apps/api connects with the service role and
-- bypasses RLS; these policies guard the anon/direct path only (defence in
-- depth).
ALTER TABLE "advisory_access" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisory_access_select_own" ON "advisory_access";
CREATE POLICY "advisory_access_select_own" ON "advisory_access"
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_access_insert_own" ON "advisory_access";
CREATE POLICY "advisory_access_insert_own" ON "advisory_access"
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_access_update_own" ON "advisory_access";
CREATE POLICY "advisory_access_update_own" ON "advisory_access"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_access_delete_own" ON "advisory_access";
CREATE POLICY "advisory_access_delete_own" ON "advisory_access"
  FOR DELETE USING (user_id = auth.uid());
