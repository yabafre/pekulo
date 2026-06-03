-- Story 6-7 (FR-33 amended) — transaction origin column. Drives the épic-6
-- categorisation policy (manual = suggest/confirm; csv/bridge = auto-apply).
-- Plain TEXT, NO CHECK (lesson 2026-05-27 — universe is enumerated in
-- @pekulo/validators#TRANSACTION_SOURCES + app-layer validated, mirrors
-- `category`). No RLS change: `transactions` is an already-RLS'd user-data
-- table (4 policies); adding a column does not touch row-security
-- (lesson 2026-06-02 — the Supabase advisor flags RLS-disabled tables, which
-- this is not).
ALTER TABLE "transactions" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual';

-- Backfill: already-synced Bridge rows are bulk-origin → the hourly sweep
-- must treat them as auto-apply, not suggest. CSV-imported historical rows
-- predate the column and stay 'manual' (acceptable — they are mostly already
-- categorised or attempted).
UPDATE "transactions" SET "source" = 'bridge' WHERE "provider" IS NOT NULL;
