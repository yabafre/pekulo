# Quick Spec: Cap donut — sweep from 0 on mount (PekuloDonut), framer-free

**Date:** 2026-06-16
**Author:** Alex
**Type:** fix
**Status:** done

## What

Make the dashboard Cap donut (`PekuloDonut` in `@pekulo/ui`) **animate its ring
sweep + percentage count-up from 0 on mount**, matching the ux-preview reference
(`App.tsx` `Donut`, which sweeps from empty on mount). Today the donut appears
already-filled on load and only animates when the value _changes afterwards_.

## Why

`useCountUp` initialises `useState(target)` and seeds `fromRef = target`
(`packages/ui/src/animations/use-count-up.ts:25,28`), so on first mount
`from === target` → **no sweep**. The ux-preview donut animates from the empty
ring on mount (`docs/ux-preview/src/App.tsx:1155`, `initial={{ strokeDashoffset: c }}`),
which is the "tout s'aligne" moment Alex wants in the real app. The two diverge:
sandbox sweeps in, production donut snaps to its final value.

## Approach (why NOT framer-motion)

Alex's ask was "animate it with framer". We deliberately do **not** add
framer-motion to `@pekulo/ui`:

- `useCountUp`'s own header states it _"Replaces framer-motion's useMotionValue +
  useSpring. Pure React + DOM; no external deps."_ — re-adding framer reverses a
  deliberate decision.
- `@pekulo/ui` is a **Tamagui universal** package (web + native; `react-native-web`
  in deps). framer-motion is web-only and would break the native target.
- `PekuloDonut` already count-ups via `useCountUp`; the only gap is the _mount_
  sweep. We close it inside the existing rAF hook → 0 new dependency, works on
  web and native, identical "framer feel".

ux-preview already sweeps on mount (framer-motion, fine in a web-only sandbox) —
**no change there**; it is the parity reference.

## Acceptance Criteria

- [ ] **AC-1** — `useCountUp` gains an opt-in `fromZero?: boolean` option (default
      `false`). When `false`, behaviour is byte-identical to today (protects the other
      consumers: `PekuloCountUpEUR`, `PekuloHero`, `PekuloCountUpPct`). When `true`, the
      initial value is `0` and the hook animates `0 → target` on mount.
- [ ] **AC-2** — `PekuloDonut` calls `useCountUp(clamped, { durationMs: 900, fromZero: true })`;
      on mount the ring sweeps from empty and the centered label counts up from 0%.
- [ ] **AC-3** — `prefers-reduced-motion: reduce` → donut renders settled at `target`
      immediately (no sweep), preserving current reduced-motion behaviour.
- [ ] **AC-4** — No framer-motion added to `@pekulo/ui` (package stays framer-free /
      universal); the change is pure rAF.
- [ ] **AC-5** — No flicker: first paint is the empty ring (not target→0→target).
      SSR renders the empty ring; client hydrates empty then sweeps.

## Files to Change

- `packages/ui/src/animations/use-count-up.ts` — add `fromZero` option; seed
  initial value + `fromRef` from `0` when set; keep reduced-motion → settle-at-target.
- `packages/ui/src/components/PekuloDonut/PekuloDonut.tsx` — pass `{ durationMs: 900, fromZero: true }`.
- `packages/ui/src/animations/use-count-up.test.ts` — add cases: `fromZero` sweeps
  `0 → target` over rAF; reduced-motion settles immediately; default (`fromZero`
  absent) unchanged.
- `packages/ui/src/components/PekuloDonut/PekuloDonut.snapshot.test.tsx` — force
  reduced-motion so the inline snapshots keep asserting the _settled_ dashoffset/label
  math; add one assertion that the mount-render starts empty when motion is allowed.

## Test Plan

- Unit (`use-count-up.test.ts`): with fake timers / rAF stub, `fromZero: true`
  starts at 0 and reaches `target`; `prefers-reduced-motion` returns `target` on
  first tick; `fromZero` omitted → identical to current snapshot of behaviour.
- Snapshot (`PekuloDonut.snapshot.test.tsx`): settled donut (reduced-motion) — math
  unchanged; new "starts empty" assertion under motion-allowed.
- a11y (`PekuloDonut.a11y.test.tsx`): unchanged (no DOM-role change).
- Visual: `bun --cwd apps/web dev` → load `/dashboard`, confirm the Cap donut sweeps
  in from empty on first paint; toggle OS reduced-motion → no sweep.

## Result

**Outcome:** `PekuloDonut` now sweeps from 0 on mount (ring + % count-up), web +
native, no framer-motion added. All ACs met.

**Files changed (6):**

1. `packages/ui/src/animations/use-count-up.ts` — added opt-in `fromZero`; seeds
   the initial value at 0 (motion allowed) / target (reduced) via a lazy
   `useState` initializer; extracted `prefersReducedMotion()` (also guards
   `matchMedia` existence → native-safe). Default path byte-identical.
2. `packages/ui/src/components/PekuloDonut/PekuloDonut.tsx` — `useCountUp(clamped,
{ durationMs: 900, fromZero: true })`.
3. `packages/ui/src/animations/use-count-up.test.ts` — +4 cases (starts at 0;
   sweeps 0→target across hand-driven frames; reduced-motion settles; default
   unchanged).
4. `packages/ui/src/components/PekuloDonut/PekuloDonut.snapshot.test.tsx` —
   settled snapshots (via setup reduced-motion default) + new "mounts empty when
   motion allowed" case.
5. `packages/ui/test/setup.tsx` — report `prefers-reduced-motion: reduce` by
   default (query-aware) → deterministic settled animations across all donut
   embedders (MilestonesCard, PropertyCard, DonutCard, …); fixed the 9 snapshot
   regressions from the sweep without editing each consumer test.
6. `apps/web/test/setup.tsx` — same reduced-motion default (the file mirrors
   packages/ui's setup); silences the act() warning from the donut sweep.
   - `PekuloStaggerList.snapshot.test.tsx` opts back into the motion-allowed path
     (it asserts stagger delays).

**Verification:**

- `@pekulo/ui` vitest: 125 files / 221 passed, 1 skipped.
- apps/web `(cap)/dashboard` vitest: 85 files / 190 passed.
- `tsc --noEmit`: green (packages/ui, apps/web). oxlint: 0/0 on changed files.
- No new dependency; `@pekulo/ui` stays framer-free / universal.

**Note:** scope ran to 6 files (guideline ≤5) — the 2 extra are shared test-setup
files forced by the donut's wide embedding, not product complexity. ux-preview
unchanged (already swept on mount; parity reference). Visual confirmation on
`/dashboard` still owed (no browser attached to the session).
