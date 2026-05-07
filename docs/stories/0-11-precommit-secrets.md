# Story: 0-11-precommit-secrets — Pre-commit hooks (lefthook + gitleaks + prisma format)

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#11](https://github.com/yabafre/pekulo/issues/11)
**Branch:** `feature/11-0-11-precommit-secrets`
**Commit prefix:** `feat(#11): ...` (or `chore(#11):` / `fix(#11):` per task type)
**Closes:** #11
**Stepscompleted:** 1,2,3,4,5
**Reference ADR:** [ADR-0004 — Lint + format toolchain — oxlint + oxfmt](../adr/0004-lint-format-toolchain-oxc.md)

---

## User Story

**As a** Pekulo developer, **I want** lefthook 2.1.6 wired at the monorepo root with four pre-commit hooks — `oxlint --fix` on staged `*.{js,jsx,ts,tsx,mjs,cjs}`, `oxfmt` on staged formattable files, `gitleaks git --pre-commit` on the staged tree, and `prisma format` when any `apps/api/prisma/**/*.prisma` is staged — auto-installed via `bun install`'s `prepare` script and onboarding documented in `apps/web/README.md` + `apps/api/README.md`, **so that** secrets cannot leak into git history, formatting/lint cannot drift between contributors, and `prisma format` keeps the schema folder idempotent.

---

## Acceptance Criteria

