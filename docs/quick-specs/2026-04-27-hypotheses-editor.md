# Quick Spec: Hypotheses Editor

**Date:** 2026-04-27
**Author:** Alex
**Type:** feature
**Status:** done

## What

Add a `/dashboard/parametres` page that lets the authenticated user edit the `hypotheses` row (salary, ticket-resto, navigo, fixed costs, lifestyle, travel, credit, ETF perf, salary growth, remote/freelance assumptions). Submitting the form upserts into Supabase and the dashboard recomputes all derived KPIs/budget/revenue from the saved hypotheses on next load — no more hardcoded `lib/data.ts` for these values.

## Why

The `hypotheses` table already exists in Supabase but is never read or written. Today every projection is frozen in `lib/data.ts`. Editing this single row is the fastest path to "the dashboard reflects my real numbers" and unblocks the next 3 quick-specs (monthly actuals, transactions, holdings) which all depend on user-owned hypotheses.

## Acceptance Criteria

- [ ] New route `/dashboard/parametres` renders a single form pre-filled with the current user's `hypotheses` row (or table defaults if no row yet).
- [ ] Form is grouped into 4 sections: Revenus & avantages, Charges & lifestyle, Crédit & matelas, Investissement & remote.
- [ ] Submitting calls a server-side mutation that upserts (`user_id` is the conflict key) into `public.hypotheses` and updates `updated_at`.
- [ ] After save, the user is redirected to `/dashboard` and the page reflects the new values: `kpiData.netReel`, `pouvoirAchat`, `epargneMois`, `budgetData`, `revenueData` are derived from the row, not from `lib/data.ts`.
- [ ] Validation: all numeric fields ≥ 0; ratios (`part_employeur_tr`, `part_employeur_navigo`, `perf_etf_annuelle`, `augmentation_salaire`, `part_etf_monde`, `part_opportunites`) clamped to [0, 1]; `part_etf_monde + part_opportunites` must equal 1 (warning, not block).
- [ ] Unauthenticated request to the page or the mutation returns 401 / redirects to `/auth/login`.
- [ ] Nav (`components/nav.tsx`) gets a "Paramètres" link visible only when authenticated.
- [ ] No regression: dashboard still loads for users with no `hypotheses` row (falls back to schema defaults).

## Stack (validated by user, 2026-04-27)

- **ZapAction** (`@zapaction/core` + `@zapaction/query`) — typed Server Actions with zod input/output + tag-driven invalidation. Owned by yabafre, fits the user's standard.
- **TanStack Query v5** — required peer of ZapAction; mounts a `QueryClientProvider` once at the root.
- **TanStack Form v1** + zod adapter — form state. shadcn/ui field wrappers via the `shadcn-tanstack-form` pattern (no `@hookform/resolvers`, no `react-hook-form`).
- **Zod** — already transitively present in `node_modules`; promote to a direct dep.
- **Next.js 16.2.4** App Router — Server Actions (`"use server"`) + `revalidateTag("hypotheses")` post-mutation.

> ⚠️ Quick-rule violation acknowledged: this introduces 5 new direct deps (`@zapaction/core`, `@zapaction/query`, `@tanstack/react-query`, `@tanstack/react-form`, `zod`). User explicitly authorized in the spec-validation turn. Rationale: these become the **foundation** for qs-02/03/04 — paying the install cost once now is cheaper than re-doing it 4×.

> 📖 Per `AGENTS.md` ("This is NOT the Next.js you know"), we will check `node_modules/next/dist/docs/01-app/` for `revalidateTag` / Server Actions semantics before writing the action, in addition to context7 docs already pulled.

## Files to Change

**New — providers & infra (3)**
- `src/components/providers.tsx` — **edit** (already exists, currently theme only): wrap children in `QueryClientProvider` (browser-singleton via `useState(() => new QueryClient())`) and call `setTagRegistry` once.
- `src/lib/zapaction/keys.ts` — **new**: `createFeatureKeys` + `createFeatureTags` for `hypotheses` (and stubs for `monthly`, `transactions`, `holdings` so qs-02/03/04 plug in trivially).
- `src/lib/zapaction/context.ts` — **new**: `setActionContext` injecting `{ supabase, userId }` from the SSR Supabase client; throws → `unauthorized` if no session.

**New — feature (3)**
- `src/app/dashboard/parametres/page.tsx` — **new**: server component, fetches the row server-side via `await getHypotheses.run()` (or direct supabase call), passes to client form.
- `src/app/dashboard/parametres/_components/hypotheses-form.tsx` — **new**: `"use client"`, uses `useForm` (TanStack Form) + zod validators + `useActionMutation(saveHypotheses)`. Four collapsible sections (shadcn `Card` + `Separator`).
- `src/lib/actions/hypotheses.ts` — **new**: `defineAction` for `saveHypotheses` (upsert) and `getHypotheses` (read). Tagged `["hypotheses"]`. Calls `revalidateTag("hypotheses")` from inside the handler post-write.

