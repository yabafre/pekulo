# Quick Spec: Placements — holding_lots history (qs-04d)

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** awaiting-sql-migration

## What

Add a `holding_lots` table that records each individual buy/sell event for a holding. The holding's `quantity` and `avg_cost` are no longer manually entered — they're derived from the lot history using weighted average cost. When a holding has lots, the manual `quantity` / `avgCost` inputs in `HoldingForm` become read-only ("calculé depuis l'historique"). When a holding has zero lots, manual mode persists (back-compat with all qs-04a holdings).

## Why

`avg_cost` typed manually drifts as soon as the user makes a second buy at a different price. Real broker statements report weighted-average cost computed from every lot. Lots also unlock realised gains tracking when sells happen, capital gains tax reporting, and DCA visualisation — things qs-04 has been building toward.

## Acceptance Criteria

### Schema (Supabase)
- [ ] New enum `lot_type` ENUM('buy','sell') (idempotent).
- [ ] New table `holding_lots` (`id`, `user_id`, `holding_id`, `type`, `occurred_on`, `quantity`, `price_unit`, `fees`, `notes`, timestamps).
- [ ] Foreign key `holding_lots.holding_id REFERENCES holdings(id) ON DELETE CASCADE`.
- [ ] Index on `(user_id, holding_id, occurred_on)`.
- [ ] 4 RLS policies (select/insert/update/delete) gated on `auth.uid() = user_id`.
- [ ] Idempotent SQL block appended to `apps/web/supabase-schema.sql`. User runs it manually in Supabase Studio.

### Derivation
- [ ] New pure `apps/web/src/lib/derive-lots.ts` exposes `deriveFromLots(lots) → { quantity, avgCost }` using weighted-average cost. Sells reduce qty proportionally (cost basis = sellQty × currentAvg). Fees added to cost on buys, ignored on sells.
- [ ] After every lot mutation (`addLot` or `deleteLot`), the action recomputes `quantity` and `avg_cost` for the parent holding and persists them on the `holdings` row.

### Actions (ZapAction)
- [ ] `getHoldingLots(holdingId)` → list lots ordered by `occurred_on ASC`.
- [ ] `addHoldingLot(input)` → insert lot, recompute holding qty/avgCost, update holdings row, tagged `portfolio:holdings`.
- [ ] `deleteHoldingLot({ id })` → delete lot, recompute holding qty/avgCost, update holdings row.
- [ ] No `updateLot` for v1 (user deletes + re-adds if needed).

### UI
- [ ] New `apps/web/src/app/dashboard/portefeuille/_components/lots-dialog.tsx` — Dialog showing the lots table for one holding (date, type, qty, prix unitaire, frais, valeur, notes) + "Ajouter un lot" form inline.
- [ ] In `holdings-section.tsx` row: add a 📊 button (lucide `History` icon) → opens the LotsDialog for that row. Disabled if holding has zero quantity (defensive).
- [ ] In `holding-form.tsx`: when the holding has lots, `quantity` + `avgCost` inputs become `disabled` with hint text "calculé depuis l'historique".
- [ ] Banner in LotsDialog: "Total qty: X · Avg cost: Y €" computed live.

### Carry-over
- [ ] Existing holdings (no lots) keep their manual `quantity`/`avgCost` until the user adds lots.
- [ ] First lot added on a manual holding: **no auto-import** of existing manual values for v1. The user is responsible for entering all historical buys if they want full lot tracking. We display a one-time inline notice in LotsDialog: "Pour conserver tes valeurs actuelles dans l'historique, ajoute un lot d'achat avec qty {{currentQty}} au prix {{currentAvg}}." — a "Import comme premier lot" button does it in one click.

## Schema

```sql
DO $$ BEGIN CREATE TYPE lot_type AS ENUM ('buy', 'sell'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.holding_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  holding_id UUID NOT NULL REFERENCES public.holdings(id) ON DELETE CASCADE,
  type lot_type NOT NULL,
  occurred_on DATE NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price_unit NUMERIC NOT NULL CHECK (price_unit >= 0),
  fees NUMERIC NOT NULL DEFAULT 0 CHECK (fees >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS holding_lots_user_holding_idx
  ON public.holding_lots (user_id, holding_id, occurred_on);
ALTER TABLE public.holding_lots ENABLE ROW LEVEL SECURITY;
-- 4 policies (drop-if-exists + create) — same pattern as qs-03/04a
```

## Files to Change

**New (5)**
- `apps/web/src/lib/schemas/holding-lots.ts` — zod schemas (input, id, listFilter)
- `apps/web/src/lib/derive-lots.ts` — pure `deriveFromLots` (weighted average + sell handling)
- `apps/web/src/lib/data/holding-lots.ts` — server-only `readHoldingLots(holdingId)`
- `apps/web/src/lib/actions/holding-lots.ts` — get/add/delete + recompute holding
- `apps/web/src/app/dashboard/portefeuille/_components/lots-dialog.tsx` — Dialog UI

**Edited (4)**
- `apps/web/src/lib/types.ts` — `LotType`, `HoldingLot`
- `apps/web/src/lib/zapaction/keys.ts` — `lotsKeys` + `lotsTags` + registry
- `apps/web/src/app/dashboard/portefeuille/_components/holdings-section.tsx` — 📊 button per row
- `apps/web/src/app/dashboard/portefeuille/_components/holding-form.tsx` — disabled inputs when lots exist
- `apps/web/supabase-schema.sql` — append SQL block

→ **10 files** (5 new, 5 edited).

## Test Plan

- **Type-check + lint** clean.
- **Manual #1** (after SQL run): existing holding with manual qty=10 avgCost=200 → click 📊 → empty lots table, hint to import as first lot.
- **Manual #2**: click "Import comme premier lot" → 1 buy lot at qty=10 price=200 → table shows it. Holding qty/avgCost unchanged.
- **Manual #3**: add a second buy lot qty=5 price=240 → recompute → holding qty=15, avgCost=(2000+1200)/15 = 213.33.
- **Manual #4**: add a sell lot qty=3 price=260 → holding qty=12, avgCost still ~213.33 (weighted unchanged on sell).
- **Manual #5**: delete a lot → recompute → values revert.
- **Manual #6**: HoldingForm dialog shows qty + avgCost as `disabled` with hint "calculé depuis l'historique" when lots exist; editable when zero lots.
- **Manual #7**: cascade delete — delete a holding → its lots vanish (FK ON DELETE CASCADE).

## Open Questions

1. **Weighted-average vs FIFO** — weighted for v1, simpler & matches most broker statements. FIFO/LIFO out of scope.
2. **Lot edit** — out of scope v1 (delete + re-add).
3. **Currency on lots** — inherits from `holding.currency` at lot time. Lots don't store currency. (FX of historical buys → out of scope.)
4. **Auto-import existing manual values** — opt-in via button, not automatic.

All defaults documented above. Confirm and I attack.

## Result

<!-- Filled after implementation -->
