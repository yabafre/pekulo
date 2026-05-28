-- 5-6-bridge-connector FEAT13 (2026-05-27): extend account_type enum with
-- 'banque' so Bridge `checking` accounts (current accounts, Revolut pockets,
-- main accounts) get a distinct category from the catch-all 'autre'.
--
-- Mapping rationale (codified in mapBridgeAccountKind on the service side):
--   checking      → banque    (compte courant + sous-comptes type Revolut)
--   savings       → livret    (existing)
--   lifeinsurance → av        (existing)
--   securities    → cto       (existing)
--   pee / pea     → pea       (existing)
--   card / loan / *  → autre  (dette / fallback)
--
-- Existing brownfield rows with type='autre' that came from Bridge checking
-- accounts are not auto-migrated by this enum addition — the second
-- UPDATE statement targets the Bridge-tagged rows specifically so
-- user-entered "autre" stays untouched.

BEGIN;

ALTER TYPE "account_type" ADD VALUE IF NOT EXISTS 'banque';

COMMIT;

-- Backfill bridge `checking` accounts that were stored as 'autre' before the
-- enum addition. Runs OUTSIDE the BEGIN/COMMIT because Postgres requires the
-- ADD VALUE to commit before the new value is usable in a query within the
-- same transaction. Manual filter on provider='bridge' AND label NOT LIKE
-- 'Bridge — Banque — Carte%' to skip card / loan rows.

UPDATE "accounts"
SET "type" = 'banque'
WHERE provider = 'bridge'
  AND type = 'autre'
  AND label NOT ILIKE '%Carte%';
