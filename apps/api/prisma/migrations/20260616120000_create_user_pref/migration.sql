-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 8-2 (FR-51/FR-52): ThemePref + LangPref enums + user_pref singleton.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "theme_pref" AS ENUM ('system', 'dark', 'light');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "lang_pref" AS ENUM ('fr', 'en');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: user_pref (per-user singleton — one row/user, PK user_id).
-- Same shape as dashboard_layout (no synthetic id; the prefixed-ids extension
-- opts out via UserPref:null in id-prefixes.config.ts).
CREATE TABLE IF NOT EXISTS "user_pref" (
    "user_id" UUID NOT NULL,
    "theme" "theme_pref" NOT NULL DEFAULT 'system',
    "lang" "lang_pref" NOT NULL DEFAULT 'fr',
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_pref_pkey" PRIMARY KEY ("user_id")
);

-- RLS policies (manually appended — Prisma does not introspect policies, ADR-0013).
-- user_pref is a per-user singleton (one row/user): SELECT/INSERT/UPDATE scoped
-- to the owner. No DELETE policy — a pref reset overwrites via UPDATE; row removal
-- happens only via cascade from auth.users (account deletion, story 11-2).
ALTER TABLE "user_pref" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_pref_select_own" ON "user_pref";
CREATE POLICY "user_pref_select_own" ON "user_pref"
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_pref_insert_own" ON "user_pref";
CREATE POLICY "user_pref_insert_own" ON "user_pref"
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_pref_update_own" ON "user_pref";
CREATE POLICY "user_pref_update_own" ON "user_pref"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
