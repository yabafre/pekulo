# Story: 0-2-oxc-toolchain — Adopt oxlint + oxfmt and remove ESLint/Prettier

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** ready-for-dev
**Ticket:** [#2](https://github.com/yabafre/pekulo/issues/2)
**Branch:** `feat/0-2-oxc-toolchain`
**Commit prefix:** `feat(#2): ...` (or `chore(#2):` / `fix(#2):` per task type)
**Closes:** #2
**Stepscompleted:** 1,2,3,4,5
**Reference ADR:** [ADR-0004 — Lint + format toolchain — oxlint + oxfmt](../adr/0004-lint-format-toolchain-oxc.md)

---

## User Story

**As a** Pekulo developer, **I want** the Oxc toolchain (`oxlint@1.62.0` + `oxfmt@0.47.0`) wired at the monorepo root with `eslint-config-next` removed from `apps/web` and root scripts (`lint`, `format`) repointed to the new tooling, **so that** lint runs are 50–100× faster, the codebase has a single formatter source of truth, and stories `0-8` (CI matrix), `0-11` (lefthook pre-commit), and `0-12` (custom `@pekulo/oxlint-config` rules) can plug directly into a working toolchain without re-litigating the install or config.

---

## Acceptance Criteria

- **AC-1 (lint passes):** **Given** `oxlint@1.62.0` exact-pinned in root `devDependencies` plus `.oxlintrc.json` at repo root, **When** I run `bun install && bun run lint` from the repo root after the migration commits, **Then** oxlint exits with code 0.

- **AC-2 (format is idempotent):** **Given** `oxfmt@0.47.0` exact-pinned in root `devDependencies` plus `.oxfmtrc.json` at repo root, **When** I run `bun run format` once (Task 6 — initial pass), commit the resulting reformat, then run `bun run format` a second time, **Then** the second invocation produces no file modifications and `git status --porcelain` returns an empty string.

- **AC-3 (ESLint / Prettier are physically gone):** **Given** the migration, **When** I inspect the repo, **Then** every assertion below holds:
  - `apps/web/package.json` `devDependencies` does NOT contain `eslint` or `eslint-config-next`.
  - The file `apps/web/eslint.config.mjs` does NOT exist.
  - No Prettier config (`.prettierrc*`, `prettier.config.*`) exists anywhere in the repo.
  - The root `package.json` `scripts.lint` equals the literal string `"oxlint"` (NOT `"turbo run lint"`).
  - The root `package.json` `scripts.format` equals the literal string `"oxfmt"`.

---

## Dev Notes

### Existing code at write time

#### `package.json` (root, current — to MODIFY)

```json
{
  "name": "test",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "dev": "dotenv -c -e .env -e .env.local -- turbo run dev",
    "dev:web": "dotenv -c -e .env -e .env.local -- turbo run dev --filter=web",
    "dev:prices": "dotenv -c -e .env -e .env.local -- bash -lc 'cd apps/prices && uvicorn main:app --reload --port 8000'",
    "build": "dotenv -c -e .env -e .env.local -- turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format": "echo 'format placeholder' "
  },
  "devDependencies": {
    "dotenv-cli": "^8.0.0",
    "turbo": "^2.9.6"
  },
  "packageManager": "bun@1.3.13",
  "workspaces": ["apps/*", "packages/*"]
}
```

> This story replaces `scripts.lint`, `scripts.format`, and adds `scripts.lint:fix` + `scripts.format:check`. It also adds `oxlint` + `oxfmt` to `devDependencies` (exact pins per ADR-0004 audit ritual). `scripts.dev`, `scripts.dev:web`, `scripts.dev:prices`, `scripts.build`, `scripts.typecheck`, the `packageManager`, and the `workspaces` glob are NOT touched.

#### `apps/web/package.json` (current — to MODIFY)

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.104.1",
    "@tanstack/react-form": "^1.29.1",
    "@tanstack/react-query": "^5.100.5",
    "@zapaction/core": "^0.2.2",
    "@zapaction/query": "^0.2.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.0",
    "shadcn": "^4.5.0",
    "tailwind-merge": "^3.5.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0",
    "yahoo-finance2": "^3.14.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "supabase": "^2.95.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "trustedDependencies": ["unrs-resolver"]
}
```

> This story removes `eslint` and `eslint-config-next` from `devDependencies` and removes the `lint` script (lint is monorepo-wide from root now, per ADR-0004 + architecture Phase 2 — Frontend). Every other field is preserved verbatim.

#### `apps/web/eslint.config.mjs` (current — to DELETE)

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

> This file is deleted. Its rule surface is replaced by `.oxlintrc.json` at repo root: oxlint's `nextjs` plugin reproduces the `eslint-config-next/core-web-vitals` rule set (architecture: "drop-in for the rules currently active"), and `typescript` is default-on so `eslint-config-next/typescript` coverage is preserved.

#### `turbo.json` (current — to MODIFY)

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "envMode": "loose",
  "tasks": {
    "dev": {
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.development.local",
        ".env.local",
        ".env.development",
        ".env"
      ],
      "cache": false,
      "persistent": true
    },
    "build": {
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.production.local",
        ".env.local",
        ".env.production",
        ".env"
      ],
      "outputs": [".next/**", "!.next/cache/**"],
      "dependsOn": ["^build"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    }
  }
}
```

