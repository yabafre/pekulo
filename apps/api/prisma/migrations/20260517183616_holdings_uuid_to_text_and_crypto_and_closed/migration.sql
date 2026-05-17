-- 3-1-holdings-orpc-port — flip holdings.id + holding_lots.id +
-- holding_lots.holding_id from UUID to TEXT, re-id all existing rows in-place
-- to hld_<base62-21> / lot_<base62-21>, drop the gen_random_uuid() defaults so
-- the prefixed-ids extension becomes the sole id minter going forward, extend
-- the holding_kind enum with 'crypto', and add the holdings.closed_at
-- TIMESTAMPTZ NULL column.
--
-- This migration is hand-written (Supabase pooler hang on `prisma migrate dev`,
-- story 1-1 / 2-1 deviation). Apply via `bun --filter=api run prisma:deploy`
-- (which calls `prisma migrate deploy`).
--
-- Idempotent via Prisma's _prisma_migrations registry — DO NOT re-run manually.
--
-- Touched tables / types:
--   - public.holdings (id column flip + re-id + drop default + add closed_at)
--   - public.holding_lots (id column flip + holding_id column flip + cascade
--                          re-id + drop default)
--   - public.holding_kind (enum) — ADD VALUE 'crypto'
--
-- RLS policies preserved (they reference auth.uid() = user_id, NOT the id /
-- kind / closed_at columns — column-type flip + enum extend + new nullable
-- column do not invalidate them). The db:rls-audit script asserts holdings: 4
-- and holding_lots: 4 post-deploy.
--
-- Postgres 12+ allows ALTER TYPE ... ADD VALUE inside a transaction (Supabase
-- ships Postgres 15+) so the entire migration lives inside one BEGIN/COMMIT.

BEGIN;

-- Step 1 — install two one-shot PL/pgSQL helpers (base62-21 generators) that
-- mirror apps/api/src/database/base62.ts. Same modulo-bias trade-off as the
-- TS helper (negligible for ID purposes). Distinct functions per prefix to
-- keep the call sites self-documenting.
CREATE OR REPLACE FUNCTION pekulo_migration_hld_id() RETURNS TEXT AS $$
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
  RETURN 'hld_' || result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pekulo_migration_lot_id() RETURNS TEXT AS $$
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
  RETURN 'lot_' || result;
END;
$$ LANGUAGE plpgsql;

-- Step 2 — extend the holding_kind enum with 'crypto'. This is a metadata-only
-- change; existing rows are not touched. Postgres 12+ allows ADD VALUE inside
-- a transaction so this is safe to colocate with the rest of the DDL.
ALTER TYPE public.holding_kind ADD VALUE IF NOT EXISTS 'crypto';

-- Step 3 — drop the FK from holding_lots.holding_id so we can flip both the
-- parent and child id columns independently. The FK constraint name comes
-- from Supabase's default naming (`<table>_<column>_fkey`).
ALTER TABLE public.holding_lots
  DROP CONSTRAINT IF EXISTS holding_lots_holding_id_fkey;

-- Step 4 — drop the gen_random_uuid() defaults on holdings.id and
-- holding_lots.id. The prefixed-ids extension takes over as the sole id
-- minter post-migration.
ALTER TABLE public.holdings
  ALTER COLUMN id DROP DEFAULT;

ALTER TABLE public.holding_lots
  ALTER COLUMN id DROP DEFAULT;

-- Step 5 — flip the column types UUID → TEXT. Postgres auto-casts existing
-- UUID values to their canonical text form (e.g. '550e8400-e29b-...'). After
-- this step, all three columns are TEXT but the rows still carry the old
-- UUID string format.
ALTER TABLE public.holdings
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.holding_lots
  ALTER COLUMN id TYPE TEXT USING id::text;

ALTER TABLE public.holding_lots
  ALTER COLUMN holding_id TYPE TEXT USING holding_id::text;

-- Step 6 — re-id all existing holdings in-place to hld_<base62-21>, cascading
-- the mapping to holding_lots.holding_id. Use a per-row loop with a
-- per-iteration new id so each old id maps to exactly one new id (no
-- double-mint per holding row).
DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.holdings LOOP
    new_id := pekulo_migration_hld_id();
    UPDATE public.holding_lots SET holding_id = new_id WHERE holding_id = rec.id;
    UPDATE public.holdings SET id = new_id WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 7 — re-id all existing holding_lots in-place to lot_<base62-21>. No
-- cascade needed — holding_lots.id is not a FK target of any other table.
DO $$
DECLARE
  rec RECORD;
  new_id TEXT;
BEGIN
  FOR rec IN SELECT id FROM public.holding_lots LOOP
    new_id := pekulo_migration_lot_id();
    UPDATE public.holding_lots SET id = new_id WHERE id = rec.id;
  END LOOP;
END $$;

-- Step 8 — re-add the FK constraint on holding_lots.holding_id. ON DELETE
-- CASCADE preserved (matches the brownfield behaviour — closing a holding
-- preserves lots, but deleting one cascades; close path lives in service
-- layer).
ALTER TABLE public.holding_lots
  ADD CONSTRAINT holding_lots_holding_id_fkey
  FOREIGN KEY (holding_id) REFERENCES public.holdings(id) ON DELETE CASCADE;

-- Step 9 — add the closed_at TIMESTAMPTZ NULL column on holdings. NULL =
-- active. Non-NULL = closed (close timestamp preserved for downstream
-- display). The default behaviour for existing rows is "active" so the new
-- column defaults to NULL (no migration backfill needed).
ALTER TABLE public.holdings
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ NULL;

-- Step 10 — drop the one-shot helpers. The base62 generator lives in TS
-- (apps/api/src/database/base62.ts) for runtime use; the migration helpers
-- are transient migration concerns only.
DROP FUNCTION pekulo_migration_hld_id();
DROP FUNCTION pekulo_migration_lot_id();

COMMIT;
