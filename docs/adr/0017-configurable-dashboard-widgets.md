# Configurable dashboard widgets — drag-reorder + show/hide with server-side layout

**Date:** 2026-06-04
**Status:** accepted
**Decided by:** Alex (story 7-2 design gate — explicit scope expansion over the epic-7 fixed-order Cap page)

## Context

The epic-7 scope for story 7-2 was a **fixed-order** Cap page (HeroBlock → nav → composition → recent activity), with PRD U1 ("answer 'am I on track?' in under five seconds") guaranteed by that order honouring FR-41 (total wealth → compass % → next-milestone delta). During the `aped-story` design gate, Alex expanded the scope to a **configurable widget system**: the user can drag-reorder and show/hide every widget, with the layout persisted **server-side per user** (cross-device). The expansion was kept inside the single 7-2 story (an XL deliberately wider than the L epic estimate).

This trades the U1 guarantee for customisation flexibility, introduces a drag-and-drop dependency on a Lighthouse-gated route (NFR-3 ≥ 90), and adds a new persistence surface — all of which need an explicit decision record.

## Decision

1. **Widgets are fully configurable.** Every widget — including the FR-41 trio (hero / compass / next-milestone) — can be moved or hidden. AC-1 (the FR-41 order) is guaranteed on the **DEFAULT layout only**; customisation is opt-in.
2. **U1 tradeoff.** The 5-second "am I on track?" guarantee holds for users on the default layout. A user who reorders/hides the FR-41 widgets weakens U1 for themselves — an accepted, documented tradeoff. A "Réinitialiser" control restores the default at any time.
3. **Drag library = `@dnd-kit/core` + `@dnd-kit/sortable`, lazy-loaded.** dnd-kit is imported **only** through a `dynamic(() => import(...), { ssr: false })` boundary in the edit layer, so it never enters the default route bundle (AC-3 / NFR-3). Web-only; React Native reorder is deferred to story 10-2. Keyboard-accessible (KeyboardSensor + sortableKeyboardCoordinates).
4. **Layout persistence is server-side.** A new `dashboard_layout` table (one JSONB row per user, `userId` PK, RLS SELECT/INSERT/UPDATE scoped to `auth.uid()`) owned by the dashboard module via its own repository + service. Exposed through `dashboard.getLayout` / `dashboard.saveLayout` oRPC procedures. Chosen over localStorage for cross-device sync.
5. **Graceful reconciliation (AC-6).** The stored layout is merged against a web-side widget registry: unknown ids are dropped, registry ids missing from the stored layout are appended at the end, and a malformed/absent layout degrades to the default — the view never throws. The service re-parses the column through `dashboardLayoutSchema` on read (defence in depth).
6. **Shared sections.** Composition + Recent-activity are shared components wired into both the Cap (configurable card) and Patrimoine (flat) views. `recentActivity` is added to the 7-1 dashboard overview DTO (server-resolved account label + logo + direction), not a separate web read.

## Consequences

- **U1 is conditional.** PRD U1 is honoured for the default layout; the product accepts that a customised layout can bury the FR-41 trio. AC-1 tests the default order; AC-4/AC-5 test reorder/visibility persistence.
- **New persistence surface.** `dashboard_layout` is a per-user mutable table (the dashboard's first table — story 7-1 was pure composition). RLS + the `pekulo/no-prisma-query-without-user-id` lint guard apply. The migration SQL was hand-authored (RLS appended manually, mirroring `compass_history`) and applied via `migrate deploy` rather than `migrate dev` (the shared Supabase pooler hangs on `migrate dev`).
- **7-1 re-touched.** The done 7-1 aggregator + `dashboardOverviewSchema` gained `recentActivity`; the architecture driver line and this ADR record it.
- **Bundle discipline is now load-bearing.** AC-3 depends on dnd-kit staying behind the dynamic boundary; a future direct import of `@dnd-kit/*` outside `widget-edit-layer.tsx` would regress NFR-3. The `widget-grid` test asserts the edit layer is not mounted on the default path.
- **`nextMilestone` is folded into the hero by default** (the hero shows the next-milestone line), so it ships `defaultVisible: false` — the default viewport is hero (wealth + delta) + compass (%). It remains a real, opt-in widget.
