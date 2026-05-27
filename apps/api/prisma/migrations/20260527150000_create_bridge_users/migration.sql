-- 5-6-bridge-connector FIX — Bridge v3 user mapping table.
--
-- DISCOVERY (2026-05-27 post-smoke-test): Bridge v3's POST /v3/aggregation/
-- connect-sessions requires `user_uuid` in the body (the Bridge-side UUID of
-- the user), NOT `user_email` as the initial story-cache cross-check (via
-- context7) suggested. Bridge's v3 model mandates a 2-step setup:
--   1. POST /v3/aggregation/users { external_user_id } → returns { uuid }
--   2. POST /v3/aggregation/connect-sessions { user_uuid } → returns { url }
--
-- This table maps each Pekulo userId (auth.users.id) to its Bridge user UUID
-- so step 1 only runs ONCE per Pekulo user (lazy-create at first
-- initiateConnection). Bridge enforces unique external_user_id per app, so a
-- re-create call would 409 — the lookup-before-create flow avoids that.
--
-- RLS: per-row isolation via auth.uid() = user_id (NFR-8 + ADR-0013). Two
-- policies only (SELECT + INSERT) — V1 has no use-case for UPDATE / DELETE on
-- this row (the mapping is immutable for a user's lifetime; cascading from
-- auth.users handles deletion).

BEGIN;

CREATE TABLE "bridge_users" (
    "user_id"           UUID NOT NULL,
    "bridge_user_uuid"  TEXT NOT NULL,
    "created_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bridge_users_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "bridge_users"
  ADD CONSTRAINT "bridge_users_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE UNIQUE INDEX "bridge_users_bridge_user_uuid_key"
  ON "bridge_users" ("bridge_user_uuid");

ALTER TABLE "bridge_users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bridge user" ON "bridge_users"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bridge user" ON "bridge_users"
  FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMIT;
