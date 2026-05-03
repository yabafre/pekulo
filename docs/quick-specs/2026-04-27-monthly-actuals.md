# Quick Spec: Monthly Actuals

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

Add a `/dashboard/mensuel` page listing every month of the 5-year horizon (May 2026 → Apr 2031). Each row shows the **projected** numbers (derived from `hypotheses`) and the **actual** numbers if recorded. A "Saisir / Modifier" action opens a dialog form that upserts a row into `monthly_tracking`. A row's existence in the DB means "this is what really happened that month"; absent rows fall back to projection.

## Why

`hypotheses` (qs-01) gives us the _plan_. Real life doesn't follow the plan — bonus, expense surprises, a remote-abroad month that fell through, etc. Without a way to record actuals, the dashboard's projection drifts further from reality every month. This is also the foundation for qs-03 (transactions/imprévus) which will roll up into monthly actuals.

## Acceptance Criteria

- [ ] New route `/dashboard/mensuel` lists 60 rows (May 2026 → Apr 2031), one per month, sorted chronologically.
- [ ] Each row shows: `mois` | `projeté épargne` | `réel épargne` (or `—`) | `écart` | action button.
- [ ] Clicking the action opens a dialog with the full month form (net, avantages, dépenses, crédit, remote, freelance) — pre-filled with the actual row if it exists, otherwise pre-filled with the projection (so the user just adjusts what differs).
- [ ] Submitting upserts into `monthly_tracking` with `(user_id, month_num, year)` as the conflict key.
- [ ] A "Effacer cette ligne" button in the dialog deletes the row (back to projection).
- [ ] The list updates without a hard reload (TanStack Query refetch via tag invalidation), since this page reads via `useActionQuery` to keep the table reactive after edits.
- [ ] Validation (zod): all fields ≥ 0; auto-compute `epargne_mois = net + avantages + remote + freelance − dépenses − crédit` server-side; reject if `month_num ∉ [1..12]` or `year ∉ [2026..2031]`.
- [ ] Nav gets a "Mensuel" link next to "Paramètres".
- [ ] No regression on the dashboard: it keeps using projections for `monthlyData` until qs-02 wires actuals into it (deferred to follow-up; qs-02 ships the editor only).

## Stack reuse

Per qs-01 carry-over decisions:

