-- Hand-written migration (ADR-0014 + 2026-05-05 lesson).
-- Story 12-3 (ADR-0016 §3/§4): Persisted advisory sessions with field-level encryption.

CREATE TABLE IF NOT EXISTS "advisory_sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "snapshot_version" INTEGER NOT NULL DEFAULT 1,
    "encrypted_payload" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "advisory_sessions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "advisory_sessions"
    ADD CONSTRAINT "advisory_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "advisory_sessions_user_created_idx"
  ON "advisory_sessions" ("user_id", "created_at" DESC);

ALTER TABLE "advisory_sessions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "advisory_sessions_select_own" ON "advisory_sessions";
CREATE POLICY "advisory_sessions_select_own" ON "advisory_sessions"
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_sessions_insert_own" ON "advisory_sessions";
CREATE POLICY "advisory_sessions_insert_own" ON "advisory_sessions"
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_sessions_update_own" ON "advisory_sessions";
CREATE POLICY "advisory_sessions_update_own" ON "advisory_sessions"
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "advisory_sessions_delete_own" ON "advisory_sessions";
CREATE POLICY "advisory_sessions_delete_own" ON "advisory_sessions"
  FOR DELETE USING (user_id = auth.uid());