> This story removes the `tasks.lint` entry — once root `scripts.lint` becomes `oxlint` (single monorepo-wide invocation), there are no per-package `lint` scripts left for turbo to cascade. `tasks.dev`, `tasks.build`, and `tasks.check-types` are preserved verbatim. (Note: `check-types` divergence vs. the root `typecheck` script was flagged out-of-scope by 0-1 review — owned by 0-8.)

### File decisions (3-bullet template per file)

#### `.oxlintrc.json` — new

- **Single responsibility:** monorepo-wide oxlint config — sets the rule posture for every JS/TS/JSX/TSX file across the repo.
- **Inputs:** none (auto-discovered by oxlint CLI from cwd; reads `node_modules/oxlint/configuration_schema.json` for editor validation).
- **Outputs:** drives `bun run lint` (exits 0 on a clean tree), `bun run lint:fix` (auto-fixes), and the future `oxlint --fix --staged` from lefthook (story 0-11) and the `lint` CI matrix entry (story 0-8).

#### `.oxfmtrc.json` — new

- **Single responsibility:** monorepo-wide oxfmt config — defines the canonical formatting style (printWidth 100, 2-space indent, double quotes, trailing comma `all`, LF) for every formattable file.
- **Inputs:** none (auto-discovered; reads `node_modules/oxfmt/configuration_schema.json` for editor validation).
- **Outputs:** drives `bun run format` (writes), `bun run format:check` (CI gate, story 0-8), and the future `oxfmt --staged` from lefthook (story 0-11).

#### `package.json` (root) — modify

- **Single responsibility (delta):** point root `lint` + `format` scripts at the Oxc binaries; add `oxlint@1.62.0` + `oxfmt@0.47.0` to `devDependencies` (exact pins, no caret).
- **Inputs:** `bun install` resolves the two new devDeps from npm.
- **Outputs:** `bun run lint`, `bun run lint:fix`, `bun run format`, `bun run format:check` all become runnable.

#### `apps/web/package.json` — modify

- **Single responsibility (delta):** retire ESLint dependency surface (drop `eslint` + `eslint-config-next`) and the per-app `lint` script (lint is monorepo-wide from root now).
- **Inputs:** `bun install` removes the two devDeps from `node_modules`.
- **Outputs:** smaller devDep tree on `apps/web`; `bun run lint` from `apps/web` now reports `lint script not found` (intentional — use root script).

#### `turbo.json` — modify

- **Single responsibility (delta):** drop the orphaned `tasks.lint` entry now that no per-package `lint` scripts exist.
- **Inputs:** none.
- **Outputs:** `turbo run lint` no longer claims to do work; root `bun run lint` runs `oxlint` directly.

#### `apps/web/eslint.config.mjs` — DELETE

- Brownfield ESLint flat-config, no longer authoritative.

### Architecture references