- **AC-1 (gitleaks blocks secrets):** **Given** a staged file containing a fake AWS access key shaped like the AWS pattern (`AKIA` + 16 base32 chars; fixture: `AKIAQYLPMN5HCQGZWXYZ` — chosen to avoid gitleaks' built-in `EXAMPLE` stopword that auto-allowlists the AWS docs canonical key `AKIAIOSFODNN7EXAMPLE`), **When** I run `git commit -m "leak test"`, **Then** the lefthook `gitleaks` hook exits non-zero, the commit is aborted, and the captured output names the rule (`aws-access-token`) and the file path.

- **AC-2 (prisma format auto-rewrites staged schema):** **Given** an unformatted Prisma schema file (extra blank lines, unaligned attribute columns) is staged via `git add`, **When** I run `git commit -m "fmt test"`, **Then** the `prisma format` hook rewrites the file in place, lefthook re-stages the modified schema file, and the resulting commit contains the canonically-formatted version (verifiable: the post-commit blob equals the output of `prisma format` run on a clean tree).

- **AC-3 (oxlint + oxfmt run only on staged delta):** **Given** a staged TSX file with a violating change (e.g. mixed quotes) **and** an unstaged sibling TSX file with a similar violating change, **When** I commit, **Then** `oxlint --fix` and `oxfmt` mutate only the staged file — the unstaged sibling's working-tree byte content is identical before and after the commit, and it remains in the `M ` (modified-unstaged) state with its original violation intact.

- **AC-4 (auto-install on `bun install`):** **Given** a fresh clone with no git pre-commit hook installed, **When** I run `bun install` from the repo root, **Then** the `prepare` lifecycle script invokes `lefthook install`, and after the install completes the git pre-commit hook is materialised at the canonical git location with `lefthook` as its first non-comment line.

- **AC-5 (no-staged-files = no-op):** **Given** a `git commit --allow-empty -m "no-op"` with no staged files, **When** the hook runs, **Then** every command short-circuits (lefthook's empty `{staged_files}` expansion + `glob` filters skip every command), the commit succeeds with exit 0, and the lefthook output reports each command as `(skip)` or `(no files)`.

---

## Dev Notes

### Existing code at write time

#### `package.json` (root, current — to MODIFY)

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
    "start": "dotenv -c -e .env -e .env.local -- bun --filter=web run start",
    "start:web": "dotenv -c -e .env -e .env.local -- bun --filter=web run start",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "generate:tamagui-css": "bun --filter='@pekulo/ui' run generate:tamagui-css",
    "prisma:check": "cd apps/api && bun run prisma:check",
    "db:rls-audit": "cd apps/api && bun run db:rls-audit",
    "test:ui": "bun --filter='@pekulo/ui' run test",
    "test:ui:axe": "bun --filter='@pekulo/ui' run test:axe",
    "test:ui:visual": "bun --filter='@pekulo/ui' run test:visual"
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

> This story adds `lefthook: "2.1.6"` (exact pin, no caret) to `devDependencies` and adds `"prepare": "lefthook install"` to `scripts`. Every other script and devDep is preserved verbatim.

#### `apps/api/package.json#scripts.prisma:format` (current — referenced, NOT modified)

```json
"prisma:format": "prisma format"
```

> The lefthook `prisma_format` command shells out via `bash -c '(cd apps/api && bun run prisma:format)'` per `docs/lessons.md` 2026-05-04 (Bun 1.3.13 silently drops `bun --cwd <path> run <script>`).

#### `.gitignore` (current top — referenced, NOT modified)

```gitignore
# Dependencies
node_modules
.pnp
.pnp.*

# Bun
bun.lockb

# Builds
.next/
.turbo/
.tamagui/
dist/
out/
build/
```

> Lefthook does not require `.gitignore` changes — the binary lives in `node_modules/.bin/` (already ignored) and `lefthook install` writes hooks under `.git/hooks/` (git-internal, never tracked). `.gitignore` stays untouched.

#### `apps/web/README.md` (current — to APPEND a section)

```markdown
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).
…
## Deploy on Vercel
The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
```

> This story APPENDS a `## Pre-commit hooks` section after the "Deploy on Vercel" section. The existing content is preserved verbatim.

#### `apps/api/README.md` (current — to APPEND a section)

```markdown
# `@pekulo/api` — Pekulo domain API

Bun + Elysia HTTP service. See [ADR-0009](../../docs/adr/0009-elysia-orpc-with-zapaction-bridge.md) for the architectural rationale.
…
### 3. Generate the Prisma client + apply migrations

```bash
(cd apps/api && bun run prisma:generate)
(cd apps/api && bun run prisma:migrate:deploy)
```
```

> This story APPENDS a `## Pre-commit hooks` section at the END of the file (after the existing Prisma section). The existing content is preserved verbatim.

#### `lefthook.yml`, `.gitleaks.toml` — none — these are NEW files.

### File decisions (3-bullet template per file)

#### `lefthook.yml` (root) — NEW

- **Single responsibility:** declare the four pre-commit hooks (gitleaks, oxlint, oxfmt, prisma format) with appropriate `glob` filters, `stage_fixed: true` on the auto-fixers, and a clear `fail_text` on gitleaks so the dev knows what to do when blocked.
- **Inputs:** invoked by the lefthook binary (auto-installed via `bun install` → `prepare` → `lefthook install`); reads the `{staged_files}` template variable lefthook expands at hook time and the `{root}` variable for absolute paths.
- **Outputs:** drives the pre-commit pipeline; AC-1 / AC-2 / AC-3 / AC-5 gate on its behaviour.

#### `.gitleaks.toml` (root) — NEW

- **Single responsibility:** extend the upstream gitleaks default ruleset (`useDefault = true`) and declare a Pekulo allowlist for known-safe paths (`.example` env files, the temporary Supabase linked-project file, markdown docs, `bun.lock`).
- **Inputs:** loaded by `gitleaks` via the `--config={root}/.gitleaks.toml` flag wired in `lefthook.yml`.
- **Outputs:** drives AC-1; prevents false positives on canonical safe paths without disabling any default rule.

#### `package.json` (root) — MODIFY

- **Single responsibility (delta):** add `lefthook@2.1.6` exact-pin to `devDependencies` and add `"prepare": "lefthook install"` to `scripts`. Every other field is preserved verbatim.
- **Inputs:** `bun install` resolves the new devDep and runs `prepare` post-install.
- **Outputs:** AC-4 — `.git/hooks/pre-commit` materializes after `bun install`.

#### `apps/web/README.md` — MODIFY

- **Single responsibility (delta):** APPEND a `## Pre-commit hooks` section explaining the lefthook setup, the gitleaks system-binary install (`brew install gitleaks` on macOS, GitHub release tarball on Linux), what each hook does, and the documented bypass path (`LEFTHOOK=0 git commit …`, discouraged).
- **Inputs:** N/A (markdown).
- **Outputs:** onboarding signal for any future contributor on `apps/web`.

#### `apps/api/README.md` — MODIFY

- **Single responsibility (delta):** APPEND a `## Pre-commit hooks` section mirroring `apps/web`'s but mentioning `prisma format` coverage of `apps/api/prisma/schema/*.prisma`.
- **Inputs:** N/A (markdown).
- **Outputs:** onboarding for `apps/api` contributors.

### Architecture references

- **ADR-0004** (`docs/adr/0004-lint-format-toolchain-oxc.md`) — pre-commit + CI as the two enforcement points for oxlint + oxfmt; W1 watch item binds future bumps.
- **Architecture Phase 3 — Process Rules / Pre-commit (lefthook)** (`docs/architecture.md` line ~623-628) — quotes the four hooks. **Note:** the architecture document still names `oxlint --fix --staged` and `oxfmt --staged`; per `docs/lessons.md` 2026-05-04 (m-4 from 0-2 review), the `--staged` CLI flag does NOT exist on `oxlint@1.62.0` / `oxfmt@0.47.0`. This story uses lefthook's `{staged_files}` template variable instead.
- **Architecture Phase 3 — Process Rules / Secrets discipline** (`docs/architecture.md` line ~146 + ~678) — "Pre-commit `gitleaks` hook fails on accidental secret commits. No secret in git, ever."
- **`docs/lessons.md` 2026-05-04** — `bun --cwd <path> run <script>` is broken under Bun 1.3.13. The `prisma_format` lefthook command uses `bash -c '(cd apps/api && bun run prisma:format)'` — never `bun --cwd`.

### Versions pinned

| Package    | Version   | Pinning          | Rationale                                                              |
| ---------- | --------- | ---------------- | ---------------------------------------------------------------------- |
| `lefthook` | `2.1.6`   | exact (no caret) | ADR-0004 audit ritual; uniform pin discipline.                         |
| `gitleaks` | `≥ 8.18`  | system binary    | `gitleaks git --pre-commit` subcommand requires v8.18+ (post-`protect` rename); installed via `brew` (macOS) or GitHub release tarball (Linux). README documents the install. |

`devDependencies` keys MUST be the literal string `"2.1.6"` — NOT `"^2.1.6"`. Bun's default insertion behaviour adds a caret; either edit `package.json` directly (Task 1 instructs this) or use `bun add -d -E lefthook@2.1.6` (the `-E` flag forces exact).

### Out of scope (explicit non-goals — do NOT do these in this story)

- ❌ Wiring lefthook in CI (`.github/workflows/pr.yml`) — the CI matrix is owned by **story 0-8** (already complete). Pre-commit hooks are a developer-machine guard; CI re-runs `lint`, `format-check`, etc. independently.
- ❌ Adding the four Pekulo custom oxlint rules (`no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`, `no-tailwind-outside-ui`) — owned by **story 0-12**. lefthook only invokes the existing root `oxlint --fix`; whatever rules are configured in `.oxlintrc.json` apply.
- ❌ Repo-wide gitleaks history scan (`gitleaks detect --source . --redact`) for past leaks — pre-commit only catches *future* commits. A one-shot history scan can land as a separate ticket if concern arises.
- ❌ `.gitignore`-ing `apps/web/supabase/.temp/linked-project.json` (Rex R-INFO from 0-2 review) — out of 0-11 scope; allowlisted in `.gitleaks.toml` so it does not produce false positives, but the broader `gitignore` follow-up is a separate ticket.
- ❌ Husky / `simple-git-hooks` / pre-commit (Python) alternatives — ADR-0004 names lefthook.
- ❌ Updating `docs/architecture.md` line ~623-628 to drop the literal `--staged` flag wording — out of scope; the lessons.md entry is the single source of truth and a future architecture refresh will reconcile.

### Lessons applied

- **`docs/lessons.md` 2026-05-04 (m-4 from 0-2 review):** `oxlint@1.62.0` and `oxfmt@0.47.0` have NO `--staged` CLI flag. lefthook commands use `{staged_files}` template expansion + `stage_fixed: true` on auto-fixers (instead of literal `--staged`). Confirmed via `bun x oxlint --help | grep -i staged` returning no match.
- **`docs/lessons.md` 2026-05-04 (`bun --cwd <path> run <script>` is broken):** the `prisma_format` lefthook command uses `bash -c '(cd apps/api && bun run prisma:format)'` — never `bun --cwd apps/api run prisma:format`.
- **`docs/lessons.md` 2026-05-05 (`action-validator` npm package is bare metadata):** N/A here — lefthook is its own validator (`lefthook validate`).
- **From 0-2 (commit hygiene):** one commit per task with `feat(#11):` / `chore(#11):` / `fix(#11):` prefixes. Mirrors 0-2's discipline.

### Risks / Watch items (this story specifically)

- **gitleaks is a Go binary, not an npm package.** macOS dev-machines: `brew install gitleaks` (canonical). Linux: GitHub release tarball (`https://github.com/gitleaks/gitleaks/releases`). The README onboarding section is critical — without gitleaks installed, lefthook would otherwise silently skip the hook and let secrets through. The `lefthook.yml` therefore does NOT use `command_exists: gitleaks` skip-condition; instead the command runs unconditionally and fails loudly with `command not found` if gitleaks is missing, which is the desired security posture (fail closed).
- **gitleaks v8.18+ renamed `protect` → `git --pre-commit`.** This story uses the modern form (`gitleaks git --pre-commit --staged --redact --verbose --config={root}/.gitleaks.toml`). Task 1 verifies `gitleaks --version` returns 8.18 or newer; Task 4 / Task 5 README onboarding explicitly call out the minimum version.
- **`prepare` script ordering.** Bun runs `prepare` after `bun install`'s dependency resolution (verified in 0-1 / 0-2 — no other root `prepare` script exists). `lefthook install` is idempotent and writes/replaces `.git/hooks/pre-commit` on every run, so re-installs are safe.
- **`stage_fixed: true` semantics.** Lefthook re-stages files that were in `{staged_files}` AND were modified by the hook command. For `prisma_format`, the run command does NOT consume `{staged_files}` (it operates on the schema folder as a whole), but `stage_fixed: true` still re-stages any `.prisma` file that matched the `glob` AND was modified — which is the intended behaviour for AC-2.
- **AC-3 leak-through risk.** `oxlint --fix {staged_files}` only touches the explicit file list. If oxlint had a `--all`-style fallback when no files are passed, an empty `{staged_files}` would lint the whole repo. Verified: `oxlint <empty-arg>` exits 1 with a usage error — no leak. Lefthook skips the command outright when `{staged_files}` matches no files in the `glob`, so the command is never invoked with empty args.

---

## Tasks

> 6 tasks. Each is intended to take 2–5 minutes. Run them in order; each ends with a `git add` + `git commit`. Task 6 is the final AC verification (no commit).

### Task 1 — Add `lefthook@2.1.6` to root `package.json` + `prepare` script [AC: AC-4]

**1a. `package.json`** (root — REPLACE FULL CONTENT):

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
    "start": "dotenv -c -e .env -e .env.local -- bun --filter=web run start",
    "start:web": "dotenv -c -e .env -e .env.local -- bun --filter=web run start",
    "lint": "oxlint",
    "lint:fix": "oxlint --fix",
    "typecheck": "turbo run typecheck",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "prepare": "lefthook install",
    "generate:tamagui-css": "bun --filter='@pekulo/ui' run generate:tamagui-css",
    "prisma:check": "cd apps/api && bun run prisma:check",
    "db:rls-audit": "cd apps/api && bun run db:rls-audit",
    "test:ui": "bun --filter='@pekulo/ui' run test",
    "test:ui:axe": "bun --filter='@pekulo/ui' run test:axe",
    "test:ui:visual": "bun --filter='@pekulo/ui' run test:visual"
  },
  "devDependencies": {
    "dotenv-cli": "^8.0.0",
    "lefthook": "2.1.6",
    "oxfmt": "0.47.0",
    "oxlint": "1.62.0",
    "turbo": "^2.9.6"
  },
  "packageManager": "bun@1.3.13"
}
```

**1b. Verify gitleaks is installed at the required version (system pre-req):**

```bash
gitleaks --version
```

Expected output: `8.18.0` or newer. If absent or older:
- macOS: `brew install gitleaks` (or `brew upgrade gitleaks`).
- Linux: `curl -sSL https://github.com/gitleaks/gitleaks/releases/latest/download/gitleaks_$(uname -m | sed 's/x86_64/linux_x64/;s/aarch64/linux_arm64/').tar.gz | sudo tar -xz -C /usr/local/bin gitleaks`.

