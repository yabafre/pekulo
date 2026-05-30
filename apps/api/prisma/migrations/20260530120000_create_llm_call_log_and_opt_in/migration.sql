-- Hand-written migration (ADR-0014 + 2026-05-05 lesson — no `prisma migrate
-- dev` against the Supabase pooler). Apply via
-- `bun --filter='@pekulo/api' run prisma:migrate:deploy`. Idempotent.
-- Story 6-1: LlmRoute enum + llm_call_log (append-only audit) + llm_opt_in.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "llm_route" AS ENUM ('foundation_models', 'ollama', 'third_party');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable: llm_call_log (append-only audit — NFR-26 / DR-6)
CREATE TABLE IF NOT EXISTS "llm_call_log" (
    "id" TEXT NOT NULL,
    "call_id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "phase" TEXT NOT NULL,
    "route" "llm_route" NOT NULL,
    "label_hash" TEXT NOT NULL,
    "latency_ms" INTEGER,
    "outcome" TEXT,
    "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_call_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "llm_call_log_user_created_idx"
  ON "llm_call_log"("user_id", "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "llm_call_log_user_call_idx"
  ON "llm_call_log"("user_id", "call_id");

-- CreateTable: llm_opt_in (per-user third-party opt-in, default false)
CREATE TABLE IF NOT EXISTS "llm_opt_in" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "third_party" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "llm_opt_in_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "llm_opt_in_user_id_key" ON "llm_opt_in"("user_id");

-- FK to auth.users with cascade (matches every Pekulo user-data table).
DO $$ BEGIN
  ALTER TABLE "llm_call_log"
    ADD CONSTRAINT "llm_call_log_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "llm_opt_in"
    ADD CONSTRAINT "llm_opt_in_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- RLS — manually appended (Prisma does not introspect policies).
-- llm_call_log is an append-only audit sister table (ADR-0001 shape):
--   SELECT + INSERT only. No UPDATE/DELETE policy → append-only enforced.
--   Deletion only via cascade from auth.users (story 11-2).
ALTER TABLE "llm_call_log" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own llm call log" ON "llm_call_log";
CREATE POLICY "Users can view their own llm call log" ON "llm_call_log"
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own llm call log" ON "llm_call_log";
CREATE POLICY "Users can insert their own llm call log" ON "llm_call_log"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- llm_opt_in is mutable per-user state → full RLS quartet.
ALTER TABLE "llm_opt_in" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can view their own llm opt-in" ON "llm_opt_in"
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can insert their own llm opt-in" ON "llm_opt_in"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can update their own llm opt-in" ON "llm_opt_in"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own llm opt-in" ON "llm_opt_in";
CREATE POLICY "Users can delete their own llm opt-in" ON "llm_opt_in"
  FOR DELETE USING (auth.uid() = user_id);
