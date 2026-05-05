# Story: 0-8-github-actions-pr — GitHub Actions PR check matrix + post-merge deploy hooks

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#8](https://github.com/yabafre/pekulo/issues/8)
**Branch:** `feature/8-0-8-github-actions-pr`
**Commit prefix:** `feat(#8): ...` (or `chore(#8):` / `docs(#8):` / `ci(#8):` per task type)
**Closes:** #8
**Stepscompleted:** 0/7 (T1–T7)
**Reference ADRs:** [ADR-0002 — Test pyramid (Vitest + Playwright + axe + Lighthouse CI + pytest)](../adr/0002-test-pyramid.md), [ADR-0004 — Lint + format toolchain — oxlint + oxfmt](../adr/0004-lint-format-toolchain-oxc.md), [ADR-0014 — Schema migrations via Prisma migrate](../adr/0014-prisma-migrations.md)
**Reference architecture sections:** `docs/architecture.md` L230–L240 (CI/CD matrix definition), L889 (file-structure target), L1024 (GitHub Actions integration row)
**Reference NFRs:** NFR-3 (Lighthouse ≥ 90), NFR-22 (WCAG 2.2 AA), NFR-8 (RLS coverage 100 %), NFR-12 (no secrets in git — gated separately by 0-11), NFR-25/26/27 (observability — passes through trace context, no CI-specific work)

**Lessons enforced:**

- **L1** — Bun `--frozen-lockfile` workspace coverage. CI is greenfield-on-`actions/checkout@v5` so the entire repo (every workspace `package.json`) is present at install time — the L1 failure mode (Docker contexts missing foreign workspace manifests) does NOT recur in this story. The lesson is documented in `docs/ci/README.md` § "Pitfalls" so any future CI step that performs `docker build` (e.g. apps/api image build for vulnerability scan) re-applies the L1 fix.
- **L3** — oxlint / oxfmt have no `--staged` flag. CI invokes the monorepo-wide forms (`bun run lint`, `bun run format:check`) — no `--staged` involved. Documented in `docs/ci/README.md` so reviewers don't propose `--staged` "for speed" later.

---

## User Story

**As a** Pekulo developer, **I want** a GitHub Actions workflow `pr.yml` that hard-gates every PR on `lint`, `format-check`, `typecheck`, `prisma:check`, and `rls-audit` (when secrets are configured), declares the forward-compat gates `test:unit`, `test:e2e:smoke`, `lighthouse-ci`, `axe-a11y` so they auto-activate when their owning stories land their config artefacts, wires Turborepo remote cache via `TURBO_TOKEN` / `TURBO_TEAM`, and a sibling workflow `deploy.yml` that POSTs to the Dokploy deploy webhooks for `apps/api` and `apps/prices` after every merge to `main`, **so that** (a) every PR shares the same set of mechanical gates, (b) the gates that depend on yet-unbuilt artefacts (axe fixtures, Playwright config, Vitest config, Lighthouse budgets) auto-engage the moment those artefacts ship — no follow-up CI PR — and (c) the post-merge deploy of `apps/api` + `apps/prices` is reproducible from CI logs, not from a one-off manual `curl` somebody runs from their laptop.

---

## Acceptance Criteria

- **AC-1 (hard gates fail loud).** **Given** a PR introducing a lint violation (`bun run lint` exits non-zero), a format drift (`bun run format:check` exits non-zero), a TypeScript error (`turbo run typecheck` exits non-zero), a Prisma schema regression (`prisma format --check` or `prisma validate` exits non-zero), or — when `RLS_AUDIT_DATABASE_URL` is configured as a repo secret — an RLS coverage drift (`bun --cwd apps/api run db:rls-audit` exits non-zero), **When** `pr.yml` runs on the PR, **Then** the corresponding job ends in `failure` status AND the PR-level "All checks passed" badge stays red AND, with branch protection rules configured per `docs/ci/README.md` § "Branch protection setup", the `Merge` button is disabled. Verified by Task 7's local + remote smoke and by inspecting the failed-check screenshot captured in the Completion Notes.

- **AC-2 (forward-compat gates auto-activate on artefact presence).** **Given** the repo at the moment 0-8 ships (no `vitest.config.{ts,mts}` at any workspace, no `playwright.config.ts`, no `lighthouserc.{json,cjs}`, no axe fixtures), **When** `pr.yml` runs, **Then** the four forward-compat jobs (`test:unit`, `test:e2e:smoke`, `lighthouse-ci`, `axe-a11y`) each evaluate a step-level guard via `hashFiles(<artefact-glob>)`, log a single line `skip: <artefact-glob> not present` to the job summary, exit 0, AND **MUST** be configured as `Required status checks` on the branch protection rule (so that re-introducing them as required does not require a branch-protection PR later). **And given** a follow-up story that lands the matching artefact (e.g. `vitest.config.ts` lands in story 0-9 spike or 0-10 migration; `playwright.config.ts` lands in 0-10 visual snapshot suite; axe fixture lands in 0-10; `lighthouserc.json` lands in 11-4), **When** the next PR is opened, **Then** the matching forward-compat job runs the actual command (`bun test`, `bunx playwright test --grep @smoke`, `bunx lhci autorun`, `bunx vitest run --grep axe`) AND a non-zero exit on that command fails the job. The skip-vs-run flip is purely artefact-driven; no CI edit is required to activate the gate.