- **Reads from RSC** → `src/lib/data/monthly.ts` direct Supabase helper.
- **Mutations from client** → ZapAction `defineAction` in `src/lib/actions/monthly.ts`, with `tags: [monthlyTags.list()]` (registry already wired in `lib/zapaction/keys.ts`).
- **Form** → `useAppForm` + `Field`/`FieldLabel`/`FieldControl`/`FieldError` primitives from qs-01.
- **Live list** → `useActionQuery(getMonthlyEntries, { queryKey: monthlyKeys.list(), readPolicy: "read-only" })` so post-mutation invalidation refreshes automatically (this is the first time we use ZapAction's query/tag loop end-to-end — qs-01 used reads only via RSC).
- **No `force-dynamic` blanket** unless we hit a real cache problem.

## Files to Change

**New (7)**

- `src/lib/schemas/monthly.ts` — zod schema for a monthly entry (and a `monthRange` helper that yields the 60 (year, monthNum) pairs).
- `src/lib/data/monthly.ts` — `readMonthlyEntries(userId)` returns rows from `monthly_tracking`.
- `src/lib/derive-monthly.ts` — `projectMonth(h: Hypotheses, year: number, monthNum: number): MonthlyRecord` applying the embedded assumptions: remote on for May & June, credit from `dateDebutCredit`, freelance always on, salary grown by `augmentationSalaire^yearsSinceStart` once per Jan; ETF perf compounds at `perfEtfAnnuelle / 12`. Replaces the hardcoded 60-row table in `lib/data.ts` (though `lib/data.ts` stays as fallback seed for now).
- `src/lib/actions/monthly.ts` — `getMonthlyEntries` (no tags), `saveMonthlyEntry` (tagged `monthly:list`), `deleteMonthlyEntry` (tagged `monthly:list`). Both mutations call `revalidatePath("/dashboard/mensuel")` and `revalidatePath("/dashboard")`.
- `src/app/dashboard/mensuel/page.tsx` — server component, fetches hypotheses + actual rows server-side, computes the merged 60-row dataset, passes to the client list (which then takes over with TanStack Query).
- `src/app/dashboard/mensuel/_components/monthly-list.tsx` — client, table + dialog trigger. Uses `useActionQuery` to keep in sync after mutations.
- `src/app/dashboard/mensuel/_components/monthly-form.tsx` — client form rendered inside `Dialog`, calls `saveMonthlyEntry` via `useActionMutation`. Includes a "Effacer" button calling `deleteMonthlyEntry`.

**Edited (2)**

- `src/lib/types.ts` — add `MonthlyEntry` (DB-mapped, camelCase) and `MonthlyMerged = MonthlyRecord & { source: "actual" | "projected" }`.
- `src/components/nav.tsx` — add "Mensuel" link with `Calendar` icon.

→ **9 files** (7 new, 2 edited). Over the 5-file cap. Justified: this is a new feature page with its own data layer, schema, and form; the foundation built in qs-01 covers the boilerplate (form primitives, query provider, action context).

## Test Plan

- **Unit**: `derive-monthly.ts` — given default `hypotheses`, asserts that `projectMonth(h, 2026, 5)` and `projectMonth(h, 2027, 1)` return the same numbers as the hardcoded `monthlyData` seed (within ±5 €).
- **Unit**: zod schema rejects `monthNum=13`, negative values, non-integer year.
- **Type-check**: `npx tsc --noEmit` passes.
- **Manual #1**: log in → `/dashboard/mensuel` → 60 rows displayed, all marked `—` for actual.
- **Manual #2**: click "Saisir" on May 2026 → dialog opens pre-filled with projection → change `dépenses` from 2490 to 2800 → submit → table refreshes, May 2026 row now shows `réel = 1700` (or whatever) with red `écart = −310`.
- **Manual #3**: click "Modifier" on the same row → dialog pre-fills with actuals → "Effacer" → confirm → row reverts to `—`.
- **Manual #4**: open Supabase Studio, verify rows appear/disappear with correct `user_id`.
- **Manual #5**: open `/dashboard/mensuel` in tab A and tab B, edit in B, refocus A — the list should refetch on focus (TanStack Query default) or after manual refresh; verify the cache invalidation actually fires.

## Open Questions (resolve before in-progress)

1. **Dialog vs inline edit?** Default to **shadcn `Dialog`** (already in `components/ui/dialog.tsx`). Inline editing on a 60-row table is too noisy. OK?
2. **Pagination?** 60 rows fits one page. No pagination; group by year with `<Separator>` between Apr / May year boundaries (the fiscal-year split you used before).
3. **Capital column?** Out of scope. `epargne_cumul` and `capital_total` are derived chains across months and belong in qs-04 (placements/holdings) or a follow-up. qs-02 only edits per-month line items.
4. **Should saving a month's actuals also recompute the chained `epargne_cumul`/`capital_total` for that month and all subsequent ones?** Out of scope for qs-02. We store the 6 line items only and leave the cumul/capital math for the chart layer to recompute on read. **Confirm.**
5. **`getMonthlyEntries` action** is technically a read; per qs-01 carry-over rule, reads from RSC use direct Supabase. But for the **client-side reactive list** (TanStack Query refetch on mutation), we need an action callable from the client. → Two paths to the same data: (a) RSC initial load via `data/monthly.ts`, (b) client refetch via `actions/monthly.ts` `getMonthlyEntries`. The action carries no `tags` (it's a read), but is registered in `monthlyKeys.list` so mutations can invalidate it. **Confirm this dual-path approach** instead of going all-client.

## Result

**Final file count: 9** (matches estimate). 7 new, 2 edited.

**Gotcha discovered (carry-over for qs-03/04 — IMPORTANT)**

`action.tags` set by `defineAction` is a property attached to the function via `Object.defineProperty`. When the action is exported from a `"use server"` file, Next.js wraps it for client-side RPC, and **the `tags` property does not survive the wrapping**. Client-side, `action.tags === undefined` → `useActionMutation` does not invalidate any query keys → the list does not refresh after submit (user has to manually reload).

**Workaround (NOT enough on its own)**: pass `invalidateWithTags` explicitly to `useActionMutation`. But that alone did not actually trigger refetches in our setup (likely tag-registry path drops somewhere across the `"use server"` boundary). What works reliably is to ALSO use `useQueryClient` and explicitly invalidate + refetch:

```ts
const queryClient = useQueryClient();

const handleSuccess = async () => {
  await queryClient.invalidateQueries({ queryKey: monthlyKeys.list() });
  await queryClient.refetchQueries({ queryKey: monthlyKeys.list() });
  onDone();
};

const saveMutation = useActionMutation(saveMonthlyEntry, {
  invalidateWithTags: [monthlyTags.list()],
  onSuccess: handleSuccess,
});
```

**Rule for qs-03/04**: every `useActionMutation` that should refresh a `useActionQuery` MUST do BOTH `invalidateWithTags` AND a manual `queryClient.invalidateQueries + refetchQueries` for the relevant key. Belt-and-suspenders.

Retroactively applied to qs-01's `hypotheses-form.tsx` (it had been masked by `window.location.href`).

**Tests run**

- `npx tsc --noEmit` — clean
- `npx eslint <my files>` — clean (one fix during impl: replaced render-time mutable `lastYear` variable with index-based comparison `merged[i-1]?.year`)
- Manual smoke: edited mai 2026 → écart visible, KPI cumul update, list re-renders without page reload. Effacer → row reverts to projection.
