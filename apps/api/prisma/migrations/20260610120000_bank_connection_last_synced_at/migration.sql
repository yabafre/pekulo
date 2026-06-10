-- bank-connection-last-synced-at (quick-spec 2026-06-10) — split the
-- user-facing "last synced" timestamp from the incremental `since` cursor.
--
-- `last_refreshed_at` stays the cursor: advanced to the latest transaction
-- `updated_at` ONLY when the provider returns data (silent-data-loss defense).
-- The new `last_synced_at` is stamped to now() on EVERY successful poll, so a
-- healthy connection with no new transactions still shows a fresh sync time
-- instead of a frozen watermark (the "Synchronisée le 28 mai" bug).
--
-- Hand-written per lesson 2026-05-05 (Prisma doesn't introspect everything).
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.

BEGIN;

ALTER TABLE "bank_connections"
    ADD COLUMN "last_synced_at" TIMESTAMPTZ NULL;

-- Backfill so no existing connection regresses to "Jamais synchronisée": the
-- best proxy for "last synced" before this column existed is the cursor
-- watermark. The next successful poll overwrites it with the real poll time.
UPDATE "bank_connections"
    SET "last_synced_at" = "last_refreshed_at"
    WHERE "last_synced_at" IS NULL;

COMMIT;
