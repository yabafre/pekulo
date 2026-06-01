# Quick Spec: Numbered pagination for the "Suggestions IA" list (+ PekuloPagination DS)

**Date:** 2026-06-01
**Author:** Alex
**Type:** feature
**Status:** done

## What

Paginate the "Suggestions IA" section 10 per page with **numbered pages** (1·2·3…N + Préc./Suiv. + ellipsis). Add a reusable Tamagui **`PekuloPagination`** component to `@pekulo/ui`, modelled on the shadcn `Pagination` compound API (`Pagination / Content / Item / Link / Previous / Next / Ellipsis`) but built entirely in Tamagui primitives + `$tokens` (shadcn/Tailwind is out-of-stack, ADR-0007). Change `listPendingSuggestions` from "return the whole set" to **offset + count** server pagination.

## Why

`listPendingSuggestions` currently returns the full pending set (pagination was deferred in story 6-4). With the import backfill now populating the `autre`+suggestion backlog (a Bridge user can have hundreds of pending rows), the section renders everything at once — bad UX/perf. The user explicitly chose numbered pages over load-more.

## ⚠️ Scope-check verdict (aped-quick envelope EXCEEDED — recorded honestly)

aped-quick is for ≤ 5 files, no new architectural pattern, no new dependency. This change:

- Touches **~15 files** (new DS component + validators→contract→repo→service→routes + web action/hook/keys/section + tests).
- Adds a **new DS component** (`PekuloPagination`).
- Introduces a **deliberate NFR-16 deviation**: numbered pages with random page-jump require a total count + `skip/take` (offset). NFR-16 mandates keyset/never-offset — but it targets the 50k-row append-only logs (`llm_call_log`, `transactions` feed); the pending-suggestions list is a **small, bounded triage subset** (`category='autre' AND suggestedCategory != null`) that needs random-access numbered pages. The offset is sound here and is recorded so the next `aped-review` treats it as a conscious decision, not a violation.

→ Strictly, this warrants a small **story** (aped-story → aped-dev → aped-review). It is presented at the gate as an extended quick change because it mirrors an already-shipped pattern (Récentes pagination, commit `2a43ef1`) and the user is iterating fast. **The gate decides:** proceed-as-quick vs promote-to-story.

## Acceptance Criteria

- [ ] **AC-1** — `PekuloPagination` (`@pekulo/ui`) renders numbered pages + Préc./Suiv. + ellipsis from `{ page, pageCount, onPageChange }`; controlled; grayscale only (TR-strict, no `$accent`); active page carries `aria-current="page"`; root is `role="navigation"` `aria-label`; all controls are real `<button>`s, keyboard-operable with visible focus; Préc./Suiv. disabled at the bounds. axe clean.
- [ ] **AC-2** — Server `listPendingSuggestions({ page, pageSize })` returns `{ items, totalCount, page, pageSize }`; repo uses `skip/take` + `count()`, scoped `where:{ userId, category:"autre", suggestedCategory:{ not:null } }`, `orderBy (suggestedAt desc, id desc)`; `pageSize` capped (default 10, max 50); `page` clamped ≥ 1.
- [ ] **AC-3** — The section shows 10 rows/page + `PekuloPagination`; changing page refetches that page; when the current page empties after a confirm (last row on the last page), the page index clamps to the new last page (never a blank page past the end).
- [ ] **AC-4** — Gates green: typecheck (types·validators·contracts·api·web·ui) → 0 ; targeted `bun:test` (api) + `vitest` (web·ui) pass ; `oxlint` 0 errors. No Prisma schema/migration change (offset is query-only).

## Files to Change