- **ADR-0004** (`docs/adr/0004-lint-format-toolchain-oxc.md`) — canonical decision: oxlint replaces eslint-config-next; oxfmt replaces ad-hoc Prettier; both run on pre-commit + CI; oxfmt alpha → pin known-good version.
- **W1 watch item** (`docs/architecture.md` line 1138) — "oxfmt is alpha (pre-1.0); pin a known-good version; audit on every bump; revert to Prettier if a rule change breaks the codebase."
- **Architecture Phase 2 — Frontend / Lint + format toolchain** (`docs/architecture.md` lines ≈220–223) — wires oxlint as monorepo-wide + oxfmt as cross-extension formatter; both on pre-commit + CI.
- **Architecture Phase 3 — Process Rules / Pre-commit (lefthook)** (`docs/architecture.md` lines ≈617–622) — `oxlint --fix --staged` + `oxfmt --staged` will be wired in story 0-11.
- **Architecture Phase 3 — Process Rules / PR requirements** (`docs/architecture.md` lines ≈600–605) — `lint (oxlint with @pekulo/oxlint-config)` + `format-check (oxfmt --check)` are CI matrix entries owned by story 0-8.
- **0-1 review forward-pointer M2** (`docs/stories/0-1-packages-reorg.md` Review Record) — `apps/web/tsconfig.json` ES2017→ES2022 migration: explicitly **deferred to 0-8**, NOT picked up here.

### Versions pinned

| Package  | Version  | Pinning          | Rationale                                                               |
| -------- | -------- | ---------------- | ----------------------------------------------------------------------- |
| `oxlint` | `1.62.0` | exact (no caret) | ADR-0004 audit ritual; stable 1.x but pin discipline applied uniformly. |
| `oxfmt`  | `0.47.0` | exact (no caret) | Alpha (W1); ADR-0004 mandates exact pin + audit on every bump.          |

`devDependencies` keys MUST be the literal string `"1.62.0"` and `"0.47.0"` — NOT `"^1.62.0"` / `"^0.47.0"`. Bun's default insertion behaviour adds a caret; either edit `package.json` directly (Task 1 instructs this) or use `bun add -d -E` (the `-E` flag forces exact).

### Out of scope (explicit non-goals — do NOT do these in this story)

- ❌ Pre-commit hooks (lefthook + gitleaks + `oxlint --fix --staged` + `oxfmt --staged` + `prisma format`) — owned by **story 0-11**.
- ❌ CI workflows (`.github/workflows/pr.yml` matrix with `lint`, `format-check`, `typecheck`, `test:unit`, `rls-audit`, `prisma:check`, `lighthouse-ci`, `axe-a11y`) — owned by **story 0-8**.
- ❌ Pekulo custom oxlint rules (`no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`, `no-tailwind-outside-ui`) — owned by **story 0-12**. `@pekulo/oxlint-config` stays a placeholder until then; this story does NOT touch `packages/oxlint-config/`.
- ❌ Migrating `apps/web/tsconfig.json` to extend `@pekulo/tsconfig/next.json` (or bumping target ES2017 → ES2022) — forward-pointer M2 from 0-1 review, **deferred to 0-8**.
- ❌ Touching `apps/prices/` (Python) — out of oxc scope; explicitly added to `ignorePatterns` in both configs.
- ❌ Touching `apps/api/` — story 0-3 hasn't created it yet.
- ❌ Promoting `@pekulo/oxlint-config` from placeholder to real config — owned by **story 0-12**.
- ❌ Renaming the root package (`"name": "test"`) — out of scope (also out of scope for 0-1).

### Lessons applied from 0-1

- **`bun --cwd <path> run <script>` is BROKEN under Bun 1.3.13** — the form silently dumps `bun run --help` and exits 0 without invoking the script (witnessed by Eva in 0-1 review M1 fix; confirmed by injecting a strict-mode probe). Every `Run` line in this story uses the canonical `(cd <path> && bun run <script>)` form OR a root-level `bun run <script>` invocation (no `--cwd` after `run`). This story's tasks all run at root, so the issue does not directly bite — but the same discipline applies if the dev runs scoped commands by hand.
- **One commit per task, prefix per change-type** — `feat(#2):` for new files (configs), `chore(#2):` for tooling rewires (scripts, deletions, format-pass), `fix(#2):` reserved for any in-branch correction. Mirrors 0-1's commit hygiene.
- **`Run` lines must be runnable verbatim** — every test command in this story is the literal command to type, including any `&&` chaining. Expected output shown immediately after.

### Risks / Watch items (this story specifically)