> The dev MAY proceed without re-running this if the version is already ≥ 8.18.

**1c. Run the install:**

```bash
bun install
```

Expected output: `bun install` exits 0; `bun.lock` contains an entry for `lefthook@2.1.6`; `.git/hooks/pre-commit` exists and references lefthook.

**1d. Verify auto-install (this is the AC-4 gate):**

```bash
test -f .git/hooks/pre-commit && head -5 .git/hooks/pre-commit | grep -q lefthook \
  && echo "AC-4 PASS" || echo "AC-4 FAIL"
```

Expected output: `AC-4 PASS`.

Commit:

```bash
git add package.json bun.lock
git commit -m "feat(#11): add lefthook@2.1.6 devDep + prepare script"
```

---

### Task 2 — Create `lefthook.yml` (root) [AC: AC-2, AC-3, AC-5]

**2a. `lefthook.yml`** (root — NEW):

```yaml
# Pekulo pre-commit hooks — see docs/stories/0-11-precommit-secrets.md for the rationale.
#
# Hook order matters: gitleaks runs FIRST so a leaking commit is blocked before any auto-fixer
# rewrites the staged content. Auto-fixers run sequentially after, with stage_fixed: true so
# their rewrites land in the same commit.
#
# Bypass for emergencies (DISCOURAGED): LEFTHOOK=0 git commit ...

pre-commit:
  parallel: false
  commands:
    1_gitleaks:
      tags: security
      run: gitleaks git --pre-commit --staged --redact --verbose --config={root}/.gitleaks.toml
      fail_text: |
        🚫 gitleaks detected a potential secret in staged changes.
        Review the report above. If it is a false positive, add the file/regex to
        .gitleaks.toml's [allowlist] block, then re-stage and re-commit.
        Bypass for emergencies (DISCOURAGED): LEFTHOOK=0 git commit ...
    2_oxlint:
      tags: lint
      glob: "*.{js,jsx,ts,tsx,mjs,cjs}"
      run: bunx oxlint --fix {staged_files}
      stage_fixed: true
    3_oxfmt:
      tags: format
      glob: "*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml}"
      run: bunx oxfmt {staged_files}
      stage_fixed: true
    4_prisma_format:
      tags: format
      glob: "apps/api/prisma/**/*.prisma"
      run: bash -c '(cd apps/api && bun run prisma:format)'
      stage_fixed: true
```

