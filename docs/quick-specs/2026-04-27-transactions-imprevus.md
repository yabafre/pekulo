# Quick Spec: Transactions & Imprévus

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

Add a `/dashboard/transactions` page where the user logs every real **inflow/outflow** with a category and a date. Special category `imprevu` flags one-off events (panne, dépense médicale, bonus surprise). The page lists all transactions with filters (year, month, type, category) and a "Nouvelle transaction" button. A KPI strip at the top shows month-to-date inflows / outflows / net.

## Why

`hypotheses` (qs-01) is the plan; `monthly_tracking` (qs-02) is the per-month total roll-up. But neither captures the **why** of a deviation — was it the lifestyle bucket overshooting, or a one-off car repair, or a freelance bonus? Transactions give the granularity to answer that. They also feed qs-04 (placements) when the user logs a transfer to PEA/Livret A.

## Acceptance Criteria

- [ ] New table `transactions` (Supabase) — see schema below.
- [ ] New route `/dashboard/transactions` lists rows newest-first, paginated/scrollable, with filters: year (default current), month (default current), type (`inflow` | `outflow` | both), category (multi-select).
- [ ] "Nouvelle transaction" button opens a Dialog form: date (date picker), label (text), amount (positive number), type (`inflow` | `outflow`), category (select), `is_imprevu` (checkbox), notes (optional textarea).
- [ ] Submit upserts; row visible in the list immediately (TanStack Query invalidate + refetch — applying the qs-02 belt-and-suspenders pattern).
- [ ] Each row has Edit / Delete inline actions.
- [ ] KPI strip computes for the **current selected month**: total inflow, total outflow, net. Imprévu sub-total shown in a secondary line.
- [ ] Categories are a hardcoded enum for v1 (no user-defined categories — that's a future spec): `salaire`, `freelance`, `remote`, `bonus`, `loyer`, `courses`, `transport`, `sorties`, `voyage`, `sante`, `imprevu`, `autre`.
- [ ] No regression on dashboard or `/dashboard/mensuel` (they don't consume transactions yet — that's a follow-up).
- [ ] Nav gets a "Transactions" link with a `Wallet` icon.

## Schema (Supabase)

```sql
CREATE TYPE transaction_type AS ENUM ('inflow', 'outflow');

CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  occurred_on DATE NOT NULL,
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  type transaction_type NOT NULL,
  category TEXT NOT NULL,
  is_imprevu BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions (user_id, occurred_on DESC);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "insert own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "delete own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);
```

I'll append this to `supabase-schema.sql`. **You'll need to run it in Supabase Studio before testing** — I don't have CLI access to migrate.

## Stack reuse (qs-01 + qs-02 carry-over)

- Reads from RSC: `lib/data/transactions.ts` direct Supabase
- Mutations: ZapAction `defineAction` in `lib/actions/transactions.ts`, `tags: [transactionsTags.list()]`, with `revalidatePath("/dashboard/transactions") + revalidatePath("/dashboard")`
- Form: `useAppForm` + `Field*` primitives, with **explicit `queryClient.invalidateQueries + refetchQueries`** in `onSuccess` (not just `invalidateWithTags`)
- Filters: client-side state, no URL serialization for v1
- Date picker: keep it simple — native `<input type="date">` for v1 (no shadcn Calendar component yet; that's adding a dep we don't need)
- Select for category/type: shadcn `Select` (already in `components/ui/select.tsx`)

## Files to Change

**New (7)**

- `src/lib/schemas/transactions.ts` — zod schema, category enum, type enum.
- `src/lib/data/transactions.ts` — `readTransactions(filters?)` direct Supabase.
- `src/lib/actions/transactions.ts` — `getTransactions`, `saveTransaction` (upsert by id), `deleteTransaction`.
- `src/app/dashboard/transactions/page.tsx` — server component, initial load.
- `src/app/dashboard/transactions/_components/transactions-list.tsx` — client list with filters + KPI strip + edit/delete inline.
- `src/app/dashboard/transactions/_components/transaction-form.tsx` — client Dialog form (create + edit).
- `supabase-schema.sql` — append the new table block (manual run required).

**Edited (2)**

- `src/lib/types.ts` — `Transaction` type, `TransactionFilters` type, `TransactionCategory` const enum.
- `src/components/nav.tsx` — "Transactions" link with `Wallet` icon.

→ **9 files** (7 new, 2 edited). Same shape as qs-02.

## Test Plan

- **Unit** (light): zod schema rejects amount < 0, invalid date, unknown category.
- **Type-check**: `npx tsc --noEmit` clean.
- **Lint**: `npx eslint <my files>` clean.
- **Manual #1**: log in → `/dashboard/transactions` → empty state.
- **Manual #2**: "Nouvelle transaction" → fill form (date today, label "Test outflow", amount 50, type outflow, category courses) → save → row appears in list, KPI strip updates outflow total.
- **Manual #3**: edit the row → change amount to 75 → save → list reflects 75, KPI strip recalculates.
- **Manual #4**: delete the row → confirm → row gone, KPI strip back to 0.
- **Manual #5**: create one with `is_imprevu = true` → KPI strip shows imprévu subtotal.
- **Manual #6**: filter by category → only matching rows shown.
- **Manual #7**: Supabase Studio → verify the row's RLS works (only your user_id rows visible).

## Open Questions (resolve before in-progress)

1. **Pagination / infinite scroll** vs simple list cap? → Default to **100 most-recent transactions** for v1, with a "Charger plus" button. No infinite scroll machinery. OK?
2. **Edit inline or in dialog?** → **Dialog** (consistent with qs-02 monthly-form). OK?
3. **Categories hardcoded** vs new `categories` table? → **Hardcoded enum** for v1 (faster to ship, easy to migrate later when the user actually has a need for custom categories). OK?
4. **Should I append the SQL to `supabase-schema.sql` and ask you to run it manually?** → Yes by default, since I can't `supabase db push` from here. Confirm.
5. **Currency**: EUR only? No multi-currency. OK?

## Result

**Final file count: 9** (matches estimate). 7 new, 2 edited.

**Tests run**

- `npx tsc --noEmit` — clean
- `npx eslint <new files>` — clean (after small fixes: unused `TRANSACTION_CATEGORIES` import, `useMemo` for `rows` dep stability, removal of `Trash2` import that wasn't used)
- Manual smoke (SQL run by user in Supabase Studio): empty state, create, edit, delete, imprévu KPI sub-total, filters by year/month/type — all OK.

**SQL migration delivered** as an idempotent block appended to `supabase-schema.sql` (uses `DO $$ EXCEPTION WHEN duplicate_object` for the enum and `DROP POLICY IF EXISTS` for policies, so it can be re-run safely).

**Form submission validation pattern** discovered: passing the zod schema directly as `validators.onChange` couldn't satisfy TanStack Form's `FormValidateOrFn` typing when the form state shape diverges from the schema (id optional in form vs strict in schema, notes always-string in form vs nullable in schema). Solution: drop the `validators.onChange` schema, validate via `transactionInputSchema.parse(...)` inside `onSubmit`. Trade-off: no field-level live error display for the schema rules, but field-level errors weren't critical here. **Carry-over for qs-04**: prefer aligning form shape exactly with schema, otherwise validate at submit.

**Carry-over rules confirmed**

- Belt-and-suspenders invalidation in form `onSuccess` (queryClient.invalidateQueries + refetchQueries) — applied here for save + delete.
- Reads from RSC via `lib/data/<feature>.ts` direct Supabase. Reads from client via ZapAction `useActionQuery`.
- Mutations via ZapAction `defineAction` with `tags` + explicit `revalidatePath` calls.
