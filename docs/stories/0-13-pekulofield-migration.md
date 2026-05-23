# Story: 0-13-pekulofield-migration — Retroactive doc for PekuloField family + DS layer landing

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** done
**Ticket:** none (retroactive — work shipped under [#26](https://github.com/yabafre/pekulo/issues/26))
**Branch:** none (work shipped in PR [#89](https://github.com/yabafre/pekulo/pull/89), squash commit `a303e4a` on main)
**Commit prefix:** n/a (retroactive)
**Closes:** n/a

---

## Why this story exists (retroactive context)

This file documents — after the fact — a significant DS layer migration that landed under story **4-3-realestate-ui** (PR #89, merged 2026-05-23). The DS work should have ridden under its own story but was discovered mid-implementation when story 4-3 needed shadcn-parity form primitives that 0-10 had not yet shipped. Rather than block 4-3, the DS layer landed inside the same branch.

Recording this story separately gives future devs / reviewers a single keyword search (`0-13` / `PekuloField`) to find why a sprawling set of DS primitives appeared in the May-23 squash without their own PR. It also closes the audit gap flagged in `docs/stories/4-3-realestate-ui.md` § "Post-implementation drift addressed via aped-review (2026-05-22)".

---

## What shipped (squashed into `a303e4a`)

### New `packages/ui/src/primitives/` files (~22)

- `PekuloBreadcrumb` family (`Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`)
- `PekuloButton` + `PekuloButtonGroup` + `PekuloButtonGroupSeparator` + `PekuloButtonGroupText` (shadcn parity: 6 variants × 4 sizes + 4 icon sizes)
- `PekuloCalendar` (react-day-picker v10 wrapper with Pekulo theme CSS + structural layout overrides)
- `PekuloCard` family (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`) — shadcn parity with size context + grid header + footer-presence pb drop
- `PekuloDatePicker` (single + range modes; rdp v10 `min={1}` + `resetOnSelect={true}` defaults)
- `PekuloDrawer` (Vaul-based bottom sheet for mobile)
- `PekuloEmpty` family (`Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription`, `EmptyContent`)
- `PekuloField` family (`Field`, `FieldContent`, `FieldDescription`, `FieldError`, `FieldGroup`, `FieldLabel`, `FieldLegend`, `FieldSeparator`, `FieldSet`, `FieldTitle`) — replaces legacy `form-primitives.tsx`
- `PekuloLabel` (semantic `<label>` with `htmlFor` association)
- `PekuloLoadingItem` (skeleton row for list loading states)
- `PekuloResizable` (split-pane primitive)
- `PekuloSelect` (shadcn-style compound select on Tamagui Select backend)
- `PekuloSpinner` (CSS keyframes spinner)
- `PekuloSubmitButton` (form-submission pill specialisation of PekuloButton)

Plus tweaks to: `PekuloInput` (added `type="password"` + `type="date"` discipline), `PekuloNativeSelect` (chevron affordance), `PekuloPopover` (Trigger flex-row defaults — later extended in `a303e4a` with `allowFlip` + `stayInFrame` + outline border), `PekuloProgress`, `PekuloTextarea`.

Each new primitive ships with an `.a11y.test.tsx` covering axe-clean rendering across its variants. Total: ~17 new test files added (193 tests total for `@pekulo/ui` post-merge, vs ~120 pre-4-3).

### Form migrations (8 sibling consumers)

Every form-consuming surface migrated from the legacy `apps/web/src/app/(cap)/_components/form-primitives.tsx` + `submit-pill.module.css` (deleted in commit `90b4ed1`) to the new `PekuloField*` family + `PekuloSubmitButton`:

- `apps/web/src/app/(cap)/dashboard/_components/add-milestone-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-balance-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/account-edit-form.tsx`
- `apps/web/src/app/(cap)/dashboard/parametres/_components/compass-edit-form.tsx`
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-close-confirm.tsx`
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-create-form.tsx`
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/lot-form.tsx`

### Showcase route

- `apps/web/src/app/dev/primitives/page.tsx` — DEV-ONLY kitchen-sink showcase rendering every primitive with all states (default, hover, focus, disabled, invalid, loading). Drives manual visual verification. Will be removed before V1 ship.

### Tamagui dependency bump

- `tamagui@2.0.0-rc.41 → @2.0.0-rc.42` (PekuloPopover.Trigger fix for `unstyled` prop leak).

---

## Decisions inherited from this migration

These are codified in `docs/epics-context/epic-0-context.md` for downstream story consumers:

- **PekuloField is the SSOT for form composition.** No new form-input component MAY be defined route-locally — every form uses `<PekuloField>` + `<PekuloFieldLabel>` + `<PekuloFieldDescription>` + `<PekuloFieldError>`. Legacy `form-primitives.tsx` is deleted; any future re-introduction is a review fail.
- **PekuloButton variants are exhaustive at V1.** 6 variants (`default`, `outline`, `secondary`, `ghost`, `destructive`, `link`) × 4 sizes (`xs`, `sm`, `default`, `lg`) + 4 icon sizes. Adding a 7th variant requires an explicit DS decision in `docs/architecture.md`.
- **PekuloDatePicker range mode MUST pass `min={1}` + `resetOnSelect={true}` to PekuloCalendar.** Both react-day-picker v10 defaults are footguns (see `docs/lessons.md` 2026-05-23 entry). The wrapper bakes them in.
- **PekuloCard is shadcn-parity, not Section-replacement.** Section (the legacy primitive) stays for "header bar with action slot + body" pattern; PekuloCard is compositional for richer cards (settings, list containers, multi-row dashboards). The two coexist — no migration story planned.
- **PekuloPopover defaults to `allowFlip + stayInFrame + offset=6`.** Every consumer (DatePicker, kebab menus, future dropdowns) inherits collision detection without per-call-site config.

---

## Why this didn't get its own ticket / PR at the time

The DS work was discovered need-by-need during 4-3 implementation:

1. T6-T11 (immobilier forms) needed `PekuloField*` because the legacy `form-primitives.tsx` was visibly worse than shadcn's pattern.
2. T9 (`valuation-update-form`) needed `PekuloDatePicker` because `type="date"` inputs were banned mid-story (no fr-FR locale, broken styling).
3. T12 (`property-card`) needed `PekuloCard` for the kebab-action-row pattern.
4. Sibling forms (`parametres/_components/account-*`, `portefeuille/_components/holding-*`) needed migrating because `form-primitives.tsx` was deleted to keep the import surface clean — `git grep "form-primitives"` had to return zero matches.

Branching out at each discovery would have meant 4-3 blocking on 4-5 separate DS PRs. The pragmatic call was to land everything together. The cost is paid here, in this retroactive doc.

---

## Quality gate (re-captured from PR #89 final state, 2026-05-24)

- `bun run lint` (whole repo) → 0 warnings / 0 errors / 600 files
- `bun run format:check` → 747 files clean
- `bun run typecheck` (turbo) → 8/8 packages exit 0
- `bun --filter='@pekulo/ui' run test` → 119 files / 193 pass / 1 skipped
- PR #89 merged to main: squash commit `a303e4a` at 2026-05-23T22:45:53Z

---

## File List (informational — full diff in `a303e4a`)

- ~22 `packages/ui/src/primitives/Pekulo*.tsx` NEW
- ~17 `packages/ui/src/primitives/Pekulo*.{a11y,snapshot}.test.tsx` NEW
- 8 `apps/web/src/app/(cap)/dashboard/**/_components/*-form.tsx` MODIFIED (migrated to PekuloField)
- 1 `apps/web/src/app/dev/primitives/page.tsx` NEW (DEV-ONLY showcase)
- `apps/web/src/app/(cap)/_components/form-primitives.tsx` DELETED
- `apps/web/src/app/(cap)/_components/submit-pill.module.css` DELETED
- `packages/ui/package.json` MODIFIED (tamagui rc.41 → rc.42, +react-day-picker, +vaul)
- `apps/web/package.json` MODIFIED (rename `web` → `@pekulo/web`)
- `bun.lock` regenerated

---

## Review Record

**Status:** done (no separate review — work was reviewed inline during `aped-review` of 4-3, see `docs/stories/4-3-realestate-ui.md` § Post-finalize patch log).

This story is documentation-only. No code changes ship under `0-13` — every artefact already landed on `main` via commit `a303e4a`.