**2b. Verify the config parses:**

```bash
bunx lefthook validate
```

Expected output: `lefthook` prints something equivalent to `Configuration is valid` (exact wording may vary across 2.x; any non-error output + exit 0 is accepted).

**2c. Smoke-test AC-5 (no-staged-files no-op):**

```bash
git commit --allow-empty -m "chore(#11): smoke-test no-op pre-commit"
git log -1 --format=%s
```

Expected output: the commit succeeds and `git log -1 --format=%s` prints `chore(#11): smoke-test no-op pre-commit`.

> If the smoke-test commit creates noise we do NOT want in the branch, run `git reset --soft HEAD~1` after observing the success — but the commit itself is small and harmless, so we keep it as part of the audit trail (it stays squash-mergeable at PR time).

Commit (the lefthook.yml file itself, separately from the smoke-test commit above):

```bash
git add lefthook.yml
git commit -m "feat(#11): add lefthook.yml with 4 pre-commit hooks (gitleaks, oxlint, oxfmt, prisma format)"
```

---

### Task 3 — Create `.gitleaks.toml` (root) [AC: AC-1]

**3a. `.gitleaks.toml`** (root — NEW):

```toml
# Pekulo extends the gitleaks default ruleset.
# See https://github.com/gitleaks/gitleaks#configuration

[extend]
useDefault = true

[allowlist]
description = "Pekulo allowlist — known-safe paths and patterns. Add false-positive rules here, never disable a default rule globally."
paths = [
  '''(.*?)\.example$''',
  '''apps/web/supabase/\.temp/linked-project\.json$''',
  '''docs/.*\.md$''',
  '''bun\.lock$''',
]
```