- **AC-3 (Turborepo remote cache wired).** **Given** the repo secrets `TURBO_TOKEN` (Vercel-issued or Turborepo Cloud token) and `TURBO_TEAM` (org slug) are configured, **When** any job that runs `turbo run <task>` executes (`typecheck`, future `build`), **Then** the job log contains either `>>> FULL TURBO` (full cache hit) on the second consecutive run of an unchanged tree, OR `cache miss, executing <hash>` followed by `Tasks: <n> successful, <n> total` on a first run, AND the job summary attaches `turbo-summary.json` (`turbo run typecheck --summarize`) as an artefact. **And given** the secrets are NOT configured (e.g. fork PR), **When** the job runs, **Then** turbo proceeds without remote cache (local cache only), the job log contains `Remote caching disabled` (turbo's standard message), AND the job still passes — the cache is an optimisation, not a gate.

- **AC-4 (post-merge deploy hooks fire sequentially with HTTP 2xx required).** **Given** a merge commit lands on `main` (push event) AND repo secrets `DOKPLOY_API_DEPLOY_HOOK` + `DOKPLOY_PRICES_DEPLOY_HOOK` are non-empty URLs, **When** `deploy.yml` runs, **Then** the job executes a single shell step that POSTs (no body, `Content-Length: 0`) to `DOKPLOY_API_DEPLOY_HOOK` first, asserts the response status is in the 2xx range (`curl --fail --show-error --silent --output /dev/null --write-out "%{http_code}"` ≥ 200 and ≤ 299), THEN POSTs to `DOKPLOY_PRICES_DEPLOY_HOOK` with the same assertion, AND a non-2xx on either call fails the workflow with the curl exit + the captured HTTP status logged. Vercel deployment of `apps/web` happens via Vercel's native GitHub integration (no step in `deploy.yml`); `docs/ci/README.md` § "Vercel integration" documents the manual one-time connect step.

- **AC-5 (workflow files validate locally).** **Given** the two workflow YAML files (`.github/workflows/pr.yml` + `.github/workflows/deploy.yml`) and the composite action (`.github/actions/setup-bun/action.yml`), **When** the dev runs the local validator `bunx --bun @action-validator/cli .github/workflows/pr.yml` AND `bunx --bun @action-validator/cli .github/workflows/deploy.yml` AND `bunx --bun @action-validator/cli .github/actions/setup-bun/action.yml`, **Then** each invocation exits 0 with no schema errors. **And** the dev opens a draft PR from `feature/8-0-8-github-actions-pr` to `main` to verify the actual GitHub runner accepts the workflow (no parse error on the PR's "Checks" tab; jobs visible regardless of pass/fail). **Note (L6, applied on dev pickup 2026-05-05):** the bare npm package `action-validator` is metadata-only (no `bin`) ; the CLI lives in the scoped `@action-validator/cli` package (v0.6.0) — invoke that explicitly.

---

## Dev Notes

### Existing code at write time (Step-0 quote)

This story modifies two existing files (`package.json` at repo root, `apps/api/package.json`) and creates four new files (`.github/workflows/pr.yml`, `.github/workflows/deploy.yml`, `.github/actions/setup-bun/action.yml`, `docs/ci/README.md`). The two existing files are quoted verbatim below — the dev's mental model MUST match the on-disk reality before T4 / T5 run. **Do not paraphrase, reformat, or "improve" the quoted code outside the explicit task instructions** — every byte preserved means one fewer RED cycle for the dev agent.

#### Root `package.json` (current — modified by Task 4)

<!-- aped-lint-disable -->
```json
{
  "name": "test",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "dotenv -c -e .env -e .env.local -- turbo run dev",
    "dev:web": "dotenv -c -e .env -e .env.local -- turbo run dev --filter=web",
    "dev:prices": "dotenv -c -e .env -e .env.local -- bash -lc 'cd apps/prices && uvicorn main:app --reload --port 8000'",
    "build": "dotenv -c -e .env -e .env.local -- turbo run build",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt",
    "format:check": "oxfmt --check"
  },
  "devDependencies": {
    "dotenv-cli": "^8.0.0",
    "oxfmt": "0.47.0",
    "oxlint": "1.62.0",
    "turbo": "^2.9.6"
  },
  "packageManager": "bun@1.3.13"
}
```
<!-- aped-lint-enable -->

T4 inserts two new entries inside the `"scripts"` object: `"prisma:check"` and `"db:rls-audit"`. The rest of the file is preserved byte-for-byte.

#### `apps/api/package.json` (current — modified by Task 5)

<!-- aped-lint-disable -->
```json
{
  "name": "@pekulo/api",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo domain API — Bun + Elysia + oRPC. See ADR-0009.",
  "type": "module",
  "main": "./src/main.ts",
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "start": "bun src/main.ts",
    "build": "bun build src/main.ts --target=bun --outdir=dist",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:migrate:status": "prisma migrate status",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "db:rls-audit": "bun run scripts/rls-audit.ts"
  },
  "dependencies": { "...": "preserved verbatim by T5 — see file" },
  "devDependencies": { "...": "preserved verbatim by T5 — see file" }
}
```
<!-- aped-lint-enable -->

T5 inserts a single new entry inside `"scripts"`: `"prisma:check": "prisma format --check && prisma validate"`. The full `dependencies` and `devDependencies` blocks are preserved (the abbreviated `"..."` placeholders above are documentation aids, NOT a license to drop deps).

#### `.github/` directory (current state)

<!-- aped-lint-disable -->
```
$ ls -la .github/
ls: .github/: No such file or directory
```
<!-- aped-lint-enable -->

This is a greenfield directory creation. The first commit on this story creates `.github/` along with `.github/workflows/` and `.github/actions/setup-bun/`. No existing CI to reconcile.

---

### File List + 3-bullet decision template

| # | Path | Single responsibility | Inputs / Outputs |
|---|---|---|---|
| 1 | `.github/actions/setup-bun/action.yml` | Composite action shared by every job in `pr.yml` and `deploy.yml`: checkout the repo, install Bun 1.3.13, run `bun install --frozen-lockfile`. | **In:** the calling workflow's `${{ github.workspace }}`. **Out:** Bun on `$PATH`, `node_modules/` populated, no other side-effects. |
| 2 | `.github/workflows/pr.yml` | PR-level quality matrix on `pull_request` (any branch into `main`) and `push` (only `main`, to populate Turbo cache for downstream PRs). Nine jobs: 5 hard-gate + 4 forward-compat. | **In:** repo source, secrets `TURBO_TOKEN`, `TURBO_TEAM`, `RLS_AUDIT_DATABASE_URL` (optional). **Out:** per-job pass/fail, artefact `turbo-summary.json` on the typecheck job. |
| 3 | `.github/workflows/deploy.yml` | On `push: main` only: POST to Dokploy deploy webhooks for `apps/api` then `apps/prices`, asserting HTTP 2xx on each. Vercel is out-of-scope (native GitHub integration). | **In:** repo source (used only for `actions/checkout` since the webhook URL itself does the deploy), secrets `DOKPLOY_API_DEPLOY_HOOK`, `DOKPLOY_PRICES_DEPLOY_HOOK`. **Out:** HTTP POST × 2; job log captures status code per call. |
| 4 | `package.json` (root, modified) | Add two top-level scripts that proxy into `apps/api` so CI invocations stay uniform across the matrix (`bun run prisma:check`, `bun run db:rls-audit`) without `--cwd` plumbing. | **In:** existing root scripts, no removed scripts. **Out:** two new entries (`prisma:check`, `db:rls-audit`) in `"scripts"`. |
| 5 | `apps/api/package.json` (modified) | Add `prisma:check` script chaining `prisma format --check && prisma validate` — these two assertions need no DB connection so they run on every PR. | **In:** existing apps/api scripts, no removed scripts. **Out:** one new entry (`prisma:check`) in `"scripts"`. |
| 6 | `docs/ci/README.md` | Onboarding doc for the CI matrix: gate-by-gate purpose, secret list with provisioning steps, branch protection setup recipe, the skip-if-absent forward-compat pattern, lessons applied. | Documentation only — no runtime input/output. |

---

### Architecture / pattern notes

- **Pinned tool versions.** `actions/checkout@v5`, `oven-sh/setup-bun@v2` (canonical major versions as of 2026-05-05). Bun version `1.3.13` matches root `package.json#packageManager`. Do NOT use `@latest` or unpinned majors — tags are immutable, majors are not.
- **`pr.yml` trigger shape.**
  - `pull_request:` — every PR targeting `main`.
  - `push: branches: [main]` — to keep the Turborepo remote cache warm for the next PR's hash window. The branch-protection rules (manual setup) only require check completion on the `pull_request` trigger; the `push: main` run is informational.
- **Concurrency.** Add `concurrency: group: pr-${{ github.ref }} cancel-in-progress: true` so a force-push to a PR doesn't pile up workflow runs.
- **Permissions.** `permissions: { contents: read, pull-requests: read }` — least-privilege; the workflow doesn't need to write anything.
- **Skip-if-absent pattern.** The forward-compat jobs (`test:unit`, `test:e2e:smoke`, `lighthouse-ci`, `axe-a11y`) wrap their actual command in a step-level guard:
  ```yaml
  - name: Run vitest (skip if no config)
    run: |
      if [ -z "$(find . -name 'vitest.config.*' -not -path '*/node_modules/*' -print -quit)" ]; then
        echo "skip: vitest.config.* not present"
        exit 0
      fi
      bun test
  ```
  This is more robust than `if: hashFiles(...)` at the job level because it lets the job appear in the PR check list even when skipped (so branch protection rules referring to the job name keep matching, AC-2's "MUST be configured as Required status checks" intent).
- **Turborepo cache.** Set `TURBO_TOKEN` and `TURBO_TEAM` as `env:` at the workflow level. Turborepo auto-detects them. The `--summarize` flag emits `.turbo/runs/<hash>.json`; we upload that as an artefact via `actions/upload-artifact@v4`.
- **`deploy.yml` curl shape.** Use `curl --fail-with-body --show-error --silent --request POST --header "Content-Length: 0" "$DOKPLOY_API_DEPLOY_HOOK"`. `--fail-with-body` (curl ≥ 7.76, ubuntu-latest 2026 has 8.x) exits non-zero on 4xx/5xx AND prints the body — combines AC-4's "non-2xx fails" + "captured HTTP status logged" requirements.
- **Sequential, not parallel, deploy steps.** AC-4 explicitly demands sequential. If api fails, we want to NOT redeploy prices (correlated failure pattern). Use one `run:` block with `set -euo pipefail` so the second curl is gated on the first.
- **rls-audit on PR vs push.** The `rls-audit` job in `pr.yml` runs on every event but the inner step checks `if [ -z "$RLS_AUDIT_DATABASE_URL" ]; then echo "skip: RLS_AUDIT_DATABASE_URL not set"; exit 0; fi`. Forks-to-PR have no access to secrets so this naturally skips on third-party PRs (architecture Phase 1 — single-developer V1, this is non-binding today). Production deploy in `deploy.yml` does NOT include rls-audit (deferred to story 11-3 which delivers the post-deploy audit job).
- **NFR-3 + NFR-22 trace.** The story does NOT bring NFR-3 (Lighthouse) or NFR-22 (axe) into a passing state — it brings them into a *gating-ready* state. The actual budgets / fixtures land in 11-4 (axe + WCAG gates) and the Lighthouse budget file lands in the same story. AC-2 captures the auto-activation contract.

---

### Lesson application — proof-of-work

| Lesson | How this story applies it |
|---|---|
| **L1** (Bun `--frozen-lockfile` workspace coverage) | T1 composite action runs `bun install --frozen-lockfile` against the full repo (every workspace `package.json` present via `actions/checkout@v5`). T6 documents the L1 trap so a future job that does `docker build` knows to copy every workspace manifest + adjust `.dockerignore`. |
| **L3** (oxlint / oxfmt no `--staged` flag) | T2 invokes `bun run lint` and `bun run format:check` (monorepo-wide, no `--staged`). T6 documents in `docs/ci/README.md` § "Pitfalls". |
| **L4 / L5** (oxlint config schema) | Not applicable to CI invocation (oxlint config is consumed by oxlint itself; CI just runs the binary). |
| **L0** (Elysia OTel plugin broken on Bun) | Not applicable to CI. |

---

### Branch protection setup (one-time manual step for Alex, post-merge)

After this story ships and the workflow runs at least once on a real PR (so the check names register on GitHub's side), navigate to `Settings → Branches → Add branch ruleset` for `main`. Required status checks (exact names — match the `name:` field of each job, not the workflow file name):

- `pr / lint`
- `pr / format-check`
- `pr / typecheck`
- `pr / prisma-check`
- `pr / rls-audit`
- `pr / test-unit`
- `pr / test-e2e-smoke`
- `pr / lighthouse-ci`
- `pr / axe-a11y`

Enable: `Require branches to be up to date before merging`, `Require linear history`, `Block force pushes`. Documented in `docs/ci/README.md` § "Branch protection setup" — Task 7 verifies the names match.

---

### Secrets to configure (one-time manual step for Alex)

Repo `Settings → Secrets and variables → Actions → New repository secret`:

| Secret name | Value source | Required for |
|---|---|---|
| `TURBO_TOKEN` | Turborepo Cloud (sign in at https://vercel.com/account/tokens or https://turbo.build/repo) | Turborepo remote cache (AC-3); without it, jobs run with local cache only, no failure |
| `TURBO_TEAM` | Vercel team slug or `team_<id>` | Turborepo remote cache (AC-3) |
| `RLS_AUDIT_DATABASE_URL` | Supabase preview-branch connection string OR a dedicated read-only role on the V1 (a) personal-use Postgres | `pr.yml` rls-audit job (AC-1); without it, the job skips with a logged reason |
| `DOKPLOY_API_DEPLOY_HOOK` | Dokploy → apps/api project → Deploy hook URL | `deploy.yml` (AC-4) |
| `DOKPLOY_PRICES_DEPLOY_HOOK` | Dokploy → apps/prices project → Deploy hook URL | `deploy.yml` (AC-4) |

`docs/ci/README.md` § "Secrets" mirrors this table with the provisioning steps.

---

## Tasks

- [ ] **T1 — Create composite action `.github/actions/setup-bun/action.yml`** [AC: AC-3, AC-5]

  Create the directory structure (`mkdir -p .github/actions/setup-bun`) then write the file below verbatim:

  <!-- aped-lint-disable -->
  ```yaml
  name: setup-bun
  description: "Pekulo CI shared setup — checkout, install Bun 1.3.13, frozen install. Reused by every job in pr.yml and deploy.yml."
  runs:
    using: composite
    steps:
      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.13
      - name: Install dependencies (frozen)
        shell: bash
        run: bun install --frozen-lockfile
  ```
  <!-- aped-lint-enable -->

  **Note:** the composite action does NOT include `actions/checkout` — composite actions cannot call other actions in their first stable release; calling workflows must `uses: actions/checkout@v5` themselves before `uses: ./.github/actions/setup-bun`. This is by design.

  Validate locally:

  ```
  bunx --bun @action-validator/cli .github/actions/setup-bun/action.yml
  ```

  Expected output: `OK: .github/actions/setup-bun/action.yml` (action-validator exits 0).

  Commit:

  ```
  git add .github/actions/setup-bun/action.yml
  git commit -m "ci(#8): T1 — composite setup-bun action (Bun 1.3.13 + frozen install)"
  ```

- [ ] **T2 — Create `.github/workflows/pr.yml`** [AC: AC-1, AC-2, AC-3, AC-5]

  Create `mkdir -p .github/workflows` then write the file below verbatim:

  <!-- aped-lint-disable -->
  ```yaml
  name: pr
  on:
    pull_request:
      branches: [main]
    push:
      branches: [main]

  concurrency:
    group: pr-${{ github.ref }}
    cancel-in-progress: true

  permissions:
    contents: read
    pull-requests: read

  env:
    TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
    TURBO_TEAM: ${{ secrets.TURBO_TEAM }}

  jobs:
    lint:
      name: lint
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: oxlint
          run: bun run lint

    format-check:
      name: format-check
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: oxfmt --check
          run: bun run format:check

    typecheck:
      name: typecheck
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: tsc --noEmit (turbo)
          run: bun run typecheck -- --summarize
        - name: Upload turbo summary
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: turbo-summary
            path: .turbo/runs/*.json
            if-no-files-found: ignore
            retention-days: 7

    prisma-check:
      name: prisma-check
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: prisma format --check && prisma validate
          run: bun run prisma:check

    rls-audit:
      name: rls-audit
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: rls-audit (skip if RLS_AUDIT_DATABASE_URL unset)
          env:
            RLS_AUDIT_DATABASE_URL: ${{ secrets.RLS_AUDIT_DATABASE_URL }}
          run: |
            if [ -z "$RLS_AUDIT_DATABASE_URL" ]; then
              echo "skip: RLS_AUDIT_DATABASE_URL not set"
              exit 0
            fi
            DATABASE_URL="$RLS_AUDIT_DATABASE_URL" bun run db:rls-audit

    test-unit:
      name: test-unit
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: vitest (skip if no config)
          run: |
            if [ -z "$(find . -name 'vitest.config.*' -not -path '*/node_modules/*' -print -quit)" ]; then
              echo "skip: vitest.config.* not present"
              exit 0
            fi
            bun test

    test-e2e-smoke:
      name: test-e2e-smoke
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: playwright @smoke (skip if no config)
          run: |
            if [ ! -f playwright.config.ts ] && [ ! -f playwright.config.js ] && [ ! -f apps/web/playwright.config.ts ]; then
              echo "skip: playwright.config.* not present"
              exit 0
            fi
            bunx playwright install --with-deps chromium
            bunx playwright test --grep @smoke

    lighthouse-ci:
      name: lighthouse-ci
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: lhci autorun (skip if no config)
          run: |
            if [ ! -f lighthouserc.json ] && [ ! -f lighthouserc.cjs ] && [ ! -f apps/web/lighthouserc.json ]; then
              echo "skip: lighthouserc.* not present"
              exit 0
            fi
            bunx --bun @lhci/cli@0.14.x autorun

    axe-a11y:
      name: axe-a11y
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - uses: ./.github/actions/setup-bun
        - name: vitest-axe (skip if no fixture)
          run: |
            if [ -z "$(find . -name '*.axe.test.*' -not -path '*/node_modules/*' -print -quit)" ]; then
              echo "skip: *.axe.test.* fixture not present"
              exit 0
            fi
            bunx vitest run --grep axe
  ```
  <!-- aped-lint-enable -->

  Validate locally:

  ```
  bunx --bun @action-validator/cli .github/workflows/pr.yml
  ```

  Expected output: `OK: .github/workflows/pr.yml` (exit 0). The scoped `@action-validator/cli` package fetches one-shot via bunx — the dev does NOT add it as a project dep. The unscoped `action-validator` npm name is bare metadata (no bin) — see L6.

  Commit:

  ```
  git add .github/workflows/pr.yml
  git commit -m "ci(#8): T2 — pr.yml matrix (5 hard gates + 4 forward-compat skip-if-absent)"
  ```

- [ ] **T3 — Create `.github/workflows/deploy.yml`** [AC: AC-4, AC-5]

  Write the file below verbatim:

  <!-- aped-lint-disable -->
  ```yaml
  name: deploy
  on:
    push:
      branches: [main]

  concurrency:
    group: deploy-main
    cancel-in-progress: false

  permissions:
    contents: read

  jobs:
    dokploy:
      name: dokploy-webhooks
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v5
        - name: POST Dokploy webhooks (api then prices, sequential, fail on non-2xx)
          env:
            DOKPLOY_API_DEPLOY_HOOK: ${{ secrets.DOKPLOY_API_DEPLOY_HOOK }}
            DOKPLOY_PRICES_DEPLOY_HOOK: ${{ secrets.DOKPLOY_PRICES_DEPLOY_HOOK }}
          run: |
            set -euo pipefail
            if [ -z "$DOKPLOY_API_DEPLOY_HOOK" ] || [ -z "$DOKPLOY_PRICES_DEPLOY_HOOK" ]; then
              echo "::error::DOKPLOY_*_DEPLOY_HOOK secrets not configured — see docs/ci/README.md"
              exit 1
            fi
            echo "[deploy] POST apps/api hook"
            curl --fail-with-body --show-error --silent \
                 --request POST \
                 --header "Content-Length: 0" \
                 --write-out "\n[deploy] api status: %{http_code}\n" \
                 "$DOKPLOY_API_DEPLOY_HOOK"
            echo "[deploy] POST apps/prices hook"
            curl --fail-with-body --show-error --silent \
                 --request POST \
                 --header "Content-Length: 0" \
                 --write-out "\n[deploy] prices status: %{http_code}\n" \
                 "$DOKPLOY_PRICES_DEPLOY_HOOK"
  ```
  <!-- aped-lint-enable -->

  Validate locally:

  ```
  bunx --bun @action-validator/cli .github/workflows/deploy.yml
  ```

  Expected output: `OK: .github/workflows/deploy.yml` (exit 0).

  Commit:

  ```
  git add .github/workflows/deploy.yml
  git commit -m "ci(#8): T3 — deploy.yml — sequential Dokploy webhooks (api then prices, fail on non-2xx)"
  ```

- [ ] **T4 — Add `prisma:check` and `db:rls-audit` scripts to root `package.json`** [AC: AC-1]

  Open `package.json` (repo root) and replace the entire `"scripts"` block with the version below. Every existing key is preserved verbatim; two new keys (`prisma:check`, `db:rls-audit`) are appended after `format:check`:

  <!-- aped-lint-disable -->
  ```json
  "scripts": {
    "dev": "dotenv -c -e .env -e .env.local -- turbo run dev",
    "dev:web": "dotenv -c -e .env -e .env.local -- turbo run dev --filter=web",
    "dev:prices": "dotenv -c -e .env -e .env.local -- bash -lc 'cd apps/prices && uvicorn main:app --reload --port 8000'",
    "build": "dotenv -c -e .env -e .env.local -- turbo run build",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "prisma:check": "bun --cwd apps/api run prisma:check",
    "db:rls-audit": "bun --cwd apps/api run db:rls-audit"
  },
  ```
  <!-- aped-lint-enable -->

  Validate:

  ```
  bun run prisma:check
  ```

  Expected output: at minimum, the line `Prisma schema loaded from prisma/schema` and a final `The schema at prisma/schema is valid 🚀` (exit 0). The `prisma format --check` step preceding `prisma validate` is silent on success.

  Commit:

  ```
  git add package.json
  git commit -m "chore(#8): T4 — proxy scripts prisma:check + db:rls-audit at repo root"
  ```

- [ ] **T5 — Add `prisma:check` script to `apps/api/package.json`** [AC: AC-1]

  Open `apps/api/package.json` and append a single new key (`prisma:check`) inside the `"scripts"` block, after `prisma:validate`. The full target shape of the `"scripts"` block is:

  <!-- aped-lint-disable -->
  ```json
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "start": "bun src/main.ts",
    "build": "bun build src/main.ts --target=bun --outdir=dist",
    "typecheck": "tsc --noEmit",
    "prisma:generate": "prisma generate",
    "prisma:migrate:dev": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy",
    "prisma:migrate:status": "prisma migrate status",
    "prisma:format": "prisma format",
    "prisma:validate": "prisma validate",
    "prisma:check": "prisma format --check && prisma validate",
    "db:rls-audit": "bun run scripts/rls-audit.ts"
  },
  ```
  <!-- aped-lint-enable -->

  Do NOT modify `dependencies` or `devDependencies` (T5 scope is scripts only).

  Validate:

  ```
  bun --cwd apps/api run prisma:check
  ```

  Expected output: `Prisma schema loaded from prisma/schema` then `The schema at prisma/schema is valid 🚀` (exit 0). If `prisma format --check` fails (exit 1), the chain short-circuits before `validate` runs — that's the intended hard gate.

  Commit:

  ```
  git add apps/api/package.json
  git commit -m "chore(#8): T5 — apps/api prisma:check chains format --check && validate"
  ```

- [ ] **T6 — Create `docs/ci/README.md`** [AC: AC-1, AC-2, AC-3, AC-4]

  Create the directory if absent (`mkdir -p docs/ci`) then write the file below verbatim:

  <!-- aped-lint-disable -->
  ````markdown
  # CI — GitHub Actions Reference

  This file documents the two workflows that gate every PR and deploy on merge: `.github/workflows/pr.yml` (PR matrix) and `.github/workflows/deploy.yml` (post-merge Dokploy webhooks). Generated by story 0-8.

  ## Matrix overview

  `pr.yml` runs on every `pull_request` targeting `main` AND on every `push` to `main` (the latter to keep the Turborepo remote cache warm for the next PR). Nine jobs, two tiers:

  ### Tier 1 — Hard gates (always run, fail loud)

  | Job | Command | Gates |
  |---|---|---|
  | `lint` | `bun run lint` (oxlint, monorepo-wide) | NFR-12 hygiene |
  | `format-check` | `bun run format:check` (oxfmt --check) | code-style drift |
  | `typecheck` | `bun run typecheck` (turbo run typecheck) | TS soundness |
  | `prisma-check` | `bun run prisma:check` (`prisma format --check && prisma validate`) | schema regression |
  | `rls-audit` | `bun run db:rls-audit` if `RLS_AUDIT_DATABASE_URL` set, otherwise skip | NFR-8 (RLS coverage 100 %) |

  ### Tier 2 — Forward-compat (skip-if-absent)

  Each job evaluates a step-level guard for the artefact below. If absent, the job logs `skip: <artefact> not present` and exits 0 (job appears green in the PR check list). When the artefact lands in the owning story, the job auto-activates and behaves as a hard gate.

  | Job | Owning story | Activation artefact | Command when active |
  |---|---|---|---|
  | `test-unit` | 0-9 / 0-10 | `vitest.config.{ts,mts,js,cjs}` anywhere outside `node_modules` | `bun test` |
  | `test-e2e-smoke` | 0-10 (visual snapshot suite) | `playwright.config.{ts,js}` at repo root or `apps/web/` | `bunx playwright test --grep @smoke` |
  | `lighthouse-ci` | 11-4 | `lighthouserc.{json,cjs}` at repo root or `apps/web/` | `bunx --bun @lhci/cli@0.14.x autorun` |
  | `axe-a11y` | 0-10 / 11-4 | any `*.axe.test.*` fixture outside `node_modules` | `bunx vitest run --grep axe` |

  ## Secrets

  Configure under repo `Settings → Secrets and variables → Actions`:

  | Secret | Source | Required for |
  |---|---|---|
  | `TURBO_TOKEN` | https://vercel.com/account/tokens (or Turborepo Cloud) | remote cache (optimisation, not gate) |
  | `TURBO_TEAM` | Vercel team slug | remote cache |
  | `RLS_AUDIT_DATABASE_URL` | Supabase preview-branch / dedicated read-only role | `rls-audit` hard gate (skips if unset) |
  | `DOKPLOY_API_DEPLOY_HOOK` | Dokploy → apps/api → Deploy hook URL | `deploy.yml` post-merge |
  | `DOKPLOY_PRICES_DEPLOY_HOOK` | Dokploy → apps/prices → Deploy hook URL | `deploy.yml` post-merge |

  ## Branch protection setup

  After the workflow runs at least once on a real PR (so check names register on GitHub's side), open `Settings → Branches → Add branch ruleset` for `main` and set:

  - **Required status checks** (exact names; copy verbatim — match the `name:` field of each job in `pr.yml`):
    `pr / lint`, `pr / format-check`, `pr / typecheck`, `pr / prisma-check`, `pr / rls-audit`, `pr / test-unit`, `pr / test-e2e-smoke`, `pr / lighthouse-ci`, `pr / axe-a11y`
  - **Require branches to be up to date before merging**: ON
  - **Require linear history**: ON
  - **Block force pushes**: ON

  All nine names MUST be required, including the forward-compat tier — they currently log `skip` but become real gates the moment their owning story lands the artefact (no future branch-protection PR needed).

  ## Vercel integration

  `apps/web` deploys via Vercel's native GitHub integration. One-time setup:

  1. Vercel dashboard → Add New Project → Import `yabafre/pekulo`.
  2. Root directory: `apps/web` (Vercel auto-detects Next.js 16).
  3. Production branch: `main`.

  No step in `deploy.yml` — the GitHub integration handles it. If you choose to disconnect the GitHub integration in favour of a Vercel deploy hook, add a step in `deploy.yml` that POSTs to the hook URL stored in a `VERCEL_DEPLOY_HOOK_URL` secret (mirror the Dokploy pattern).

  ## Pitfalls

  - **L1 — Bun `--frozen-lockfile` workspace coverage.** This story's CI is greenfield; `actions/checkout@v5` brings the entire repo so the L1 trap (Docker contexts missing foreign workspace `package.json`) does NOT recur. **If a future job adds `docker build`** (e.g. apps/api image build for vulnerability scan), apply the L1 fix BEFORE running `RUN bun install --frozen-lockfile` inside the Dockerfile: copy every workspace manifest (root + every `apps/*/package.json` + every `packages/*/package.json`) AND adjust `.dockerignore` to re-include those manifests via `!path` exceptions. See `docs/lessons.md` 2026-05-04 entry for the canonical recipe.
  - **L3 — oxlint / oxfmt have no `--staged` flag.** CI calls `bun run lint` and `bun run format:check` (monorepo-wide). Don't propose adding `--staged` "for speed" — both binaries reject the flag. Pre-commit usage (story 0-11) uses lefthook's `{staged_files}` variable expansion as positional args.
  - **`actions/checkout@v5` precedes `setup-bun`.** Composite actions cannot embed `actions/checkout` — calling workflows must run it first or `bun install --frozen-lockfile` errors with "no package.json found".
  - **Forward-compat jobs MUST be branch-protection-required.** The skip-if-absent pattern keeps them green today AND turns them into hard gates the moment their artefact lands. If they're not required, the auto-activation is meaningless.
  ````
  <!-- aped-lint-enable -->

  Validate (the doc itself is unstructured prose; the validation is just that the file exists and renders):

  ```
  test -f docs/ci/README.md && wc -l docs/ci/README.md
  ```

  Expected output: a line count ≥ 60 (the body above renders to ~80 lines depending on word wrap). Exit 0.

  Commit:

  ```
  git add docs/ci/README.md
  git commit -m "docs(#8): T6 — CI matrix reference (gates, secrets, branch protection, lessons)"
  ```

- [ ] **T7 — Local + remote validation pass** [AC: AC-1, AC-2, AC-3, AC-4, AC-5]

  Run the full local validation chain. Each command MUST exit 0 — if any step fails, the dev fixes the underlying issue before pushing.

  ```
  bun run lint
  bun run format:check
  bun run typecheck
  bun run prisma:check
  bunx --bun @action-validator/cli@latest .github/actions/setup-bun/action.yml
  bunx --bun @action-validator/cli@latest .github/workflows/pr.yml
  bunx --bun @action-validator/cli@latest .github/workflows/deploy.yml
  ```

  Expected outputs:
  - `bun run lint`: `Found 0 warnings, 0 errors.` (oxlint summary), exit 0.
  - `bun run format:check`: silent on a clean tree (oxfmt --check prints nothing), exit 0.
  - `bun run typecheck`: `Tasks: <n> successful, <n> total` (turbo summary), exit 0.
  - `bun run prisma:check`: `The schema at prisma/schema is valid 🚀`, exit 0.
  - Three `action-validator` runs: each prints `OK: <path>` and exits 0.

  Then push the branch and open a draft PR:

  ```
  git push -u origin feature/8-0-8-github-actions-pr
  gh pr create --base main --draft --title "feat(#8): GitHub Actions PR matrix + Dokploy deploy hooks" --body "Closes #8"
  ```

  Inspect the PR's "Checks" tab on GitHub. Expected:
  - Workflow `pr` is visible with 9 jobs.
  - Hard gates (`lint`, `format-check`, `typecheck`, `prisma-check`) end in `Success` (green check).
  - `rls-audit` ends in `Success` with the log line `skip: RLS_AUDIT_DATABASE_URL not set` (until Alex configures the secret).
  - Forward-compat jobs (`test-unit`, `test-e2e-smoke`, `lighthouse-ci`, `axe-a11y`) end in `Success` with their respective `skip: …` log lines.
  - Workflow `deploy` does NOT run (it's `push: main` only; this is a PR push to a feature branch).

  Capture a screenshot of the green check matrix; attach it (or paste the URL of the workflow run) under "Completion Notes".

  Commit (only if any of the above produced a code change — typically nothing to commit at T7):

  ```
  # If T7 surfaced no edits, skip commit. If T7 produced a fix, commit it as:
  # git add <file> && git commit -m "fix(#8): T7 — <one-line>"
  ```

  Then mark the PR ready for review (`gh pr ready` once all checks are green) and signal handover for `aped-review`.

---

## Dev Agent Record

- **Model:** {{model used}}
- **Started:** {{timestamp}}
- **Completed:** {{timestamp}}

### Debug Log

### Completion Notes

### File List
