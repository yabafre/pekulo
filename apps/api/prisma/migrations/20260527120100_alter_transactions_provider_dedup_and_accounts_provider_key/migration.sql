-- 5-6-bridge-connector — provider dedup columns on transactions + accounts.
--
-- transactions gains (provider, provider_transaction_id) so the Bridge import
-- path can pre-flight `findExistingProviderTxIds(userId, "bridge", ids[])`
-- before bulk-inserting only the missing rows. AC-2 of story 5-6.
--
-- accounts gains (provider, provider_account_key) so `completeConnection`
-- can auto-create one Account row per Bridge account, idempotent on
-- re-connect of the same Bridge item. AC-7 of story 5-6.
--
-- Partial UNIQUE indexes (`WHERE provider IS NOT NULL`) keep manual/CSV rows
-- — which have NULL provider — outside the uniqueness constraint. Without
-- the partial predicate, two NULL provider rows would clash on the unique
-- index (PG treats two NULLs as distinct, but the partial form is more
-- explicit and avoids index bloat from the manual ingestion path).
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 1 — transactions: provider + provider_transaction_id columns + indexes
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "transactions"
  ADD COLUMN "provider"                TEXT NULL,
  ADD COLUMN "provider_transaction_id" TEXT NULL;

CREATE INDEX "transactions_user_provider_txid_idx"
  ON "transactions" ("user_id", "provider", "provider_transaction_id");

CREATE UNIQUE INDEX "transactions_user_provider_txid_uq"
  ON "transactions" ("user_id", "provider", "provider_transaction_id")
  WHERE "provider" IS NOT NULL;

-- ───────────────────────────────────────────────────────────────────────────
-- Step 2 — accounts: provider + provider_account_key columns + unique index
-- ───────────────────────────────────────────────────────────────────────────
ALTER TABLE "accounts"
  ADD COLUMN "provider"             TEXT NULL,
  ADD COLUMN "provider_account_key" TEXT NULL;

CREATE UNIQUE INDEX "accounts_user_provider_key_uq"
  ON "accounts" ("user_id", "provider", "provider_account_key")
  WHERE "provider" IS NOT NULL;

COMMIT;