**3b. Verify the config loads (this is the AC-1 gate, part 1):**

```bash
gitleaks detect --config=.gitleaks.toml --no-banner --no-git --source=docs --redact --verbose
```

Expected output: `gitleaks` parses the config (no `Failed to parse` error), scans `docs/`, prints a summary line with `0 leaks found` (or any non-zero count if a real leak surfaces — in which case STOP and surface to the user). Exit code 0.

**3c. AC-1 leak-blocking smoke-test (using a stopword-clean fake key):**

```bash
FIXDIR=$(mktemp -d -t pekulo-leak)
echo 'AWS_ACCESS_KEY_ID=AKIAQYLPMN5HCQGZWXYZ' > "$FIXDIR/.env.leak"
gitleaks detect --config=.gitleaks.toml --no-banner --no-git --source="$FIXDIR" --redact >/dev/null 2>&1
LEAK_EXIT=$?
echo "AC-1 leak detection exit code: $LEAK_EXIT"
[ $LEAK_EXIT -ne 0 ] && echo "AC-1 PASS (leak detected)" || echo "AC-1 FAIL (leak missed)"
rm -rf "$FIXDIR"
```

Expected output: `aws-access-token` rule firing on the fake key; `AC-1 leak detection exit code: 1`; `AC-1 PASS (leak detected)`.

