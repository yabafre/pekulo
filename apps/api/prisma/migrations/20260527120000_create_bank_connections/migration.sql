-- 5-6-bridge-connector — net-new bank_connections table + Supabase Vault
-- enablement (ADR-0015 amendment: Vault over pgcrypto).
--
-- Hand-written per lesson 2026-05-05 — Prisma does not introspect Postgres
-- policies, and the supabase_vault extension lives outside Prisma's schema
-- introspection scope. Run via `bun --filter='@pekulo/api' run prisma:migrate:dev`.
--
-- Token storage path: `access_token_secret_id` + `refresh_token_secret_id`
-- point to `vault.secrets(id)` rows. The repository writes secrets via
-- `vault.create_secret(...)` and reads via the `vault.decrypted_secrets`
-- view — Prisma sees only the uuid FK columns.
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — supabase_vault extension (Vault lives under schema `vault`)
-- ───────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — bank_connections table
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE "bank_connections" (
    "id"                       TEXT NOT NULL,
    "user_id"                  UUID NOT NULL,
    "provider"                 TEXT NOT NULL,
    "provider_item_id"         TEXT NOT NULL,
    "access_token_secret_id"   UUID NULL,
    "refresh_token_secret_id"  UUID NULL,
    "status"                   TEXT NOT NULL DEFAULT 'active',
    "display_name"             TEXT NULL,
    "last_refreshed_at"        TIMESTAMPTZ NULL,
    "created_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_connections_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bank_connections_status_check"
      CHECK ("status" IN ('active', 'sca_required', 'revoked')),
    CONSTRAINT "bank_connections_provider_check"
      CHECK ("provider" IN ('bridge'))
);

ALTER TABLE "bank_connections"
  ADD CONSTRAINT "bank_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE "bank_connections"
  ADD CONSTRAINT "bank_connections_access_token_secret_id_fkey"
  FOREIGN KEY ("access_token_secret_id") REFERENCES "vault"."secrets"("id") ON DELETE SET NULL;

ALTER TABLE "bank_connections"
  ADD CONSTRAINT "bank_connections_refresh_token_secret_id_fkey"
  FOREIGN KEY ("refresh_token_secret_id") REFERENCES "vault"."secrets"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "bank_connections_user_provider_item_uq"
  ON "bank_connections" ("user_id", "provider", "provider_item_id");

CREATE INDEX "bank_connections_user_status_idx"
  ON "bank_connections" ("user_id", "status");

-- ───────────────────────────────────────────────────────────────────────────
-- Step 3 — RLS quartet on bank_connections (NFR-8, ADR-0013 — per-row isolation)
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "bank_connections" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bank connections" ON "bank_connections"
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bank connections" ON "bank_connections"
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bank connections" ON "bank_connections"
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bank connections" ON "bank_connections"
  FOR DELETE USING (auth.uid() = user_id);

COMMIT;
