# Lessons Learned

Patterns from user corrections — so the same mistake isn't made twice.

## Format

- **Date:** YYYY-MM-DD
- **Mistake:** What I did wrong
- **Correction:** What the user told me
- **Rule:** The pattern to apply going forward

## Entries

<!-- Add new entries at the top -->

### 2026-05-04 — `Number(decimal)` silently truncates above MAX_SAFE_INTEGER — coerce Prisma Decimals via `.toNumber()` (Scope: aped-arch, aped-dev — every Prisma → DTO boundary; stories 0-6, 1-2, 2-1, 3-1, 5-1, 7-1, 7-3)

- **Date:** 2026-05-04
- **Mistake:** Story 0-6 (`hypothesis.service.ts`) initially coerced `@db.Decimal` columns via `Number(row.salaireNet ?? defaultHypotheses.salaireNet)`. Postgres `Decimal` columns surface at runtime as `Prisma.Decimal` (decimal.js) instances; `Number(decimalInstance)` calls `.valueOf()` and crosses into IEEE-754. For values ≤ `Number.MAX_SAFE_INTEGER` (2^53 ≈ 9e15) and ≤ ~15 significant digits the result is exact ; outside that envelope precision is silently truncated. Persona Alex's V1 ranges (objectif ≤ 10^7, ratios ≤ 1) sit comfortably within range, so the production bug is dormant — but the test seeded JS numbers in the mock, hiding the Decimal-coercion path entirely.
- **Correction:** Introduced a `decimalToNumber(value, fallback)` helper at the top of `hypothesis.service.ts`: returns the fallback for `null`/`undefined`, passes plain numbers through, and prefers `.toNumber()` on `Prisma.Decimal` instances (explicit, lintable, throws on `Infinity`). Tests now construct fixtures with real `Prisma.Decimal` instances and pin the `Number.MAX_SAFE_INTEGER` boundary to surface a regression instead of accumulating float drift.
- **Rule:** Every Prisma → DTO boundary that touches a `@db.Decimal` column MUST coerce via `.toNumber()` (or a guarded helper), NEVER via `Number(...)`. Tests for these services MUST seed mock returns with real `Prisma.Decimal` instances — JS numbers slip through and hide the production coercion path. The V1 tolerance budget assumes monetary values ≤ `1e7` (Alex personal-use scale); when a feature lands a value that could exceed `Number.MAX_SAFE_INTEGER` (e.g. portfolio totals in cents at scale, projection-curve compounded balances in story 1-2), revisit the coercion strategy — Decimal-as-string at the wire is the next belt loop.

### 2026-05-04 — `AsyncLocalStorage.enterWith` correctness rests on Next.js per-request `ResourceContext` isolation — re-verify on every Next minor bump (Scope: aped-arch, aped-dev — stories 0-6, 0-7, every apps/web feature port; web-tier `apps/web/src/lib/orpc/request-context.ts`)