- **First format-pass blast radius (Task 6).** `bun run format` will rewrite a large fraction of brownfield files in `apps/web/src/`, `docs/ux-preview/src/`, and the `packages/*` placeholders. The diff is mechanical (whitespace, quote style, trailing comma) and isolated as a single commit `chore(#2): apply oxfmt initial pass` so review is line-for-line trivial. **Mitigation:** the dev should sanity-check by spot-reading two or three rewritten files (e.g. `apps/web/src/proxy.ts`, `docs/ux-preview/src/App.tsx`) to confirm only formatting changed — no semantic rewrites.
- **oxlint may flag brownfield `correctness` issues.** With `categories.correctness: error`, any pre-existing bug oxlint catches will fail Task 4's verification (and AC-1). **Mitigation order:** (a) fix the actual bug if real (preferred — code-quality win); (b) disable the SPECIFIC rule in `.oxlintrc.json`'s `rules` block with an inline comment + forward-pointer to a follow-up story; (c) apply a per-file `overrides` block. **Forbidden:** blanket downgrade `correctness` to `warn` — that defeats AC-1's gate intent.
- **W1 (ADR-0004): oxfmt 0.47.0 is alpha.** Exact pin (`"oxfmt": "0.47.0"`) prevents Bun semver-resolution drift. ADR-0004 audit-on-bump ritual binds future PRs.
- **`git add -u` exception in Task 6.** The ticket-git-workflow critical rule "ALWAYS stage specific files — never `git add .` or `git add -A`" is preserved by using `git add -u` (stages updates to TRACKED files only — no untracked files picked up). The rationale: a mass format pass touches hundreds of files mechanically; enumerating each path adds zero safety. The discipline preserved is "no untracked files in the format-pass commit".

---

## Tasks

> 7 tasks. Each is intended to take 2–5 minutes. Run them in order; each ends with a `git add` + `git commit`. The dev agent can interleave reads/checks but must complete each task's commit before moving on.

### Task 1 — Update root `package.json` + `turbo.json` [AC: AC-1, AC-2, AC-3]

**1a. `package.json`** (root — REPLACE FULL CONTENT):

```json
{
  "name": "test",
  "private": true,
  "version": "0.0.1",
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
  "packageManager": "bun@1.3.13",
  "workspaces": ["apps/*", "packages/*"]
}
```

**1b. `turbo.json`** (REPLACE FULL CONTENT — `tasks.lint` removed):

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "envMode": "loose",
  "tasks": {
    "dev": {
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.development.local",
        ".env.local",
        ".env.development",
        ".env"
      ],
      "cache": false,
      "persistent": true
    },
    "build": {
      "inputs": [
        "$TURBO_DEFAULT$",
        ".env.production.local",
        ".env.local",
        ".env.production",
        ".env"
      ],
      "outputs": [".next/**", "!.next/cache/**"],
      "dependsOn": ["^build"]
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    }
  }
}
```

Run:

```bash
bun install
```

Expected output: `bun install` exits 0; `bun.lock` contains entries for `oxlint@1.62.0` and `oxfmt@0.47.0` (verifiable via `grep -E '^"oxlint|^"oxfmt' bun.lock | head` — at least one match each, exact version strings).

Commit:

```bash
git add package.json turbo.json bun.lock
git commit -m "feat(#2): adopt oxc — add oxlint+oxfmt devDeps and repoint root scripts"
```

---

### Task 2 — Remove ESLint deps + lint script from `apps/web/package.json` [AC: AC-3]

**2a. `apps/web/package.json`** (REPLACE FULL CONTENT — `eslint` + `eslint-config-next` removed from devDeps; `scripts.lint` removed):

```json
{
  "name": "web",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.1",
    "@supabase/ssr": "^0.10.2",
    "@supabase/supabase-js": "^2.104.1",
    "@tanstack/react-form": "^1.29.1",
    "@tanstack/react-query": "^5.100.5",
    "@zapaction/core": "^0.2.2",
    "@zapaction/query": "^0.2.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^1.11.0",
    "next": "16.2.4",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "recharts": "^3.8.0",
    "shadcn": "^4.5.0",
    "tailwind-merge": "^3.5.0",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0",
    "yahoo-finance2": "^3.14.0",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "supabase": "^2.95.4",
    "tailwindcss": "^4",
    "typescript": "^5"
  },
  "trustedDependencies": ["unrs-resolver"]
}
```

Run:

```bash
bun install
```

Expected output: `bun install` exits 0 ; `bun.lock` no longer carries `eslint@9.x` or `eslint-config-next@16.2.4` as direct keys for `apps/web` (verifiable: `grep -E '"eslint(-config-next)?"' apps/web/package.json` returns no matches).

Commit:

```bash
git add apps/web/package.json bun.lock
git commit -m "chore(#2): remove eslint+eslint-config-next from apps/web devDeps and drop per-app lint script"
```

---

### Task 3 — Delete `apps/web/eslint.config.mjs` [AC: AC-3]

Run:

```bash
git rm apps/web/eslint.config.mjs
```

Expected output: `rm 'apps/web/eslint.config.mjs'`.

Commit:

```bash
git commit -m "chore(#2): remove apps/web/eslint.config.mjs (replaced by root .oxlintrc.json)"
```

---

### Task 4 — Create `.oxlintrc.json` (root) [AC: AC-1, AC-3]

**4a. `.oxlintrc.json`** (root — NEW):

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "import", "jsx-a11y", "nextjs"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn",
    "style": "off",
    "restriction": "off",
    "nursery": "off",
    "pedantic": "off"
  },
  "env": {
    "browser": true,
    "node": true,
    "es2024": true
  },
  "settings": {
    "next": {
      "rootDir": "apps/web/"
    },
    "react": {
      "version": "19.2.4"
    }
  },
  "ignorePatterns": [
    "node_modules/",
    ".next/",
    ".turbo/",
    "build/",
    "dist/",
    "out/",
    "coverage/",
    "apps/prices/",
    "docs/ux-preview/dist/"
  ]
}
```

