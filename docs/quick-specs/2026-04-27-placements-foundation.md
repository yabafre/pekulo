# Quick Spec: Placements & Holdings — Foundation (qs-04a)

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

First brick of a 4-step portfolio rollout (qs-04a → b → c → d). Adds `/dashboard/portefeuille` with two sections — **Comptes** and **Positions**. Manual entry only: cash balance for accounts, qty + avg_cost + last_price for holdings. Includes a `currency` field on both tables so qs-04c (FX) can plug in without a migration. Donut chart breaks down by **individual account**. Dashboard gets a stretch-goal "Capital actuel" KPI block.

**Out of scope (deferred to qs-04b/c/d):**

- Auto price refresh via Yahoo Finance (qs-04b)
- Currency conversion to EUR (qs-04c)
- Auto-derivation of `avg_cost` from a `holding_lots` history table (qs-04d)

## Why

Without holdings tracking, the dashboard's "Capital Projeté" line floats with zero anchor against reality. Even a manual-entry version closes the loop: user logs each PEA/CTO/Livret A position once a week, sees their real capital vs target. Subsequent specs replace the manual bits with automation, but the data shape & UI shipped here become permanent — that's why we ship `currency` upfront even if we don't use it yet.

## Acceptance Criteria

- [ ] Two new Supabase tables: `accounts`, `holdings` (schemas below).
- [ ] Idempotent SQL block appended to `supabase-schema.sql`. User runs it manually in Supabase Studio.
- [ ] `/dashboard/portefeuille` renders:
  - **KPI strip** (5 cards): Capital total, Cash (somme `cash_balance`), Investi (Σ `qty * avg_cost`), Valeur titres (Σ `qty * last_price`), +/− latente (`Valeur − Investi`).
  - **AllocationChart** (donut, recharts, by **individual account label**).
  - **Comptes section** — table (label, type, devise, solde, actions) + "Nouveau compte" → Dialog form.
  - **Positions section** — table (label/ticker, account, kind, qty, avg, prix, valeur, P/L, actions) + "Nouvelle position" → Dialog form. Inline "Maj cours" button on each row → small dialog with `last_price` + `last_price_at`.
- [ ] All forms use the qs-01..qs-03 stack (TanStack Form + zod + ZapAction + belt-and-suspenders invalidation: `queryClient.invalidateQueries + refetchQueries` in `onSuccess`).
- [ ] All v1 amounts treated as EUR for the KPI strip (currency stored but **not converted** — qs-04c will do that).
- [ ] Nav gets a "Portefeuille" link with `PiggyBank` icon, after "Transactions".
- [ ] **Stretch**: dashboard `/dashboard` gets a "Capital actuel" KPI replacing or complementing "Capital Projeté". If it forces too many edits, defer to follow-up — flag in spec result.

## Schema (Supabase)

```sql
DO $$ BEGIN CREATE TYPE account_type AS ENUM ('livret', 'pea', 'cto', 'av', 'autre'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE holding_kind AS ENUM ('etf', 'action', 'autre'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type account_type NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
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
  ticker TEXT,
  isin TEXT,
  label TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  avg_cost NUMERIC NOT NULL CHECK (avg_cost >= 0),
  last_price NUMERIC NOT NULL DEFAULT 0 CHECK (last_price >= 0),
  last_price_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS holdings_user_account_idx ON public.holdings (user_id, account_id);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
-- 8 policies (4 per table) — same idempotent pattern as qs-03
```

## Stack reuse (qs-01/02/03 carry-over)

- **Reads from RSC** → `lib/data/portfolio.ts`.
- **Mutations** → ZapAction `defineAction` in `lib/actions/portfolio.ts`, with `tags: [portfolioTags.list()]` + explicit `revalidatePath`.
- **Forms** → `useAppForm` + `Field*` primitives.
- **Live refresh** → `useActionQuery` + `useActionMutation` with belt-and-suspenders (explicit `invalidateQueries + refetchQueries`).
- **Donut** → reuse the recharts `PieChart` pattern from `components/charts/budget-chart.tsx`.