- **Date:** 2026-05-04
- **Mistake:** Story 0-6 wires the apps/web request context via `requestContextStore.enterWith(ctx)` in `apps/web/src/lib/orpc/request-context.ts`. `enterWith` permanently pins the store entry for the rest of the V8 ResourceContext (no exit). Node's docs explicitly state "prefer `run()` over `enterWith()` unless specific behavior is required" because a leaked ResourceContext leaks the entire request store including the bearer token. The story claim "Next.js wraps each incoming request handler in its own async context" is plausible (Next 13+ uses ALS internally for `headers()`/`cookies()`) but is an empirical claim about Next.js internals — not an API contract.
- **Correction:** Kept `enterWith` (it's the only primitive that propagates from the zapaction resolver into the action handler without wrapping the entire user code in a `run()` callback) and added a 2-parallel-request integration smoke (`hypothesis.integration.test.ts` "isolated stores" case) confirming each request's structured log carries the matching userId. Documented the dependency on Next.js's per-request ResourceContext at the top of `apps/web/src/lib/orpc/request-context.ts`.
- **Rule:** On every Next.js minor bump (or major), re-verify the request-context isolation by running the parallel-request integration smoke against the new runtime. If Next.js ever changes its async-handling pipeline (streaming RSC, Suspense, edge-runtime route handlers) such that two concurrent requests share a single `AsyncResource` root, the bearer token from request A could leak into request B's `RPCLink.headers` thunk. Mitigation if that day arrives: refactor to `requestContextStore.run(ctx, async () => ...)` from a single per-request entry point (e.g. a Next middleware). Until then, the smoke is the canary.

### 2026-05-04 — Bun `--frozen-lockfile` in Docker requires every workspace member's package.json (Scope: aped-arch, aped-story, aped-dev — stories 0-3, 0-8, every apps/\* Dockerfile)

- **Date:** 2026-05-04
- **Mistake:** Story 0-3 T8 Dockerfile (`apps/api/Dockerfile`) copied only `packages/tsconfig` + `apps/api/package.json` before `RUN bun install --frozen-lockfile`. Verified during T10 (Docker build smoke): the build failed at the install step with `error: lockfile had changes, but lockfile is frozen` even though `bun install --frozen-lockfile` succeeded locally with no changes. Root cause: Bun's frozen install reads the root `package.json` `workspaces` glob (`["apps/*", "packages/*"]`) and requires every workspace member's manifest to be present in the install root — otherwise the lockfile (which records all workspaces) is considered out-of-sync with what's reachable. Locally every workspace exists, so it works ; in the Docker context only `apps/api/` was copied. Compounded by `.dockerignore` excluding `apps/web` wholesale, so even adding `COPY apps/web/package.json` to the Dockerfile would have failed silently (file not in context).
- **Correction:** Two changes locked in for every apps/\* Dockerfile in this monorepo:
  1. **Copy every workspace manifest** before `bun install --frozen-lockfile`. For apps/api this means: `COPY apps/api/package.json apps/api/` + `COPY apps/web/package.json apps/web/` + `COPY packages packages` (the entire packages/ tree is ~92 KB, all 7 members copied at once is fine). apps/prices is Python (no package.json) — Bun's glob silently skips it.
  2. **`.dockerignore` exception for foreign workspace manifests** — `apps/web` exclusion stays (we don't want 2 GB of Next.js sources in the apps/api build context), but add `!apps/web/package.json` immediately after to re-include just the manifest. Same pattern for any future apps/\* that aren't the build target.
- **Rule:** When writing a per-app Dockerfile in a Bun workspace monorepo, the install step must be reachable from a workspace-complete view. Default checklist: (a) every member of the workspaces glob has its package.json copied (or stubbed), (b) `.dockerignore` re-includes those manifests via `!path` exceptions when broader excludes are in place, (c) `RUN bun install --frozen-lockfile` is the gate — if it fails with "lockfile had changes", check workspace coverage _before_ assuming the lockfile is wrong. Apply to story 0-8 (CI/CD) when the GitHub Actions job builds the apps/api image, and to every future apps/\* (mobile build, etc.) that ships a Dockerfile.

### 2026-05-04 — Elysia 1.4 `Elysia` type is invariant ; use inference + `AnyElysia` at boundaries (Scope: aped-arch, aped-story, aped-dev — stories 0-3, 0-5, 0-6, 1-1, 2-1, 3-1, 4-1, 5-1, 6-1, 7-1, 7-3, 8-1)

- **Date:** 2026-05-04
- **Mistake:** Story 0-3 (`apps/api` scaffold) annotated module factories' return types as `routes: Elysia` (HealthModule interface) and `healthRoutes(...): Elysia`, plus typed bootstrap utilities as `app: Elysia` (e.g. `registerLifecycle`). Verified during T5 typecheck: Elysia 1.4.4's `Elysia` type has invariant generic parameters (Singleton, Definitions, Metadata, Routes, Ephemeral, Volatile). When a function returns/accepts the bare `Elysia` (defaults), TS narrows to `Elysia<…, {}, …>` (empty Routes generic). The chained `Elysia<…, { health: { get: … } }, …>` produced by `new Elysia().get(…).get(…)` is then rejected with `TS2345 — Argument of type 'Elysia<…, { health: … }, …>' is not assignable to parameter of type 'Elysia<…, {}, …>'`. Runtime is unaffected — purely a TypeScript constraint.
- **Correction:** Two patterns to apply consistently across every domain module factory in epics 0–8:
  1. **Module factories return inferred chains** — drop `: Elysia` return annotations on `healthRoutes`, accountsRoutes, etc. ; let TS infer the rich plugin type. The factory's surrounding object (`HealthModule` interface) should also drop `routes: Elysia` and let inference flow upward (use `function createHealthModule(deps) { … }` with no return type annotation).
  2. **Boundaries that accept any Elysia handle use `AnyElysia`** — `import type { AnyElysia } from "elysia"` and type the parameter as `app: AnyElysia`. Elysia exports `AnyElysia = Elysia<any, any, …, any>` precisely for this case (lifecycle utilities, telemetry instrumentation, request-id middleware, etc.).
- **Rule:** When wrapping Elysia in domain factories or cross-cutting utilities, NEVER type the variable as the bare `Elysia`. Either let TS infer (returns) or use `AnyElysia` (parameters at boundaries that should accept any chain). Apply to every story that adds an Elysia surface — explicit checklist on the dev's pre-implementation pass: `grep -rn ': Elysia\b' apps/api/src` should return only `(deps): Elysia<…>` shapes already constrained, never bare `Elysia`. ADR-0009's module-factory pattern stays intact at the architectural level — the fix lives in the type signatures only.

- **Date:** 2026-05-04
- **Mistake:** Story 0-2 (and the architecture reference at `docs/architecture.md` lines ~617–622) declared that lefthook's pre-commit hook for story 0-11 would invoke `oxlint --fix --staged` and `oxfmt --staged`. Verified during aped-review Kai pass: neither `oxlint@1.62.0` nor `oxfmt@0.47.0` exposes a `--staged` flag. Both accept positional `PATH` arguments only.
- **Correction:** Story 0-11 must use lefthook's variable expansion (`{staged_files}`) and pass file paths as positional arguments — `oxlint --fix {staged_files}` and `oxfmt {staged_files}` — NOT literal `--staged`. Story 0-2's architecture-reference line was patched in the same review pass (commit citing this lesson).
- **Rule:** When forward-pointing CLI flag invocations across stories, verify the flag exists in the pinned binary (`bun x <tool> --help`) before quoting it in a downstream story spec or ADR. Pre-1.0 toolchains in particular drift between schema docs and binary support. Apply this discipline whenever adopting a new CLI tool with planned downstream integrations.

### 2026-05-04 — oxlint rejects `_reason` annotation on rules without options-schema (Scope: aped-dev, aped-story — story 0-2 + 0-12)

- **Date:** 2026-05-04
- **Mistake:** Story 0-2 Task 4 option 2 (line ~497–503) claimed oxlint's schema is permissive on unknown sub-keys, instructing the dev to disable rules via `["off", { "_reason": "<why>" }]` array form for human auditing. Verified during aped-review fix-cycle: oxlint validates rule-option payloads against each rule's own option-schema. Rules without options (e.g. `react/react-in-jsx-scope`, `import/no-unassigned-import`) reject the `{ _reason: ... }` payload with `Rule does not accept configuration options`.
- **Correction:** For rules WITHOUT options-schema, use simple-string severity (`"off"` / `"error"` / `"warn"`) — rationale lives in the commit message and Review Record, not in the JSON. The array-with-\_reason form works ONLY on rules that already accept options (e.g. `react/self-closing-comp` accepts `{ "html": false }`).
- **Rule:** Story 0-12 (`@pekulo/oxlint-config`) should provide a centralized rule-rationale mechanism (e.g. comments in a `.cjs` config, or a sidecar `oxlint-rationale.md` keyed by rule name) instead of inlining `_reason` keys. Update story 0-2 Task 4 option 2 wording in any future story-template tweak. Apply this pattern check whenever a config schema is described as "permissive on unknown keys" — verify by attempting a no-op key on a strictly-typed sub-schema first.

### 2026-05-04 — oxlint `settings.react.version` requires SemVer string, no `"detect"` (Scope: aped-dev — story 0-12)

- **Date:** 2026-05-04
- **Mistake:** Reviewer assumed `settings.react.version` accepts `"detect"` (mirroring eslint-plugin-react). Verified: oxlint's schema constrains the value with regex `^[1-9]\d*(\.(0|[1-9]\d*))?(\.(0|[1-9]\d*))?$` (SemVer-only). Setting `"detect"` fails at config-parse time.
- **Correction:** Hard-code the React version in `.oxlintrc.json` and update it in lockstep with `apps/web/package.json` on every React bump. Centralize via `@pekulo/oxlint-config` in story 0-12.
- **Rule:** Don't assume eslint plugin behaviour carries over to oxlint's native Rust port — the schema is stricter. Verify via `node_modules/oxlint/configuration_schema.json` (or the pinned binary's `--help`) before assuming feature parity.
