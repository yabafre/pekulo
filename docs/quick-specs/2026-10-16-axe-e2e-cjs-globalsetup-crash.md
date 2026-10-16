# Quick Spec: Unblock PR #145 CI — axe-a11y global-setup crash, listMonthly time-bomb, dashboard contrast violation

**Date:** 2026-10-16
**Author:** Alex
**Type:** fix
**Status:** done

## What

Two independent CI blockers on PR #145 (run [38945481675](https://github.com/yabafre/pekulo/actions/runs/38945481675)):

1. **`axe-a11y` job.** `apps/web/e2e/global-setup.ts` derives `STORAGE_STATE_PATH` from `import.meta.url`. Because `apps/web/package.json` has no `"type": "module"`, Playwright transpiles the file to CJS and Node throws `SyntaxError: Cannot use 'import.meta' outside a module` at module load — the job dies before any test runs. Replace the `import.meta` derivation with a path computed from Playwright's resolved config file (`FullConfig.configFile` / `TestInfo.config.configFile`), which works regardless of the module format Playwright picks.
2. **`test-unit` job.** `listMonthly` (apps/api/src/modules/monthly/monthly.service.ts) ignores the factory clock seam `deps.clock` that `signOff` honours — it falls straight through to wall clock. The integration suite pins the factory clock to 2026-05-29, so the sliding 6-month window followed the real calendar and dropped April 2026 out of the fixture range on 2026-10-01 (time-bomb; fails identically on `main`, untouched by this branch). Thread the factory clock into the window walk (`currentMonthUTC(deps.clock?.() ?? new Date())`) and pin the contract with a unit test.
3. **`axe-a11y` job, second layer (found after push #1 — run [38948575149](https://github.com/yabafre/pekulo/actions/runs/38948575149)).** With the load crash fixed, `seedPortfolioDemoRows` died on `await import("bun")`: Playwright's runner executes `global-setup.ts` under Node (both locally and in CI — `bun run` spawns the `playwright` bin via its `#!/usr/bin/env node` shebang), where the `bun` package is unresolvable. Trying `bun --bun playwright test` to force the Bun runtime was disproven locally on both bun 1.3.11 and 1.3.13 (CI's version): Playwright's loader throws `AggregateError: 2 errors building global-setup.ts`. Replace Bun.sql with a `pg` client over `DATABASE_URL` — `pg` + `@types/pg` are mirrored into `apps/web` devDependencies at the exact versions already locked for `apps/api` (zero new packages in `bun.lock`).
4. **`axe-a11y` job, third layer (found after push #2 — run [38951462025](https://github.com/yabafre/pekulo/actions/runs/38951462025)).** With the harness fixed the suite finally runs end-to-end: 19/22 passed, and the 3 failures are one real violation — `PlaceholderCard`'s "Bientôt · {story}" footer was styled with `colorMuted`, which story 11-4's AC-3 SSOT defines as decorative-only (dark ≈2.34:1, light ≈2.42:1 — the contrast suite floors it at 2.4:1, not 4.5:1). In-browser axe flags it `color-contrast` (serious) on `/dashboard` in all 3 profiles. The footer is content text: switch it to `$colorTertiary` — the same body-text role the placeholder's own legend labels already use.

## Why

Story 11-4 (ticket #51) anchors AC-1/AC-5 on the axe job; the PR cannot go green — and the WCAG gate cannot guard anything — while global-setup crashes at load. The monthly failure is a pre-existing latent bug surfaced by the calendar; the PR's `test-unit` gate stays red without it. Both reproduced locally with Node v22.22.0: identical `SyntaxError` / window drift.

## Acceptance Criteria

- [x] `bun --filter=@pekulo/web run test:e2e:axe` no longer throws `SyntaxError: Cannot use 'import.meta' outside a module`; globalSetup loads and proceeds past module init.
- [x] `resolveStorageStatePath()` resolves to `apps/web/e2e/.auth/user.json` when called with the config-file path, in both global-setup and spec contexts.
- [x] No `import.meta` remains anywhere under `apps/web/e2e/`.
- [x] `listMonthly` honours `deps.clock` when no per-call clock is given (new unit test, RED before the fix).
- [x] All three `apps/api/src/modules/monthly/` test files pass with no wall-clock pinning (33/33).
- [x] `seedPortfolioDemoRows` runs under Node via `pg` (no `import("bun")`); demo account + 3 holdings verified in the disposable Postgres after a local run.
- [x] `PlaceholderCard` footer renders with a body-text role (`$colorTertiary` — ≥4.5:1 on every surface per the AC-3 contrast suite); no informational text on the 7 gated routes uses decorative `$colorMuted`.
- [x] `bun --filter=@pekulo/web run typecheck` + root `bun run typecheck` exit 0.

## Files to Change

- `apps/web/e2e/global-setup.ts` — remove `fileURLToPath`/`import.meta`; export `resolveStorageStatePath(configFile?: string)`; call it in `globalSetup` with `config.configFile`.
- `apps/web/e2e/axe-routes.spec.ts` — replace the `STORAGE_STATE_PATH` import with `resolveStorageStatePath(test.info().config.configFile)`.
- `docs/stories/11-4-axe-and-wcag-gates.md` — sync the two "exact content" snippets (T4 global-setup, T5 spec) with the fixed source so the story stays the contract of record.
- `apps/api/src/modules/monthly/monthly.service.ts` — `listMonthly` clock fallback chain + `currentMonthUTC(at?)` refactor.
- `apps/api/src/modules/monthly/monthly.service.test.ts` — new RED→GREEN unit test for the factory-clock fallback.
- `apps/web/e2e/global-setup.ts` — `seedPortfolioDemoRows` on `pg` (`Client` over `E2E_DATABASE_URL`, parameterized inserts) instead of Bun.sql.
- `apps/web/package.json` + `bun.lock` — `pg` / `@types/pg` devDependencies (versions mirrored from `apps/api`).
- `apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx` — footer "Bientôt · {story}" text `$colorMuted` → `$colorTertiary` (the SVG strokes / legend swatches there stay `$colorMuted`: graphics, WCAG-exempt).
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx` — same class of defect: the "kind" micro-label + the quantity×price detail line move from `$colorMuted` to `$colorTertiary` (both are informational text; the adjacent label line already uses tertiary).

## Test Plan

- RED #1 (captured 2026-10-16): `bun --filter=@pekulo/web run test:e2e:axe -- --grep "negative probe"` → `SyntaxError: Cannot use 'import.meta' outside a module`, exit 1.
- GREEN #1: same command — globalSetup loads and fails later on the absent local stack (expected without docker), no SyntaxError. Full-suite verdict deferred to CI (local dev server holds port 3002 / `.next`).
- RED #2: new unit test → received `2026-10 / 2026-9 / 2026-8` (wall clock) vs expected `2026-5 / 2026-4 / 2026-3` (pinned clock).
- GREEN #2: `bun test apps/api/src/modules/monthly/` → 33 pass / 0 fail. CI run 38948575149: `test-unit` green ✓.
- GREEN #3 (local, stack up): `docker compose ... up -d --wait` + `prisma:migrate:deploy`, then `test:e2e:axe -- --grep "negative probe"` with `E2E_WEB_URL` pointing at a closed port → globalSetup runs signup + pg seed, Chromium launches, fails only at `page.goto("/login")` (no local web server; CI boots 3002). Seed verified: `psql` returns the PEA account + 3 holdings rows.
- RED #4 (CI run 38951462025): harness healthy — 19/22 passed; 3 fails, all `color-contrast` (serious) on `/dashboard` × 3 profiles, same selector: `PlaceholderCard` "Bientôt · 7-1" footer (`colorMuted`). String-level math from the SSOT: dark `#4d4d4d` on `#0a0a0a` ≈ 2.34:1, light `#a3a3a3` on `#fafafa` ≈ 2.42:1 — below the 4.5:1 body-text floor. Not reproducible locally (dev server holds port 3002; the prod-parity build runs only on CI).
- GREEN #4: web unit suite + typecheck/format/lint green; verdict deferred to the CI re-run on the follow-up commit.
- Full workspace: `bun --filter='*' run test` exit 0 (api 992 pass, web 395 pass), `.aped/.last-test-exit` = 0; `bun run typecheck` 8/8; `bun run format:check` clean; `bun run lint` exit 0 (5 pre-existing warnings).
- Final verdict: `axe-a11y` + `test-unit` jobs green on PR #145.

## Result

- `apps/web/e2e/global-setup.ts` — `resolveStorageStatePath(configFile?)` replaces the `import.meta` derivation (line 29); `globalSetup(config)` uses `config.configFile`; SQL seeding/`FullConfig` typing unchanged.
- `apps/web/e2e/axe-routes.spec.ts` — storageState now `resolveStorageStatePath(test.info().config.configFile)` (lines 68-70).
- `apps/api/src/modules/monthly/monthly.service.ts:191` — `listMonthly` now `clock?.now ?? currentMonthUTC(deps.clock?.() ?? new Date())`; `currentMonthUTC(at = new Date())` takes an optional Date.
- `apps/api/src/modules/monthly/monthly.service.test.ts` — +1 unit test (factory-clock fallback), 18 tests in file.
- `apps/web/e2e/global-setup.ts` — seed block rewritten on `pg` (`Client` + parameterized INSERT ... ON CONFLICT DO NOTHING); `bun --bun` runtime swap disproven and reverted.
- `apps/web/package.json` + `bun.lock` — `pg ^8.13.1` / `@types/pg ^8.11.10` devDependencies (mirrors of apps/api's lockfile entries).
- `apps/web/src/app/(cap)/dashboard/_components/placeholder-card.tsx` — footer text role `$colorMuted` → `$colorTertiary`.
- `apps/web/src/app/(cap)/dashboard/portefeuille/_components/holding-row.tsx` — "kind" label (:47) + quantity detail (:62) `$colorMuted` → `$colorTertiary` (latent same-pattern usages, not flagged by the run; fixed to honour the SSOT muted-is-decorative contract).
- Story 11-4 snippets resynced (T4/T5 exact-content blocks incl. package.json devDeps).
- Note: the monthly defect belongs to already-done story 5-5 (ticket #31) and would have failed on `main` the same day — CI on main simply had no run since 2026-09-15.