**New — derivation (1)**
- `src/lib/derive.ts` — **new**: pure functions `deriveKpis`, `deriveBudget`, `deriveRevenue` from a `Hypotheses` row. Single source of truth.

**Edited (4)**
- `src/lib/types.ts` — **edit**: add `Hypotheses` interface + `defaultHypotheses` constant.
- `src/app/api/dashboard/route.ts` — **edit**: load hypotheses → `derive.ts` → return derived `kpi/budget/revenue`.
- `src/app/dashboard/page.tsx` — **edit** (added during impl, not in original list): server component now `async`, calls `getHypotheses()` server-side and derives KPIs/budget/revenue. Required so the dashboard reflects the saved row without going through the API route.
- `src/components/nav.tsx` — **edit**: add "Paramètres" link (styled `<Link>`, no `asChild` since shadcn `Button` here doesn't expose it).

**New — schema (1, added during impl)**
- `src/lib/schemas/hypotheses.ts` — **new**: zod schema. Split out of `actions/hypotheses.ts` because a `"use server"` file may only export async functions; non-function exports like a zod schema throw at build time. Imported by both the action and the form.

**New — shadcn × TanStack Form (2, added in revision)**
- `src/hooks/form-hook.ts` — **new**: `useAppForm` via `createFormHook` + `createFormHookContexts` from `@tanstack/react-form`. Provides field/form context so shadcn primitives can read state.
- `src/components/ui/form.tsx` — **new**: shadcn-style `Form` / `Field` / `FieldLabel` / `FieldControl` / `FieldDescription` / `FieldError` adapted to TanStack Form (felipestanzani pattern). Errors come from `useStore(field.store, …)` — uses TanStack store subscription so error UI re-renders on validation.

**Config (1)**
- `package.json` — **edit**: 5 new deps (`@zapaction/core@0.2.2`, `@zapaction/query@0.2.2`, `@tanstack/react-query@5.100.5`, `@tanstack/react-form@1.29.1`, `zod@4.3.6`).

→ **13 files** (8 new, 5 edited). Over the 5-file quick cap. User authorized. The two extras vs the original 11-file estimate are: `schemas/hypotheses.ts` (forced by `"use server"` export rules — non-obvious gotcha) and `dashboard/page.tsx` (forced because the dashboard reads hardcoded values directly, not via the API route).

## Test Plan

- **Unit (vitest if present, else simple node test)**: `derive.ts` — given a known `Hypotheses` row, asserts expected `kpi.pouvoirAchat`, `kpi.epargneMois`, `budget` totals, `revenue` lines.
- **Unit**: zod schema in `actions/hypotheses.ts` rejects negative salary, ratio > 1.
- **Type-check**: `pnpm tsc --noEmit` (or npm) passes.
- **Manual #1**: log in → `/dashboard/parametres` → change `loyer` 1125 → 1300 → submit → toast/redirect → `/dashboard` shows new `epargneMois`, `budget.charges_fixes` reflects 1300.
- **Manual #2**: log in as a fresh user (no `hypotheses` row) → page renders with schema defaults → save creates the row → row visible in Supabase Studio.
- **Manual #3**: hit `/dashboard/parametres` while logged out → redirect to `/auth/login` (handled by `setActionContext` throwing + middleware).
- **Manual #4**: cache invalidation — open `/dashboard` in tab A, edit hypotheses in tab B, return to tab A → on focus, `useActionQuery` for `kpi` refetches via tag invalidation (only if we wire dashboard to `useActionQuery`; otherwise a hard reload is fine for qs-01 and we polish in qs-02).

## Resolved Decisions

1. ✅ **Server actions via ZapAction `defineAction`** (not raw `"use server"` functions), with `revalidateTag` from inside the handler.
2. ✅ **TanStack Form + zod**, no `react-hook-form`. shadcn integration follows `/felipestanzani/shadcn-tanstack-form`.
3. ✅ **TanStack Query** mounted at root via `providers.tsx`.
4. ✅ **Recompute trigger**: `revalidateTag("hypotheses")` + ZapAction's `useActionMutation` automatic query-key invalidation.
5. ✅ **AGENTS.md compliance**: confirmed `node_modules/next/dist/docs/01-app/` for `revalidateTag` (2-arg signature now required) + Server Actions; ZapAction's `revalidateTags` already handles the 2-arg form via runtime introspection.

## Implementation Gotchas (recorded for qs-02/03/04)

- **Read actions must NOT carry `tags`.** ZapAction calls `revalidateTags` after every action handler; if a read action has tags and is awaited from a server component during render, Next.js 16 throws "revalidateTag used during render which is unsupported." → Tags belong on mutations only. Reads use TanStack Query's `useActionQuery` with explicit `queryKey` for client-side caching; server-side reads from RSC don't need any cache primitive.
- **`revalidateTag` ≠ enough for RSC reads.** When a server component calls `await someAction()` to read Supabase, there is no `cacheTag` and no `fetch` cache, so `revalidateTag` invalidates nothing. Mutations that need the dashboard to refresh **must** call `revalidatePath('/dashboard')` directly. Pattern: ZapAction's automatic `revalidateTag` for client-side TanStack Query invalidation, **plus** explicit `revalidatePath` inside the handler for RSC re-render.
- **Order in `useActionMutation.onSuccess`**: `router.refresh()` first (invalidates router cache), then `router.push(target)` — otherwise navigate fires before refresh and you land on a stale RSC payload.
- **`"use server"` files may only export async functions.** Zod schemas, type aliases, helper objects must live elsewhere. Pattern adopted: `src/lib/schemas/<feature>.ts` for shared zod schemas.
- **shadcn `Button` here does not support `asChild`** (it wraps `@base-ui/react/button`, not Radix Slot). To make a Link look like a Button, apply `cn(buttonVariants({...}), extraClasses)` directly to the `<Link>`.
- **TanStack Form `<Field children=...>` triggers `react/no-children-prop` lint.** Use the JSX-nested form: `<form.Field name="x">{(field) => ...}</form.Field>`. Same for `form.Subscribe`.
- **shadcn × TanStack Form integration**: shadcn's official `Form` is RHF-only. Build the bridge manually: `createFormHook` + `createFormHookContexts` for `useAppForm`, then a `Field*` family that wraps a local id-context (for `htmlFor`/`aria-describedby`) and reads field state from `useFieldContext()` (TanStack). Errors must subscribe via `useStore(field.store, s => s.meta.errors)` to re-render on validation.

## Result

**Final file count: 14** (vs 11 estimated, vs 5 quick-cap). 9 new, 5 edited.

**New files**
- `src/lib/zapaction/keys.ts`, `src/lib/zapaction/context.ts` — feature keys/tags + auth-gated action context
- `src/lib/schemas/hypotheses.ts` — zod schema (split from action file)
- `src/lib/derive.ts` — pure derivation functions (`deriveAvantages`, `deriveKpis`, `deriveBudget`, `deriveRevenue`, `deriveDepensesTotales`)
- `src/lib/data/hypotheses.ts` — server-only direct Supabase read (replaces using ZapAction action from RSC)
- `src/lib/actions/hypotheses.ts` — `getHypotheses` + `saveHypotheses` defineAction (used for client-side mutations only)
- `src/hooks/form-hook.ts` — `useAppForm` via `createFormHook`
- `src/components/ui/form.tsx` — shadcn × TanStack Form primitives (`Field`, `FieldLabel`, `FieldControl`, `FieldDescription`, `FieldError`)
- `src/app/dashboard/parametres/page.tsx` — server component
- `src/app/dashboard/parametres/_components/hypotheses-form.tsx` — client form

**Edited files**
- `src/lib/types.ts` — `Hypotheses` interface + `defaultHypotheses` const
- `src/components/providers.tsx` — `QueryClientProvider` + tag-registry side-effect import
- `src/components/nav.tsx` — `Paramètres` link styled via `buttonVariants`
- `src/components/detail-cards.tsx` — accepts `hypotheses` prop, computes avantages/charges/lifestyle/restes from it (was hardcoded literals, the actual root cause of the "frozen dashboard")
- `src/app/dashboard/page.tsx` — async, `force-dynamic`, calls `readHypotheses` and derives KPI/budget/revenue
- `src/app/api/dashboard/route.ts` — same wiring on the API path
- `package.json` — 5 deps

**Tests run**
- `npx tsc --noEmit` — clean
- `npx eslint <my files>` — clean (pre-existing project warnings untouched)
- Manual smoke: edited `loyer 1125 → 750`, `voyageMois 600 → 700` in form → saved → BDD updated (verified via the form's pre-fill on next visit) → dashboard reflected new values across all blocks (KPI, charts, DetailCards).

**Root cause (documented for future)**
The "dashboard frozen" symptom was **not** a cache or revalidation issue — `readHypotheses` was returning fresh data from the start. The bug was in `components/detail-cards.tsx` which had every value as a JSX literal (`formatEuro(3700)`, `formatEuro(1125)`, etc.) and ignored every prop. Changing only that one component fixed the visible regression. The wider refactor (`force-dynamic`, hard nav via `window.location`) was over-correction during diagnosis and can be relaxed in qs-02 if needed — leaving them for now since they don't hurt.

**Carry-over decisions for qs-02/03/04**
- Reads from RSC: use a `lib/data/<feature>.ts` direct-Supabase helper, NOT a ZapAction `defineAction`. Actions are reserved for client-side mutations.
- Forms: standardize on `useAppForm` from `hooks/form-hook.ts` + the shadcn-style primitives in `components/ui/form.tsx`.
- Tags only on mutations.
- Always ship a fresh `revalidatePath` in mutation handlers for the pages that consume the touched data.