> The literal AWS docs canonical example `AKIAIOSFODNN7EXAMPLE` is auto-allowlisted by gitleaks' built-in stopword list (the `EXAMPLE` substring filters obvious doc keys). We use `AKIAQYLPMN5HCQGZWXYZ` — same shape (`AKIA` + 16 base32 chars), no stopword — so the rule actually fires.

> Note: this verification uses `--no-git` against a tmp directory because `gitleaks git --pre-commit` requires actually staging via git, which Task 6 covers end-to-end. AC-1's gate-via-lefthook will be re-verified in Task 6.

Commit:

```bash
git add .gitleaks.toml
git commit -m "feat(#11): add .gitleaks.toml extending defaults with Pekulo allowlist"
```

---

### Task 4 — Append `## Pre-commit hooks` section to `apps/web/README.md` [AC: AC-4 onboarding]

**4a. APPEND** the following block to the END of `apps/web/README.md` (after the existing "Deploy on Vercel" section — DO NOT touch any existing content):

```markdown

## Pre-commit hooks

This monorepo uses [lefthook](https://github.com/evilmartians/lefthook) + [gitleaks](https://github.com/gitleaks/gitleaks) + `oxlint` / `oxfmt` / `prisma format` to keep secrets out of git history and to keep formatting / lint stable across contributors. See `lefthook.yml` at the repo root for the canonical config and `docs/stories/0-11-precommit-secrets.md` for the design rationale.

### One-time setup

1. **Install gitleaks** (system binary — version `≥ 8.18`):
   - macOS: `brew install gitleaks`
   - Linux: download the latest release tarball from <https://github.com/gitleaks/gitleaks/releases> and place the `gitleaks` binary on `$PATH`.
   - Verify: `gitleaks --version` prints `8.18.0` or newer.
2. **Run `bun install` from the repo root.** The `prepare` script auto-runs `lefthook install`, which writes `.git/hooks/pre-commit` pointing at lefthook. No manual hook wiring needed.

### What runs on `git commit`

| Hook              | What it does                                                                          | When it runs                                              |
| ----------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `gitleaks`        | Scans the staged tree for secret patterns (AWS keys, JWTs, private keys, …) — fails the commit on match. | Always.                                                   |
| `oxlint --fix`    | Applies oxlint auto-fixes to staged JS/TS files; re-stages the result via `stage_fixed: true`. | Staged files match `*.{js,jsx,ts,tsx,mjs,cjs}`.           |
| `oxfmt`           | Applies oxfmt formatting to staged formattable files; re-stages the result.           | Staged files match `*.{js,jsx,ts,tsx,mjs,cjs,json,md,yml,yaml}`. |
| `prisma format`   | Formats `apps/api/prisma/schema/*.prisma` files in place; re-stages them.             | A `*.prisma` file under `apps/api/prisma/**/` is staged.  |

### Bypass (emergencies only — DISCOURAGED)

```bash
LEFTHOOK=0 git commit -m "wip: …"
```

Skips every hook. Use only when the dev machine cannot run gitleaks / lefthook (e.g. you are mid-rebase on a machine without the system binary). NEVER push a commit that bypassed gitleaks without re-running `gitleaks detect --source . --redact` first.
```

**4b. Verify oxfmt does not rewrite the README (idempotence check):**

```bash
bunx oxfmt apps/web/README.md
git status --porcelain apps/web/README.md
```

Expected output: `git status` shows the file as `M ` (modified-staged from the append), with NO additional rewrites by oxfmt — i.e. the line you just added is in the canonical oxfmt form. If oxfmt rewrites the appended block, fix the source above (e.g. trailing whitespace, smart quotes) and re-append.