## Files to Change

**New (10)**

- `src/lib/schemas/portfolio.ts` — zod (account, holding, updatePrice), enums (`accountType`, `holdingKind`), labels, currency list (`['EUR','USD','GBP','CHF']` minimum, ISO 4217 strings).
- `src/lib/data/portfolio.ts` — `readAccounts()`, `readHoldings()`, plus `readPortfolioSnapshot()` returning `{ accounts, holdings, kpi }` with computed roll-ups.
- `src/lib/actions/portfolio.ts` — `getAccounts`, `getHoldings`, `saveAccount`, `deleteAccount`, `saveHolding`, `deleteHolding`, `updateHoldingPrice`. All write actions tagged.
- `src/app/dashboard/portefeuille/page.tsx` — server, fetches snapshot.
- `src/app/dashboard/portefeuille/_components/portfolio-view.tsx` — client, KPI strip + AllocationChart + AccountsSection + HoldingsSection.
- `src/app/dashboard/portefeuille/_components/accounts-section.tsx` — table + Dialog trigger.
- `src/app/dashboard/portefeuille/_components/account-form.tsx` — Dialog form.
- `src/app/dashboard/portefeuille/_components/holdings-section.tsx` — table + Dialog trigger + inline "Maj cours".
- `src/app/dashboard/portefeuille/_components/holding-form.tsx` — Dialog form (covers create/edit + "Maj cours" — same component, mode prop).
- `src/components/charts/allocation-chart.tsx` — recharts donut, accepts `data: { label, value }[]`.

**Edited (4)**

- `src/lib/types.ts` — `Currency`, `Account`, `AccountType`, `Holding`, `HoldingKind`, `PortfolioSnapshot`.
- `src/lib/zapaction/keys.ts` — register `portfolioKeys` + `portfolioTags` (replaces the placeholder `holdings*` keys present from qs-01 boilerplate; rename for clarity).
- `src/components/nav.tsx` — "Portefeuille" link with `PiggyBank` icon.
- `supabase-schema.sql` — append the new block.

→ **14 files** (10 new, 4 edited). Same shape as qs-03 + 1 chart + 1 schemas-keys edit.

## Test Plan

- **Type-check** + **lint** clean.
- **Manual #1** (after user runs SQL): empty page → "Aucun compte" / "Aucune position" empty states.
- **Manual #2**: create Livret A (label "Boursorama Livret", type livret, devise EUR, cash 8000) → KPI Cash = 8000 €, Capital total = 8000 €, donut shows one slice "Boursorama Livret".
- **Manual #3**: create PEA (label "PEA Bourso", type pea, devise EUR, cash 0) → second slice in donut at 0 (or skipped).
- **Manual #4**: add holding (account=PEA Bourso, kind etf, ticker CW8, label "MSCI World", devise EUR, qty 10, avg_cost 500, last_price 0) → Investi = 5000, Valeur = 0, P/L = −5000, KPI strip reflects.
- **Manual #5**: click "Maj cours" → enter 520, date today → submit → Valeur = 5200, P/L = +200, KPI updates live (no manual refresh).
- **Manual #6**: edit holding → qty 12 → save → KPIs reflect.
- **Manual #7**: delete holding → row gone, KPIs back without it.
- **Manual #8**: Supabase Studio → confirm RLS works (only own rows visible).
- **Manual #9** (stretch): dashboard `/dashboard` shows new "Capital actuel" KPI matching the portefeuille page total.

## Open Questions (none — resolved by user)

1. ✅ Manual price entry only for v1. Auto-API → qs-04b.
2. ✅ Manual `avg_cost` for v1. Derivation from `holding_lots` → qs-04d.
3. ✅ EUR-only display for v1. Multi-currency conversion → qs-04c.
4. ✅ No `holding_lots` table yet — schema cooked in qs-04d.
5. ✅ Donut by **individual account** (one slice per account, not by type).
6. ✅ Dashboard KPI = stretch goal.

## Result

<!-- Filled after implementation -->