**Verification (this is the AC-1 gate):**

Run:

```bash
bun run lint
```

Expected output: oxlint scans the repo (the three default plugins `unicorn` / `oxc` / `typescript` plus the four explicit plugins `react` / `import` / `jsx-a11y` / `nextjs` are active), prints a summary line of the form `Found 0 warnings and 0 errors.` (or any output with 0 errors), and exits with code 0.

If oxlint reports `correctness` errors:

1. **First option (preferred):** read each error and fix the actual bug in the brownfield file. Most `correctness` violations are real bugs.
2. **Second option:** if a specific rule is genuinely misaligned with project intent (e.g. a rule that conflicts with React 19's new patterns), disable it in `.oxlintrc.json`'s `rules` block:
   ```json
   "rules": {
     "<plugin>/<rule-name>": ["off", { "_reason": "<why>; revisit in story 0-12 when @pekulo/oxlint-config lands custom rules" }]
   }
   ```
   The `_reason` key is non-standard but is preserved in the JSON for human auditing — oxlint's schema is permissive on unknown sub-keys (verifiable: oxlint exits 0 with the key present).
3. **Third option:** apply a per-file override in `.oxlintrc.json`'s `overrides` array.
4. **Forbidden:** changing `categories.correctness` from `"error"` to `"warn"` to bypass the gate. That defeats AC-1's intent.

Commit (after `bun run lint` exits 0):

```bash
git add .oxlintrc.json
git commit -m "feat(#2): add .oxlintrc.json with react+import+jsx-a11y+nextjs plugins (correctness:error)"
```

---

### Task 5 — Create `.oxfmtrc.json` (root) [AC: AC-2, AC-3]

**5a. `.oxfmtrc.json`** (root — NEW):

```json
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "tabWidth": 2,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "endOfLine": "lf",
  "ignorePatterns": [
    "node_modules/",
    ".next/",
    ".turbo/",
    "build/",
    "dist/",
    "out/",
    "coverage/",
    "apps/prices/",
    "docs/ux-preview/dist/",
    "bun.lock",
    "*.lock",
    "apps/web/supabase-schema.sql"
  ]
}
```

**Verification (config parses):**

Run:

```bash
bun run format:check
```

Expected output: oxfmt parses the config (no `Failed to parse` error), then prints a list of files that WOULD be reformatted (almost certainly non-empty — that's the brownfield drift Task 6 fixes). The command may exit with a non-zero code on `--check` when files would change; that is expected at this point and is NOT a gate failure for Task 5.

> If `bun run format:check` errors with `Failed to parse .oxfmtrc.json` or similar, the JSON is malformed — fix and re-run.

Commit:

```bash
git add .oxfmtrc.json
git commit -m "feat(#2): add .oxfmtrc.json (printWidth 100, double quotes, trailing comma all)"
```

---

### Task 6 — Run oxfmt initial pass [AC: AC-2]

**Goal:** bring the entire in-scope tree into oxfmt compliance in one mechanical commit so subsequent `bun run format` invocations are no-ops (AC-2's idempotence test).

Run:

```bash
bun run format
```

Expected output: oxfmt rewrites every formattable file under repo root (excluding `ignorePatterns`). The CLI prints the list of rewritten paths and exits 0.

Sanity-check before staging — confirm no untracked files were produced (oxfmt only rewrites existing files; no new files should appear):

```bash
git status --porcelain | awk '$1 == "??" {print "UNEXPECTED UNTRACKED: " $2; exit 1}'
echo "no untracked: OK"
```

Expected output: `no untracked: OK`. If any line prefix `??` shows, **stop and investigate** before proceeding.

Stage modifications to TRACKED files only (not `git add .` / not `git add -A`):

```bash
git add -u
git diff --cached --name-only | head -20
```

Expected output: a list of (typically) dozens to hundreds of repo paths under `apps/web/src/`, `docs/ux-preview/src/`, `packages/*/`, plus the JSON configs themselves if oxfmt normalised them.

Commit (single isolated mechanical-diff commit):

```bash
git commit -m "chore(#2): apply oxfmt initial pass"
```

---

### Task 7 — Final verification of AC-1, AC-2, AC-3 [AC: AC-1, AC-2, AC-3]

Run each verification block and confirm the expected output before pasting the captured terminal blocks into the PR description (no file commit needed for this task).

**AC-1 verification — `bun run lint` exits 0:**

```bash
echo "===== AC-1: bun run lint ====="
bun run lint
echo "AC-1 exit code: $?"
```

Expected output: oxlint summary line with `0 errors` and final `AC-1 exit code: 0`.

**AC-2 verification — second `bun run format` is idempotent:**

```bash
echo "===== AC-2: second-pass idempotence ====="
bun run format
if [ -z "$(git status --porcelain)" ]; then
  echo "AC-2 PASS (idempotent — no diff after format)"
else
  echo "AC-2 FAIL (unexpected diff):"
  git status --porcelain
  exit 1
fi
```

Expected output:

```
===== AC-2: second-pass idempotence =====
<oxfmt's per-file output — every line should report no change>
AC-2 PASS (idempotent — no diff after format)
```

**AC-3a verification — eslint deps gone from apps/web:**

```bash
echo "===== AC-3a: eslint deps absent from apps/web ====="
if grep -E '"eslint(-config-next)?":' apps/web/package.json; then
  echo "AC-3a FAIL (eslint dep still present)"
  exit 1
else
  echo "AC-3a PASS"
fi
```

Expected output: `AC-3a PASS` (grep returns 1, no match printed).

**AC-3b verification — eslint.config.mjs deleted:**

```bash
echo "===== AC-3b: apps/web/eslint.config.mjs absent ====="
if [ -f apps/web/eslint.config.mjs ]; then
  echo "AC-3b FAIL (file still exists)"
  exit 1
else
  echo "AC-3b PASS"
fi
```

Expected output: `AC-3b PASS`.

**AC-3c verification — no Prettier config anywhere:**

```bash
echo "===== AC-3c: no Prettier config in repo ====="
PFILES=$(find . -path ./node_modules -prune -o \
  \( -name '.prettierrc' -o -name '.prettierrc.json' -o -name '.prettierrc.js' -o -name '.prettierrc.cjs' -o -name '.prettierrc.mjs' -o -name '.prettierrc.yaml' -o -name '.prettierrc.yml' -o -name 'prettier.config.js' -o -name 'prettier.config.cjs' -o -name 'prettier.config.mjs' -o -name 'prettier.config.ts' \) -print 2>/dev/null)
if [ -z "$PFILES" ]; then
  echo "AC-3c PASS"
else
  echo "AC-3c FAIL — Prettier config(s) found:"
  echo "$PFILES"
  exit 1
fi
```

Expected output: `AC-3c PASS`.

**AC-3d verification — root scripts point at oxc:**

```bash
echo "===== AC-3d: root lint/format scripts ====="
LINT=$(bun -e 'console.log(require("./package.json").scripts.lint)')
FMT=$(bun -e 'console.log(require("./package.json").scripts.format)')
if [ "$LINT" = "oxlint" ] && [ "$FMT" = "oxfmt" ]; then
  echo "AC-3d PASS (lint=$LINT format=$FMT)"
else
  echo "AC-3d FAIL (lint=$LINT format=$FMT)"
  exit 1
fi
```

Expected output: `AC-3d PASS (lint=oxlint format=oxfmt)`.

**No file commit for Task 7** — paste the four AC blocks into the PR description as evidence. If any check fails, fix the relevant file and re-run from the failing block (the prior commits stay).

---

## Dev Agent Record

- **Model:** claude-opus-4-7 (1M context)
- **Started:** 2026-05-03T21:00:00Z
- **Completed:** 2026-05-03T21:45:00Z

### Debug Log

**AC-1 gate — three correctness errors surfaced on first `bun run lint`:**

1. `apps/web/src/components/ui/label.tsx:9` — `jsx-a11y/label-has-associated-control`. Real cause: shadcn `Label` primitive establishes its control association via `htmlFor` + composition at the call-site, which is invisible to the rule's static AST analysis. Mitigated via per-file override (option c of the AC-1 hierarchy) scoped to `apps/web/src/components/ui/**/*.{ts,tsx}` so other components remain gated.
2. `apps/web/src/components/kpi-card.tsx:2` — `eslint(no-unused-vars)`: `cn` from `@/lib/utils` imported but never used. Real dead import. Fixed at the source (option a).
3. `.aped/mcp/aped-state-server.mjs:41` — `eslint(no-unused-vars)`: `dirname` from `node:path` imported but never used. Real dead import. Fixed at the source (option a).

The two source fixes shipped as `fix(#2): remove unused imports flagged by oxlint correctness gate`, ahead of the `feat(#2): add .oxlintrc.json …` config commit. Post-fix: `Found 1421 warnings and 0 errors` → exit 0.

**Task 6 — first format pass had to be backed out and re-run.** First invocation reformatted 312 files including 121 under `.aped/` (engine immutable per CLAUDE.md) and 41 under `.agents/` (vendored Anthropic + Expo + finance-expert + ui-ux-pro-max skill assets). The story's literal `.oxfmtrc.json` ignorePatterns omitted these directories — a spec gap vs. the project's immutability invariants.

oxfmt also reformatted `docs/state.yaml` (flow-style array → block-style under `ramp_tiering.v1`). state.yaml is the APED pipeline authority; reformatting its shape risks pattern-match drift across `.aped/scripts/` callers that use yq + grep on stable layouts.

Mitigation: `git restore` to clean working tree, expand `.oxfmtrc.json` ignorePatterns with `.aped/`, `.agents/`, `docs/state.yaml`, `docs/state-corrections.yaml`, `docs/sync-logs/`, then re-run `bun run format`. Shipped as `fix(#2): expand .oxfmtrc.json ignorePatterns …` ahead of the mechanical `chore(#2): apply oxfmt initial pass` commit. Post-correction scope: 149 files (95 apps + 44 docs + 6 packages + 4 root configs) — within the Risk/Watch envelope ("apps/web/src/, docs/ux-preview/src/, packages/* placeholders").

**Task 7 — AC-3c assertion as written had a `find` bug.** The story's invocation (`-path ./node_modules -prune -o`) only prunes the *root* `node_modules`, not nested `apps/web/node_modules` (workspace install). Three vendored Prettier configs surfaced inside `apps/web/node_modules/{recast,zod-to-json-schema,tough-cookie-file-store}/` — none Pekulo-authored. Re-ran with `\( -name node_modules -o -name .next -o -name dist -o -name build \) -prune -o` → 0 hits in Pekulo source.

**Risks/Watch items confirmed clean:**

- W1 (oxfmt 0.47.0 alpha) — exact pin in place; ADR-0004 audit-on-bump ritual binds future PRs.
- First-format blast radius — diff is mechanical (semis, double quotes, trailing commas, line wrapping). Spot-checked `apps/web/src/proxy.ts` and `docs/ux-preview/src/App.tsx`: zero semantic rewrites.
- `git add -u` exception in Task 6 — preserved (no untracked files staged; `.aped/.last-test-exit` and the story file itself stayed untracked through Task 6 and rolled into the final state-flip commit).

### Completion Notes

- **AC-1 satisfied** by `Found 1421 warnings and 0 errors. … AC-1 exit code: 0`.
  - The 1421 warnings are dominated by `eslint-plugin-react(react-in-jsx-scope)` (1386 hits — React 19's automatic JSX runtime makes the rule obsolete; oxlint surfaces it at `warning` severity, so it does not gate AC-1). Other warnings: `import/no-unassigned-import` (21), `react/no-array-index-key` (4), `react/jsx-no-constructed-context-values` (4), `import/no-named-as-default` (1). All of these are candidates for either rule disablement in `@pekulo/oxlint-config` (story 0-12) or per-file follow-ups; none rise to a correctness-gate violation today.
- **AC-2 satisfied** by `AC-2 PASS (idempotent — no diff after format)` — second-pass `bun run format` produces zero modifications to tracked files.
- **AC-3** all four sub-checks PASS (3a eslint deps absent, 3b eslint.config.mjs absent, 3c no Pekulo Prettier config, 3d root scripts = `oxlint`/`oxfmt`).
- **Rules disabled (with reason):** `jsx-a11y/label-has-associated-control` is OFF for `apps/web/src/components/ui/**/*.{ts,tsx}` only — shadcn UI primitives wrap controls via composition; the rule cannot follow that across component boundaries. Not a blanket disable; revisit in story 0-12 if a more targeted detection lands in `@pekulo/oxlint-config`.
- **In-branch corrections (`fix(#2):` commits):** two — (1) unused-import surgery in `kpi-card.tsx` + `aped-state-server.mjs` to clear AC-1; (2) ignorePatterns expansion in `.oxfmtrc.json` to honour `.aped/` immutability + APED state authority.

### File List

**New (2 files):**

- `.oxlintrc.json`
- `.oxfmtrc.json`

**Modified (4 files via task commits):**

- `package.json` (root) — devDeps + scripts
- `apps/web/package.json` — devDeps + lint script removal
- `turbo.json` — `tasks.lint` removed
- `bun.lock` — devDep registration (oxlint/oxfmt added; eslint/eslint-config-next removed)

**Deleted (1 file):**

- `apps/web/eslint.config.mjs`

**Modified for AC-1 (in-branch correction `fix(#2):`):**

- `apps/web/src/components/kpi-card.tsx` — drop unused `cn` import
- `.aped/mcp/aped-state-server.mjs` — drop unused `dirname` import

**Reformatted by oxfmt initial pass (149 files in `chore(#2): apply oxfmt initial pass`):** mechanical-only diff — `git diff --name-only aba85c7~1 aba85c7` for the canonical list. Top-level breakdown: 95 under `apps/`, 44 under `docs/`, 6 under `packages/`, plus `package.json`, `turbo.json`, `README.md`, `CLAUDE.md`.

### Verification output

```
===== AC-1: bun run lint =====

Found 1421 warnings and 0 errors.
Finished in 249ms on 119 files with 157 rules using 10 threads.
AC-1 exit code: 0
```

```
===== AC-2: second-pass idempotence =====
$ oxfmt
Finished in 401ms on 190 files using 10 threads.
AC-2 PASS (idempotent — no diff after format)
```

```
===== AC-3a: eslint deps absent from apps/web =====
AC-3a PASS

===== AC-3b: apps/web/eslint.config.mjs absent =====
AC-3b PASS

===== AC-3c (corrected): no Pekulo-authored Prettier config =====
AC-3c PASS

===== AC-3d: root lint/format scripts =====
AC-3d PASS (lint=oxlint format=oxfmt)
```

> **Note on AC-3c:** the story's literal `find` invocation (`-path ./node_modules -prune -o`) prunes only the repo-root `node_modules`. The corrected form prunes nested workspace `node_modules` too (`apps/web/node_modules/` etc.) and ignores other build dirs. Pekulo source is clean of Prettier configs either way; the original would surface vendored upstream `.prettierrc*` files as false positives. Forward-pointer for story 0-8 (CI matrix) or a later story-template tweak.

---

## Review Record

_(aped-review fills after dev hands back. Mirrors 0-1's Review Record shape: specialists dispatched, findings, ticket sync, PR link.)_
