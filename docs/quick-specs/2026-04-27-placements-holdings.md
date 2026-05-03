# Quick Spec: Placements & Holdings

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** superseded (2026-05-03)

> **This document is the original parent spec.** It was decomposed into the qs-04a → qs-04d series, all of which are now shipped or close to. Kept for historical context — the active state of the portfolio feature lives in the sub-specs below.
>
> **Superseded by:**
>
> - `2026-04-27-placements-foundation.md` (qs-04a) — `accounts` + `holdings` tables, page `/dashboard/portefeuille`, KPIs, donut chart, dialogs, schema Supabase
> - `2026-04-27-placements-yahoo.md` (qs-04b) — auto price refresh via Yahoo (replaces "manual price update only" from this spec)
> - `2026-04-27-placements-yahoo-fallbacks.md` (qs-04b-bis) — Yahoo crumb + Twelve Data fallbacks
> - `2026-04-27-placements-prices-rewrite.md` (qs-04b-final) — yahoo-finance2 npm + Python sidecar on Dokploy VPS
> - `2026-04-27-placements-fx.md` (qs-04c) — multi-currency normalization to EUR (resolves Open Q3 "EUR only, no FX")
> - `2026-04-27-placements-lots.md` (qs-04d) — `holding_lots` history table (resolves Open Q2 + Q4: `avg_cost` derivation + lot history)

## What

Add a `/dashboard/portefeuille` page to track real **investment accounts** (Livret A, PEA, CTO, AV…) and the **holdings** inside each PEA/CTO (ETF, actions). Each holding stores quantity + average cost + a manually-updated current price; the page rolls up: capital invested, current value, unrealized P/L, allocation breakdown.

## Why

`hypotheses` (qs-01) describes the savings _plan_ (matelas → 80/20 ETF). `monthly_tracking` (qs-02) tracks the _flow_ (épargne / mois). `transactions` (qs-03) tracks every individual euro in/out. None of them tracks **what's actually parked where and what it's worth right now**. This spec closes the loop — once it ships, the dashboard's "Capital Projeté" line can compare against a real "Capital Actuel".

## Acceptance Criteria

- [ ] Two new Supabase tables: `accounts` (Livret A / PEA / etc.) and `holdings` (ETF/actions inside an account).
- [ ] New route `/dashboard/portefeuille` with two sections:
  - **Comptes** — table of accounts (label, type enum, balance for cash accounts), CRUD via Dialog.
  - **Positions** — table of holdings (ticker/ISIN, label, account, quantity, prix moyen, cours actuel, valeur, +/− latente, %), CRUD via Dialog.
- [ ] KPI strip at top: Capital total, Cash (Livret A + AV), Investi en titres (somme des `holdings.qty * prixMoyen`), Valeur titres (somme des `qty * cours`), +/− latente totale, % de réussite vs objectif (`hypotheses.objectif`).
- [ ] Allocation pie/donut chart: répartition par type d'account (réutiliser `recharts` déjà installé).
- [ ] Manual price refresh: each holding row has a "Mettre à jour le cours" button that opens a small inline input or dialog to type the new price + date. **No external API call** in v1 (no Yahoo Finance, no IEX). Keeps scope tight.
- [ ] Forms use the qs-01–qs-03 stack (TanStack Form + zod + ZapAction + belt-and-suspenders invalidation).
- [ ] Nav gets a "Portefeuille" link with `PiggyBank` icon.
- [ ] Dashboard `/dashboard` gets a new KPI block "Capital actuel" derived from the live tables (deferred to follow-up if too big — flag in spec result).

## Schema (Supabase)

```sql
CREATE TYPE account_type AS ENUM ('livret', 'pea', 'cto', 'av', 'autre');
CREATE TYPE holding_kind AS ENUM ('etf', 'action', 'autre');

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type account_type NOT NULL,
  cash_balance NUMERIC NOT NULL DEFAULT 0 CHECK (cash_balance >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.holdings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  kind holding_kind NOT NULL,
  ticker TEXT,                         -- nullable (e.g. ISIN-only)
  isin TEXT,
  label TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  avg_cost NUMERIC NOT NULL CHECK (avg_cost >= 0),
  last_price NUMERIC NOT NULL DEFAULT 0 CHECK (last_price >= 0),
  last_price_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holdings_user_account_idx
  ON public.holdings (user_id, account_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;

-- (8 policies, 4 per table — same pattern as qs-03)
```