- `packages/ui/src/components/PekuloPagination/PekuloPagination.tsx` _(new)_ — Tamagui compound + controlled component.
- `packages/ui/src/components/PekuloPagination/index.ts` _(new)_ · `packages/ui/src/components/index.ts` _(export)_.
- `packages/ui/src/components/PekuloPagination/PekuloPagination.a11y.test.tsx` _(new)_.
- `packages/validators/src/transactions/transactions.schemas.ts` — `listPendingSuggestionsInputSchema` + extend output with `totalCount/page/pageSize`.
- `packages/contracts/src/transactions/transactions.contract.ts` — `.input(listPendingSuggestionsInputSchema)`.
- `apps/api/src/modules/transactions/transactions.repository.ts` — `listPendingByUser(userId, { page, pageSize })` → `{ items, totalCount }` (skip/take + count).
- `apps/api/src/modules/transactions/transactions.service.ts` — `listPendingSuggestions(userId, input)`.
- `apps/api/src/modules/transactions/transactions.routes.ts` — pass `input` to the service.
- `apps/web/.../transactions/_actions/transactions-actions.ts` — action takes `{page,pageSize}` (keep `output:`).
- `apps/web/.../transactions/_hooks/use-pending-suggestions.ts` — `usePendingSuggestions(page, pageSize?)`.
- `apps/web/src/lib/zapaction/keys.ts` — `transactionsKeys.pending(page)`.
- `apps/web/.../transactions/_components/transactions-suggestions-section.tsx` — page state + render `PekuloPagination` + clamp-on-empty.
- Tests: repo offset/count, section pagination, + fix the existing `transactions-suggestions-section.envelope.test.tsx` / `use-confirm-categorisation.test.tsx` / hook mocks that assume `{items}`-only output and `pending()`.

## Test Plan

- ui: `PekuloPagination.a11y.test.tsx` — axe clean, `aria-current` on active, buttons, disabled bounds.
- api: repo test asserting `skip=(page-1)*pageSize`, `take=pageSize`, `count()` called with the same `where`.
- web: section test — renders 10 rows + pagination; page change drives the hook input; clamp-on-empty.
- Full targeted gate per AC-4.

## Result

Shipped as an extended quick change (gate choice [A]). All 4 AC met.

- **`PekuloPagination`** (`@pekulo/ui`) — Tamagui, modelled on the shadcn `Pagination` compound (numbered + Préc./Suiv. + ellipsis), controlled `{page,pageCount,onPageChange}`. Grayscale only (active page = `$color`/`$colorOnAccent`, like the confirm pill); real `<button>`s via `styled.button`; root is a `role="navigation"` View (div + role — the repo's semantic convention; `render="nav"` avoided). Page window is a tagged union (stable keys, no array-index key). a11y test green.
- **Server** — `listPendingSuggestions({page,pageSize}) → {items,totalCount,page,pageSize}`; repo `listPendingByUser` uses `skip/take` + `count()` over `where {userId, category:"autre", suggestedCategory:{not:null}}`, `orderBy (suggestedAt desc, id desc)`. **Deliberate NFR-16 deviation** (offset, not keyset) — documented on the schema + here; the pending triage set is small/bounded and numbered pages need random access. No Prisma migration.
- **Web** — action input `{page,pageSize}` (keeps `output:`); `usePendingSuggestions(page,pageSize=10)`; `transactionsKeys.pending(page)`; section holds `page` state, renders `PekuloPagination`, shows `totalCount` in the header, and clamps the page when the current one empties after a confirm.
- **Verification (fresh):** typecheck types·validators·contracts·api·web·ui → all exit 0; `@pekulo/ui` PekuloPagination a11y 3/3; `@pekulo/api` repo+integration 50/0 (offset skip/take/count + `listPendingSuggestions` 401); `@pekulo/web` section envelope 4/4 (incl. AC-3 pagination) + a11y 1/1; `oxlint` 0 errors. Removed a now-unused `z` import in the web action (was only `z.void()`).
- **Files:** PekuloPagination (×3) + ui barrel; validators schema; contract; transactions repository/service/routes (+ repo test); web action/hook/keys/section (+ envelope test). ~14 files (exceeded the strict aped-quick ≤5 envelope, accepted at the gate).
