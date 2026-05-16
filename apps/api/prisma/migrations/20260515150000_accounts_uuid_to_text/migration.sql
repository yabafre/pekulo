-- 2-1-accounts-orpc-port — flip accounts.id and holdings.account_id from UUID
-- to TEXT, re-id all existing accounts in-place to acc_<base62-21>, drop the
-- gen_random_uuid() default so the prefixed-ids extension becomes the sole
-- id minter going forward.
--
-- This migration is hand-written (Supabase pooler hang on `prisma migrate dev`,
-- story 1-1 deviation T1). Apply via `bun --filter=api run prisma:migrate:deploy`
-- (which calls `prisma migrate deploy`).
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.
--
-- Touched tables:
--   - public.accounts (id column type flip + re-id + drop default)
--   - public.holdings (account_id column type flip + cascade re-id)
--
-- RLS policies preserved (they reference auth.uid() = user_id, NOT the id
-- column — column-type flip does not invalidate them). The db:rls-audit
-- script asserts `accounts: 4` and `holdings: 4` post-deploy.

BEGIN;

-- Step 1 — install a one-shot PL/pgSQL helper for base62-21 generation that
-- mirrors apps/api/src/database/base62.ts. Uses pgcrypto's gen_random_bytes()
-- which Supabase ships pre-enabled. Same modulo-bias trade-off as the TS
-- helper (negligible for ID purposes).
CREATE OR REPLACE FUNCTION pekulo_migration_acc_id() RETURNS TEXT AS $$
DECLARE
  alphabet TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  bytes BYTEA;
  result TEXT := '';
  idx INTEGER;
BEGIN
  bytes := gen_random_bytes(21);
  FOR idx IN 0..20 LOOP
    result := result || substr(alphabet, 1 + (get_byte(bytes, idx) % 62), 1);
  END LOOP;
  RETURN 'acc_' || result;
END;
$$ LANGUAGE plpgsql;

-- Step 2 — drop the FK from holdings.account_id so we can flip both columns
-- independently. The FK constraint name comes from Supabase's default naming
-- (`<table>_<column>_fkey`).
ALTER TABLE public.holdings
  DROP CONSTRAINT IF EXISTS holdings_account_id_fkey;

-- Step 3 — drop the gen_random_uuid() default on accounts.id. The
-- prefixed-ids extension takes over as the sole id minter post-migration.
ALTER TABLE public.accounts
  ALTER COLUMN id DROP DEFAULT;

-- Step 4 — flip the column types UUID → TEXT. Postgres auto-casts existing
-- UUID values to their canonical text form (e.g. '550e8400-e29b-...'). After
-- this step, both columns are TEXT but the rows still carry the old UUID
-- string format.
ALTER TABLE public.accounts
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.holdings
  ALTER COLUMN account_id TYPE TEXT USING account_id::text;

-- Step 5 — re-id all existing accounts in-place to acc_<base62-21>, cascading
-- the mapping to holdings.account_id.
--
-- Two safeguards:
--   1. WHERE filter — only re-id rows whose id does NOT already match the
--      acc_<base62-21> shape. Makes the loop a no-op if an operator copies
--      this SQL into the Supabase SQL editor on an already-migrated DB,
--      preventing destructive re-mints of every reference.
--   2. Snapshot via array_agg — materialise the id list BEFORE any UPDATE
--      fires, so HOT updates moving tuples cannot cause the implicit cursor
--      to revisit a re-id'd row under its new id.
DO $$
DECLARE
  old_ids TEXT[];
  old_id TEXT;
  new_id TEXT;
BEGIN
  SELECT array_agg(id) INTO old_ids
    FROM public.accounts
    WHERE id !~ '^acc_[0-9A-Za-z]{21}$';
  IF old_ids IS NULL THEN
    RETURN;
  END IF;
  FOREACH old_id IN ARRAY old_ids LOOP
    new_id := pekulo_migration_acc_id();
    -- Cascade FIRST (holdings.account_id) then update accounts.id so a
    -- transient state where a holding points at a non-existent account
    -- never occurs (the FK is currently dropped so this ordering is purely
    -- defensive — re-add at the end re-enforces).
    UPDATE public.holdings SET account_id = new_id WHERE account_id = old_id;
    UPDATE public.accounts SET id = new_id WHERE id = old_id;
  END LOOP;
END $$;

-- Step 6 — re-add the FK constraint. ON DELETE CASCADE preserved (matches
-- the brownfield behaviour the FK guard at the service layer protects
-- against — the cascade is the dangerous default that AC-2 enforces against).
ALTER TABLE public.holdings
  ADD CONSTRAINT holdings_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Step 7 — drop the one-shot helper. The base62 generator lives in TS
-- (apps/api/src/database/base62.ts) for runtime use; the migration helper is
-- a transient migration concern only.
DROP FUNCTION pekulo_migration_acc_id();

COMMIT;