Idempotent block (with `DO $$ ... duplicate_object`, `DROP POLICY IF EXISTS`) appended to `supabase-schema.sql`. **You'll run it manually in Supabase Studio.**

## Stack reuse

- All patterns from qs-01/02/03 carry over verbatim. No new dep, no new pattern.
- For the donut chart: reuse the existing `recharts` PieChart pattern from `components/charts/budget-chart.tsx` — wrap it in a small `AllocationChart` component.

## Files to Change

**New (10)**

- `src/lib/schemas/portfolio.ts` — zod schemas (account, holding, update-price), enums, labels.
- `src/lib/data/portfolio.ts` — `readAccounts()`, `readHoldings()`, `readPortfolioSnapshot()` (combined with computed roll-ups).
- `src/lib/actions/portfolio.ts` — `getAccounts`, `getHoldings`, `saveAccount`, `deleteAccount`, `saveHolding`, `deleteHolding`, `updateHoldingPrice`. Tags `portfolio:list` (registered in `lib/zapaction/keys.ts`).
- `src/app/dashboard/portefeuille/page.tsx` — server, parallel fetch + initial roll-up.
- `src/app/dashboard/portefeuille/_components/portfolio-view.tsx` — client orchestrator (KPI strip + AllocationChart + AccountsSection + HoldingsSection).
- `src/app/dashboard/portefeuille/_components/accounts-section.tsx` — table + dialog form.
- `src/app/dashboard/portefeuille/_components/account-form.tsx` — Dialog form for account CRUD.
- `src/app/dashboard/portefeuille/_components/holdings-section.tsx` — table + dialog form + price-update inline.
- `src/app/dashboard/portefeuille/_components/holding-form.tsx` — Dialog form for holding CRUD.
- `src/components/charts/allocation-chart.tsx` — small recharts donut.

**Edited (3)**

- `src/lib/types.ts` — `Account`, `AccountType`, `Holding`, `HoldingKind`, `PortfolioSnapshot`.
- `src/lib/zapaction/keys.ts` — register new feature keys/tags for `portfolio` (replaces the `holdings` placeholder already there from qs-01 boilerplate; rename or extend).
- `src/components/nav.tsx` — add "Portefeuille" link.
- `supabase-schema.sql` — append the new tables block.

→ **14 files** (10 new, 4 edited counting `supabase-schema.sql`). Bigger than qs-02/03 because it ships **two** related tables + their CRUD UI + a chart, all at once. Splitting accounts and holdings into separate quick-specs would force ugly placeholder data while only one half exists; better to ship the pair.

## Test Plan

- **Type-check** + **lint** clean.
- **Manual #1**: SQL run → empty page state for both sections.
- **Manual #2**: create a Livret A account with cash_balance 8000 → visible in Comptes table → KPI Cash = 8000 €.
- **Manual #3**: create a PEA account → add a holding (label "MSCI World", ticker "CW8", kind ETF, qty 10, avg_cost 500, last_price 0) → it appears in Positions, valeur affichée 0, P/L −5000 (since price=0).
- **Manual #4**: click "Mettre à jour le cours" on the holding → enter 520 → submit → row reflects valeur 5200, P/L +200, KPI strip recalculates.
- **Manual #5**: edit the holding → change qty to 12 → save → KPI updates.
- **Manual #6**: delete the holding → row gone.
- **Manual #7**: AllocationChart shows correct percentages by account type.
- **Manual #8**: Supabase Studio → confirm rows under your `user_id` only.

## Open Questions (resolve before in-progress)

1. **Manual price update only** for v1, no API integration. → OK?
2. **`avg_cost` user-entered**, not derived from transactions. → For v1, OK to not auto-compute from `transactions` table? (The integration would be a follow-up: every `outflow` tagged with a holding could update qty/avg_cost.)
3. **Currency = EUR**, no FX. → OK?
4. **No transaction-history table for holdings** (no `holdings_lots`/`buys`/`sells`). → OK for v1, deferred.
5. **Donut chart by account type** vs by individual account. → By **type** (livret / pea / cto / av / autre), one slice per type. OK?
6. **Dashboard KPI block "Capital actuel"** — flagged as deferred follow-up if it complicates qs-04? → Leave as **stretch goal**. Ship `/dashboard/portefeuille` first; only update `/dashboard` if time permits within the same session.

## Result

<!-- Filled after implementation -->