Commit:

```bash
git add apps/web/README.md
git commit -m "docs(#11): document pre-commit hooks in apps/web/README.md"
```

---

### Task 5 — Append `## Pre-commit hooks` section to `apps/api/README.md` [AC: AC-4 onboarding]

**5a. APPEND** the following block to the END of `apps/api/README.md` (after the Prisma section — DO NOT touch any existing content):

```markdown

## Pre-commit hooks

This monorepo uses [lefthook](https://github.com/evilmartians/lefthook) + [gitleaks](https://github.com/gitleaks/gitleaks) + `oxlint` / `oxfmt` / `prisma format` to keep secrets out of git history and to keep formatting / lint stable across contributors. See `lefthook.yml` at the repo root for the canonical config and `docs/stories/0-11-precommit-secrets.md` for the design rationale.

### One-time setup

1. **Install gitleaks** (system binary — version `≥ 8.18`):
   - macOS: `brew install gitleaks`
   - Linux: download the latest release tarball from <https://github.com/gitleaks/gitleaks/releases> and place the `gitleaks` binary on `$PATH`.
   - Verify: `gitleaks --version` prints `8.18.0` or newer.
2. **Run `bun install` from the repo root.** The `prepare` script auto-runs `lefthook install`, which writes `.git/hooks/pre-commit` pointing at lefthook.

### Hooks relevant to `apps/api`

| Hook              | What it does                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `gitleaks`        | Scans the staged tree for secret patterns. Always runs — protects `.env`, JWT secrets, `DATABASE_URL`, etc.   |
| `oxlint --fix`    | Applies oxlint auto-fixes to staged `apps/api/src/**/*.ts` files.                                              |
| `oxfmt`           | Formats staged `apps/api/src/**/*.{ts,json,md,yml,yaml}` files.                                                |
| `prisma format`   | Runs `(cd apps/api && bun run prisma:format)` whenever any `apps/api/prisma/schema/*.prisma` file is staged. Re-stages the formatted schema files automatically. |

### Bypass (emergencies only — DISCOURAGED)

```bash
LEFTHOOK=0 git commit -m "wip: …"
```

Use only when the dev machine cannot run gitleaks / lefthook. NEVER push a commit that bypassed gitleaks without re-running `gitleaks detect --source . --redact` first.
```

Commit:

```bash
git add apps/api/README.md
git commit -m "docs(#11): document pre-commit hooks in apps/api/README.md"
```

---

### Task 6 — Final verification of AC-1, AC-2, AC-3, AC-4, AC-5 [AC: AC-1, AC-2, AC-3, AC-4, AC-5]

Run each verification block and confirm the expected output before pasting the captured terminal blocks into the PR description (no file commit needed for this task).

**AC-1 verification — gitleaks blocks a real staged secret end-to-end:**

```bash
echo "===== AC-1: gitleaks blocks staged secret ====="
echo 'AWS_ACCESS_KEY_ID=AKIAQYLPMN5HCQGZWXYZ' > leak-fixture.env
git add leak-fixture.env
git commit -m "leak test (should be blocked)" 2>&1 | tee /tmp/ac1.log
COMMIT_EXIT=${PIPESTATUS[0]}
git restore --staged leak-fixture.env
rm -f leak-fixture.env
if [ $COMMIT_EXIT -ne 0 ] && grep -q "aws-access-token\|gitleaks" /tmp/ac1.log; then
  echo "AC-1 PASS (commit blocked, gitleaks rule fired)"
else
  echo "AC-1 FAIL (exit=$COMMIT_EXIT)"
  cat /tmp/ac1.log
  exit 1
fi
```

> Stopword note: the fake key is `AKIAQYLPMN5HCQGZWXYZ`, NOT the AWS docs canonical `AKIAIOSFODNN7EXAMPLE` — the latter is in gitleaks' built-in stopword list (`EXAMPLE`) and is silently allowlisted. AC-1 still tests the same rule (`aws-access-token`) on the same shape.

Expected output: `AC-1 PASS (commit blocked, gitleaks rule fired)`.

**AC-2 verification — prisma format auto-rewrites + re-stages:**

```bash
echo "===== AC-2: prisma format auto-rewrites + re-stages ====="
ORIG=$(cat apps/api/prisma/schema/_base.prisma)
# Inject extra blank lines + indentation drift
{ echo "$ORIG"; echo ""; echo ""; echo "// trailing-noise"; } > apps/api/prisma/schema/_base.prisma
git add apps/api/prisma/schema/_base.prisma
git commit -m "fmt test (should auto-format)" 2>&1 | tail -10
# After the commit, the staged blob should equal the canonical format
EXPECTED=$( (cd apps/api && bun run prisma:format >/dev/null 2>&1) && cat apps/api/prisma/schema/_base.prisma )
ACTUAL=$(git show HEAD:apps/api/prisma/schema/_base.prisma)
if [ "$EXPECTED" = "$ACTUAL" ]; then
  echo "AC-2 PASS (committed blob matches canonical prisma format)"
else
  echo "AC-2 FAIL (diff between committed blob and canonical format)"
  diff <(echo "$EXPECTED") <(echo "$ACTUAL") | head -20
  exit 1
fi
# Restore the original schema for follow-up tasks
echo "$ORIG" > apps/api/prisma/schema/_base.prisma
git add apps/api/prisma/schema/_base.prisma
git commit -m "chore(#11): restore _base.prisma after AC-2 fmt test"
```

Expected output: `AC-2 PASS (committed blob matches canonical prisma format)`.

**AC-3 verification — oxlint + oxfmt run only on staged delta:**

```bash
echo "===== AC-3: oxlint+oxfmt mutate staged-only ====="
# Pick two sibling files that exist; introduce a violation in each.
A=apps/web/src/app/page.tsx
B=apps/web/src/app/layout.tsx
test -f "$A" && test -f "$B" || { echo "AC-3 SKIP (fixtures absent)"; exit 0; }
# Snapshot pristine state
git stash push -u -m "ac3-snapshot" -- "$A" "$B" >/dev/null 2>&1 || true
git stash pop >/dev/null 2>&1 || true
# Introduce mixed-quote violations
sed -i.bak '1s|^|// ac3-test "mixed" \x27quotes\x27\n|' "$A"
sed -i.bak '1s|^|// ac3-test "mixed" \x27quotes\x27\n|' "$B"
git add "$A"
B_PRE=$(md5 -q "$B" 2>/dev/null || md5sum "$B" | awk '{print $1}')
git commit -m "ac3 test (only $A should be touched)" 2>&1 | tail -5
B_POST=$(md5 -q "$B" 2>/dev/null || md5sum "$B" | awk '{print $1}')
if [ "$B_PRE" = "$B_POST" ]; then
  echo "AC-3 PASS (sibling unchanged on disk)"
else
  echo "AC-3 FAIL (sibling mutated)"
  exit 1
fi
# Cleanup: revert the test commit + the unstaged sibling
git reset --hard HEAD~1
git checkout -- "$A" "$B" 2>/dev/null
rm -f "${A}.bak" "${B}.bak"
```

Expected output: `AC-3 PASS (sibling unchanged on disk)`.

**AC-4 verification — `bun install` materialises `.git/hooks/pre-commit`:**

```bash
echo "===== AC-4: prepare → lefthook install ====="
rm -f .git/hooks/pre-commit
bun install >/dev/null 2>&1
if [ -f .git/hooks/pre-commit ] && head -5 .git/hooks/pre-commit | grep -q lefthook; then
  echo "AC-4 PASS"
else
  echo "AC-4 FAIL"
  exit 1
fi
```

Expected output: `AC-4 PASS`.

**AC-5 verification — empty `--allow-empty` succeeds:**

```bash
echo "===== AC-5: --allow-empty no-op ====="
git commit --allow-empty -m "ac5: no-op pre-commit smoke" 2>&1 | tail -10
RC=${PIPESTATUS[0]}
if [ $RC -eq 0 ]; then
  echo "AC-5 PASS"
  git reset --soft HEAD~1  # don't keep the smoke commit on the branch
else
  echo "AC-5 FAIL (exit=$RC)"
  exit 1
fi
```

Expected output: `AC-5 PASS`.

**No file commit for Task 6** — paste the five AC blocks into the PR description as evidence. If any check fails, fix the relevant config (lefthook.yml / .gitleaks.toml / package.json) and re-run from the failing block. Prior task commits stay.

---

## Dev Agent Record

- **Model:** {{model used}}
- **Started:** {{timestamp}}
- **Completed:** {{timestamp}}

### Debug Log

### Completion Notes

### File List
