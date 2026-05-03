# Story: 0-1-packages-reorg — Bootstrap workspaces under `@pekulo/*`

**Epic:** Epic 0 — Foundations (package layout, tooling, runtime substrate)
**Status:** review-queued
**Ticket:** [#1](https://github.com/yabafre/pekulo/issues/1)
**Branch:** `feat/0-1-packages-reorg`
**Commit prefix:** `feat(#1): ...`
**Closes:** #1
**Stepscompleted:** 1,2,3,4,5
**Reference ADR:** [ADR-0011 — Packages reorg under `@pekulo/*` namespace](../adr/0011-packages-reorg-pekulo-namespace.md)

---

## User Story

**As a** Pekulo developer, **I want** the seven `@pekulo/*` workspaces (`zod`, `types`, `validators`, `contracts`, `tsconfig`, `oxlint-config`, `ui`) created with placeholder exports plus `@pekulo/tsconfig` wired as the shared TypeScript base, **so that** every shared primitive lands in a single, importable location and downstream stories (0-2 → 0-12 and every feature epic) can depend on stable module identities without re-litigating the workspace layout.

---

## Acceptance Criteria

- **AC-1** **Given** a fresh checkout of the repository, **When** I run `bun install` from the repo root, **Then** Bun resolves all seven `@pekulo/*` workspaces with no errors and `bun pm ls` lists each one (`@pekulo/zod`, `@pekulo/types`, `@pekulo/validators`, `@pekulo/contracts`, `@pekulo/tsconfig`, `@pekulo/oxlint-config`, `@pekulo/ui`).

- **AC-2** **Given** `@pekulo/tsconfig` exists with the four presets (`base.json`, `apps.json`, `packages.json`, `next.json`), **When** I run `(cd packages/<pkg> && bun run typecheck)` for each of the six other packages (`zod`, `types`, `validators`, `contracts`, `oxlint-config`, `ui`), **Then** each package's `tsconfig.json` resolves the `extends "@pekulo/tsconfig/packages.json"` reference and `tsc --noEmit` exits 0 — confirming `strict: true` applies uniformly.

- **AC-3** **Given** the import hierarchy declared in ADR-0011 (`@pekulo/zod → @pekulo/validators → @pekulo/contracts → apps`, with `@pekulo/types` consumed bidirectionally), **When** I inspect each package's `dependencies` field in its `package.json`, **Then** `@pekulo/validators` lists `@pekulo/zod` and `@pekulo/types` as `workspace:*` dependencies, `@pekulo/contracts` lists `@pekulo/validators` and `@pekulo/types` as `workspace:*` dependencies, and the upstream packages (`@pekulo/zod`, `@pekulo/types`, `@pekulo/tsconfig`, `@pekulo/oxlint-config`, `@pekulo/ui`) declare zero `@pekulo/*` runtime dependencies.

---

## Dev Notes

### Existing code at write time

`package.json` (root, current — to MODIFY):

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
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

> The `workspaces` glob already includes `packages/*` — no change needed there. The `typecheck` script already pipes through Turborepo, which will pick up each new package's `typecheck` script automatically. The only required modification is leaving the root `package.json` untouched in this story (no script changes — the per-package `typecheck` scripts feed `turbo run typecheck`). The placeholder scaffold of `packages/.gitkeep` is removed.

`packages/.gitkeep` (current — to DELETE): empty file, brownfield placeholder.

`turbo.json` (current — NOT modified by this story, reproduced for reference):

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "envMode": "loose",
  "tasks": {
    "dev": { "inputs": ["$TURBO_DEFAULT$",".env.development.local",".env.local",".env.development",".env"], "cache": false, "persistent": true },
    "build": { "inputs": ["$TURBO_DEFAULT$",".env.production.local",".env.local",".env.production",".env"], "outputs": [".next/**", "!.next/cache/**"], "dependsOn": ["^build"] },
    "lint": { "dependsOn": ["^lint"] },
    "check-types": { "dependsOn": ["^check-types"] }
  }
}
```

> Note: the existing task is named `check-types`, but root scripts call `typecheck`. The packages use `typecheck` as their script name (matching the root) — Turborepo will run them via the root's `turbo run typecheck` invocation regardless of the `tasks` map (Turbo passes through unknown tasks to the workspaces). No `turbo.json` edit is required for this story; if a future story wires a strict `typecheck` task graph, that's its concern.

`apps/web/tsconfig.json` (current — NOT modified by this story, reproduced for the `next.json` preset design):

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"],
  "exclude": ["node_modules"]
}
```

> The `@pekulo/tsconfig/next.json` preset reproduces the strict subset of this file. Migrating `apps/web/tsconfig.json` to extend the preset is **out of scope** for this story (touches a brownfield app boundary; will be a follow-up).

### File decisions (3-bullet template per file)

#### `packages/tsconfig/package.json` — new
- **Single responsibility:** Manifest exposing the four shared TS preset JSONs as a private workspace package.
- **Inputs:** none (no source compilation).
- **Outputs:** `base.json`, `apps.json`, `packages.json`, `next.json` consumed via `extends "@pekulo/tsconfig/<preset>.json"` from sibling packages and (later) apps.

#### `packages/tsconfig/base.json` — new
- **Single responsibility:** Shared strict TypeScript compiler options used as the root `extends` of every preset.
- **Inputs:** none.
- **Outputs:** `compilerOptions: { strict: true, esModuleInterop: true, skipLibCheck: true, isolatedModules: true, moduleResolution: "bundler", target: "ES2022", forceConsistentCasingInFileNames: true, resolveJsonModule: true }`.

#### `packages/tsconfig/packages.json` — new
- **Single responsibility:** Preset for `packages/*` workspaces (ESM library, no emit, declaration files for downstream consumers).
- **Inputs:** `extends "./base.json"`.
- **Outputs:** `module: "esnext"`, `lib: ["esnext"]`, `noEmit: true`, `declaration: true`.

#### `packages/tsconfig/apps.json` — new
- **Single responsibility:** Preset for `apps/*` workspaces that target Node/Bun (e.g. `apps/api`, future `apps/mobile`'s server side).
- **Inputs:** `extends "./base.json"`.
- **Outputs:** `module: "esnext"`, `lib: ["esnext"]`, `noEmit: true`.

#### `packages/tsconfig/next.json` — new
- **Single responsibility:** Preset for Next.js apps (currently `apps/web`); reserved — not consumed by this story.
- **Inputs:** `extends "./apps.json"`.
- **Outputs:** `lib: ["dom", "dom.iterable", "esnext"]`, `jsx: "react-jsx"`, `plugins: [{ "name": "next" }]`, `incremental: true`, `allowJs: true`.

#### `packages/zod/package.json` — new
- **Single responsibility:** Manifest for `@pekulo/zod` (placeholder; future home of `Money`, `IsoDate`, `Percent`, `tabularNum`, `EuroAmount` per ADR-0011).
- **Inputs:** none (no `@pekulo/*` runtime deps; devDep on `@pekulo/tsconfig` and `typescript`).
- **Outputs:** `main: "./src/index.ts"`, `types: "./src/index.ts"`, `exports: { ".": "./src/index.ts" }`, `typecheck: "tsc --noEmit"`.

#### `packages/zod/src/index.ts` — new
- **Single responsibility:** Empty placeholder export so `tsc --noEmit` has at least one TS file to validate.
- **Inputs:** none.
- **Outputs:** `export {}` with a comment pointing to ADR-0011 for the future surface.

#### `packages/zod/tsconfig.json` — new
- **Single responsibility:** Local TS config that extends the shared `packages.json` preset and includes `src/**/*.ts`.
- **Inputs:** `extends "@pekulo/tsconfig/packages.json"`.
- **Outputs:** `include: ["src/**/*.ts"]`, `compilerOptions: { rootDir: "src" }`.

#### `packages/types/{package.json,src/index.ts,tsconfig.json}` — new
- **Single responsibility:** Same shape as `@pekulo/zod`; placeholder for shared TS types (`UserId`, `CompassSnapshot`, `LlmRoute`, etc. — ADR-0011).
- **Inputs:** none.
- **Outputs:** identical structure to `@pekulo/zod`.

#### `packages/validators/{package.json,src/index.ts,tsconfig.json}` — new
- **Single responsibility:** Placeholder for Zod schemas; declares `workspace:*` deps on `@pekulo/zod` + `@pekulo/types` per ADR-0011 hierarchy.
- **Inputs:** `dependencies: { "@pekulo/zod": "workspace:*", "@pekulo/types": "workspace:*" }`.
- **Outputs:** placeholder `export {}` + standard tsconfig.

#### `packages/contracts/{package.json,src/index.ts,tsconfig.json}` — new
- **Single responsibility:** Placeholder for oRPC contracts; declares `workspace:*` deps on `@pekulo/validators` + `@pekulo/types`.
- **Inputs:** `dependencies: { "@pekulo/validators": "workspace:*", "@pekulo/types": "workspace:*" }`.
- **Outputs:** placeholder `export {}` + standard tsconfig.

#### `packages/oxlint-config/{package.json,src/index.ts,tsconfig.json}` — new
- **Single responsibility:** Placeholder for Pekulo-specific oxlint rules (real content lands in story `0-12`).
- **Inputs:** none.
- **Outputs:** placeholder shape identical to `@pekulo/zod`.

#### `packages/ui/{package.json,src/index.ts,tsconfig.json}` — new
- **Single responsibility:** Placeholder for the Pekulo Design System (real Tamagui port lands in story `0-10`).
- **Inputs:** none.
- **Outputs:** placeholder shape identical to `@pekulo/zod`.

#### `packages/.gitkeep` — DELETE
- Brownfield placeholder, replaced by the seven real packages.

### Architecture references

- **ADR-0011** (`docs/adr/0011-packages-reorg-pekulo-namespace.md`) — canonical source for the seven-package layout and the import hierarchy enforced by AC-3.
- **Architecture Phase 4 — Directory Tree** (`docs/architecture.md` lines ≈852–877) — concrete `packages/*` shape.
- **Epic 0 backlog entry** (`docs/epics.md` Story `0-1-packages-reorg`) — original AC formulation; expanded here for testability.

### TypeScript pinning

All packages devDep on `typescript@^5.6.0`. This matches the major version family used by `apps/web` (TypeScript 5, per `docs/project-context.md`) without forcing an upgrade to `apps/web`'s declared range (`apps/web` carries its own TS dep — Bun hoists per workspace).

### Bun workspace protocol

Workspace deps use `"workspace:*"` (Bun-supported, identical semantics to pnpm/yarn). No version bumping needed when packages are co-located.

### Out of scope (explicit non-goals — do NOT do these in this story)

- ❌ Do NOT install Zod, Tamagui, oxc, or any runtime library. Every package is a placeholder; real surfaces ship in stories `0-2`, `0-4`, `0-9/0-10`, `0-12`.
- ❌ Do NOT migrate `apps/web/tsconfig.json` to extend `@pekulo/tsconfig/next.json`. That is a follow-up.
- ❌ Do NOT touch `apps/web` or `apps/prices` source.
- ❌ Do NOT add a CI workflow. Story `0-8` owns CI.
- ❌ Do NOT add lefthook hooks. Story `0-11` owns pre-commit.
- ❌ Do NOT rename the root package (`"name": "test"`). Out of scope.

---

## Tasks

> Each task is intended to take 2–5 minutes. Run them in order; each ends with a `git add` + `git commit`. The dev agent can interleave reads/checks but must complete each task's commit before moving on.

### Task 1 — Create `@pekulo/tsconfig` (4 JSON files) [AC: AC-2]

Create the four shared TS preset files under `packages/tsconfig/`.

**1a. `packages/tsconfig/package.json`** (new):

```json
{
  "name": "@pekulo/tsconfig",
  "version": "0.0.0",
  "private": true,
  "description": "Shared TypeScript presets for Pekulo workspaces (base, apps, packages, next).",
  "files": [
    "base.json",
    "apps.json",
    "packages.json",
    "next.json"
  ]
}
```

**1b. `packages/tsconfig/base.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "esnext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

**1c. `packages/tsconfig/packages.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "noEmit": true,
    "declaration": true
  }
}
```

**1d. `packages/tsconfig/apps.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["esnext"],
    "noEmit": true
  }
}
```

**1e. `packages/tsconfig/next.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./apps.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "jsx": "react-jsx",
    "incremental": true,
    "allowJs": true,
    "plugins": [{ "name": "next" }]
  }
}
```

Run: `bun install`
Expected output: contains `+ @pekulo/tsconfig@workspace:packages/tsconfig` (or equivalent line indicating the workspace was registered); exit 0.

Commit:
```bash
git add packages/tsconfig/package.json packages/tsconfig/base.json packages/tsconfig/apps.json packages/tsconfig/packages.json packages/tsconfig/next.json
git commit -m "feat(#1): bootstrap @pekulo/tsconfig with base/apps/packages/next presets"
```

---

### Task 2 — Create `@pekulo/zod` (3 files, placeholder) [AC: AC-1, AC-2]

**2a. `packages/zod/package.json`** (new):

```json
{
  "name": "@pekulo/zod",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo Zod helpers — placeholder; real surface lands in a follow-up story (see ADR-0011).",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**2b. `packages/zod/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/zod. Real surface (Money, IsoDate, EuroAmount, Percent,
// tabularNum + Zod v4 re-exports) lands in a follow-up story per ADR-0011.
export {};
```

**2c. `packages/zod/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/zod && bun run typecheck)`
Expected output: `bun install` exits 0; `(cd packages/zod && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/zod/package.json packages/zod/src/index.ts packages/zod/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/zod placeholder workspace"
```

---

### Task 3 — Create `@pekulo/types` (3 files, placeholder) [AC: AC-1, AC-2]

**3a. `packages/types/package.json`** (new):

```json
{
  "name": "@pekulo/types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo shared TypeScript types — placeholder; UserId, CompassSnapshot, LlmRoute, PriceQuote, MonthlyRecord land in follow-up stories per ADR-0011.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**3b. `packages/types/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/types. Real types (UserId, CompassSnapshot, LlmRoute,
// PriceQuote, MonthlyRecord, ...) land in follow-up stories per ADR-0011.
export {};
```

**3c. `packages/types/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/types && bun run typecheck)`
Expected output: `bun install` exits 0; `(cd packages/types && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/types/package.json packages/types/src/index.ts packages/types/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/types placeholder workspace"
```

---

### Task 4 — Create `@pekulo/validators` (3 files, deps on zod + types) [AC: AC-1, AC-2, AC-3]

**4a. `packages/validators/package.json`** (new):

```json
{
  "name": "@pekulo/validators",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo Zod schemas — placeholder; real schemas (createCompassSchema, recordValuationSchema, attestLlmCallSchema, ...) land in follow-up stories per ADR-0011.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pekulo/zod": "workspace:*",
    "@pekulo/types": "workspace:*"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**4b. `packages/validators/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/validators. Real Zod schemas land in follow-up stories
// per ADR-0011 (validators consume @pekulo/zod helpers and @pekulo/types brands).
export {};
```

**4c. `packages/validators/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/validators && bun run typecheck)`
Expected output: `bun install` resolves `@pekulo/zod` + `@pekulo/types` from the workspace (no network fetch for those names) and exits 0; `(cd packages/validators && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/validators/package.json packages/validators/src/index.ts packages/validators/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/validators with workspace deps on zod+types"
```

---

### Task 5 — Create `@pekulo/contracts` (3 files, deps on validators + types) [AC: AC-1, AC-2, AC-3]

**5a. `packages/contracts/package.json`** (new):

```json
{
  "name": "@pekulo/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo oRPC contracts — placeholder; real contracts (compassContract, holdingsContract, llmContract, ...) land in story 0-5 per ADR-0011.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@pekulo/validators": "workspace:*",
    "@pekulo/types": "workspace:*"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**5b. `packages/contracts/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/contracts. Real oRPC contracts (one sub-tree per
// Elysia module) land in story 0-5 per ADR-0011.
export {};
```

**5c. `packages/contracts/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/contracts && bun run typecheck)`
Expected output: `bun install` exits 0; `(cd packages/contracts && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/contracts/package.json packages/contracts/src/index.ts packages/contracts/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/contracts with workspace deps on validators+types"
```

---

### Task 6 — Create `@pekulo/oxlint-config` (3 files, placeholder) [AC: AC-1, AC-2]

**6a. `packages/oxlint-config/package.json`** (new):

```json
{
  "name": "@pekulo/oxlint-config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo shared oxlint rules — placeholder; custom rules (no-server-action-in-component, no-cross-feature-action-import, no-prisma-query-without-user-id, no-tailwind-outside-ui) land in story 0-12.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**6b. `packages/oxlint-config/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/oxlint-config. Real ruleset lands in story 0-12.
export {};
```

**6c. `packages/oxlint-config/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/oxlint-config && bun run typecheck)`
Expected output: `bun install` exits 0; `(cd packages/oxlint-config && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/oxlint-config/package.json packages/oxlint-config/src/index.ts packages/oxlint-config/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/oxlint-config placeholder workspace"
```

---

### Task 7 — Create `@pekulo/ui` (3 files, placeholder) [AC: AC-1, AC-2]

**7a. `packages/ui/package.json`** (new):

```json
{
  "name": "@pekulo/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "description": "Pekulo Design System (Tamagui Core) — placeholder; real DS lands in story 0-10 per ADR-0007.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "typescript": "^5.6.0"
  }
}
```

**7b. `packages/ui/src/index.ts`** (new):

```ts
// Placeholder for @pekulo/ui. Real Tamagui-backed Pekulo Design System lands
// in story 0-10 (ADR-0007); tokens ported from docs/ux-preview/src/tokens/.
export {};
```

**7c. `packages/ui/tsconfig.json`** (new):

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"]
}
```

Run: `bun install && (cd packages/ui && bun run typecheck)`
Expected output: `bun install` exits 0; `(cd packages/ui && bun run typecheck)` invokes `tsc --noEmit` and exits 0.

Commit:
```bash
git add packages/ui/package.json packages/ui/src/index.ts packages/ui/tsconfig.json
git commit -m "feat(#1): scaffold @pekulo/ui placeholder workspace"
```

---

### Task 8 — Remove `packages/.gitkeep` placeholder [AC: AC-1]

Now that the seven real packages exist, the brownfield `.gitkeep` is no longer needed.

Run:
```bash
git rm packages/.gitkeep
```
Expected output: `rm 'packages/.gitkeep'`.

Commit:
```bash
git commit -m "chore(#1): remove packages/.gitkeep — replaced by real @pekulo/* workspaces"
```

---

### Task 9 — Final verification of AC-1, AC-2, AC-3 [AC: AC-1, AC-2, AC-3]

Run each verification command and confirm the expected output before committing the verification log to the PR description (no file commit needed for this task).

**AC-1 verification:**
```bash
bun install
bun pm ls 2>&1 | grep '@pekulo/' | sort
```
Expected output (lines may include path suffixes; the seven names must all appear, alphabetically sorted):
```
@pekulo/contracts@workspace:packages/contracts
@pekulo/oxlint-config@workspace:packages/oxlint-config
@pekulo/tsconfig@workspace:packages/tsconfig
@pekulo/types@workspace:packages/types
@pekulo/ui@workspace:packages/ui
@pekulo/validators@workspace:packages/validators
@pekulo/zod@workspace:packages/zod
```
> If `bun pm ls` formats workspace entries differently in the installed Bun version, accept any output where each of the seven `@pekulo/<name>` strings appears at least once and `bun install` itself exited 0.

**AC-2 verification (run all six in sequence — `tsconfig` itself is JSON-only and has no `typecheck` script):**
```bash
for pkg in zod types validators contracts oxlint-config ui; do
  echo "--- typecheck: @pekulo/$pkg ---"
  (cd "packages/$pkg" && bun run typecheck) || { echo "FAIL: @pekulo/$pkg"; exit 1; }
done
echo "ALL TYPECHECKS PASSED"
```
Expected output (terminal):
```
--- typecheck: @pekulo/zod ---
--- typecheck: @pekulo/types ---
--- typecheck: @pekulo/validators ---
--- typecheck: @pekulo/contracts ---
--- typecheck: @pekulo/oxlint-config ---
--- typecheck: @pekulo/ui ---
ALL TYPECHECKS PASSED
```
Final exit code: 0. (`bun run typecheck` invokes `tsc --noEmit`; on success `tsc` produces no output.)

**AC-3 verification (read each `package.json`'s `dependencies` field and confirm the hierarchy):**
```bash
echo "--- @pekulo/validators dependencies ---"
bun -e 'const p = require("./packages/validators/package.json"); console.log(JSON.stringify(p.dependencies, null, 2))'
echo "--- @pekulo/contracts dependencies ---"
bun -e 'const p = require("./packages/contracts/package.json"); console.log(JSON.stringify(p.dependencies, null, 2))'
echo "--- upstream packages must declare zero @pekulo/* runtime deps ---"
for pkg in zod types tsconfig oxlint-config ui; do
  deps=$(bun -e "const p=require('./packages/$pkg/package.json'); console.log(JSON.stringify(p.dependencies||{}))")
  echo "$pkg: $deps"
done
```
Expected output (verbatim):
```
--- @pekulo/validators dependencies ---
{
  "@pekulo/zod": "workspace:*",
  "@pekulo/types": "workspace:*"
}
--- @pekulo/contracts dependencies ---
{
  "@pekulo/validators": "workspace:*",
  "@pekulo/types": "workspace:*"
}
--- upstream packages must declare zero @pekulo/* runtime deps ---
zod: {}
types: {}
tsconfig: {}
oxlint-config: {}
ui: {}
```

**No file commit for Task 9** — paste the three verification blocks into the PR description as evidence. If any command fails, fix the relevant package and re-run from Task 9 (the prior commits stay).

---

## Dev Agent Record

- **Model:** claude-opus-4-7 (1M context)
- **Started:** 2026-05-03
- **Completed:** 2026-05-03

### Debug Log

- **state.yaml YAML lint fix.** MCP `aped_state.advance` initially failed with `yq parse error at line 242` because `6-1-llm-routing-and-providers:{ status: pending,` was missing the space between the key colon and the flow-style mapping `{`. Fixed in-place (1-char insertion) — pre-existing bug from `aped-epics`, not introduced by this story; flagged for follow-up.
- **Bun `--cwd` after `run` is broken; the `cd` form is canonical.** Initial invocations used `bun --cwd packages/<pkg> run typecheck`; under Bun 1.3.13 this dumps the `bun run --help` text and **does not actually invoke `tsc`** — it exits 0 without running the script (Eva probed in aped-review by injecting `const x: string = 42` and confirmed the `--cwd`-after-`run` form silently passes while the `(cd packages/<pkg> && bun run typecheck)` form correctly raises `error TS2322`). The Dev Agent Record originally claimed both forms ran the script — that was wrong. All Run lines have been corrected to the `cd` form, and the verification block below was re-captured by the aped-review Lead using the `cd` form. Lesson: `bun --cwd` only works as a global flag *before* the subcommand (e.g. `bun --cwd packages/zod install`); after `run`, Bun reinterprets `--cwd` as an unknown flag.

### Completion Notes

- All 9 tasks shipped one-commit-per-task on `feat/0-1-packages-reorg` (8 commits — Task 9 is verification-only, no commit per spec).
- Story-level RED witnessed before any scaffold (no `@pekulo/*` workspace registered, no per-package `package.json` present). Per-task RED witnessed before each scaffold (`packages/<pkg>` did not exist).
- AC-1, AC-2, AC-3 verified verbatim — output captured in PR body and matches the story's "Expected output" blocks.
- **Out-of-scope finding (not blocking, not fixed):** root `bun run typecheck` (= `turbo run typecheck`) fails with `Could not find task typecheck` because `turbo.json` declares the task as `check-types`, not `typecheck`. The Dev Notes flagged this divergence and stated turbo should pass-through unknown tasks — that's no longer true in Turbo 2.x. Verified the failure pre-existed before any commit on this branch (via `git stash` on the work-in-progress + re-run). AC-2 explicitly tests per-package invocation (`(cd packages/<pkg> && bun run typecheck)`) which all pass; this is properly out-of-scope and should be picked up by story 0-8 (CI workflows) or a focused follow-up.
- No regressions: `apps/web` typecheck (`tsc --noEmit`) still exits 0; no source files in `apps/web` or `apps/prices` were touched.

### File List

**New (24 files across 7 packages):**

- `packages/tsconfig/{package.json, base.json, apps.json, packages.json, next.json}`
- `packages/zod/{package.json, src/index.ts, tsconfig.json}`
- `packages/types/{package.json, src/index.ts, tsconfig.json}`
- `packages/validators/{package.json, src/index.ts, tsconfig.json}`
- `packages/contracts/{package.json, src/index.ts, tsconfig.json}`
- `packages/oxlint-config/{package.json, src/index.ts, tsconfig.json}`
- `packages/ui/{package.json, src/index.ts, tsconfig.json}`

**Deleted:**

- `packages/.gitkeep`

**Modified:**

- `bun.lock` (workspace registration only — no new external deps)
- `docs/state.yaml` (line 242 YAML lint fix + dev phase + story status flips)

### Verification output (re-captured by aped-review Lead, `cd` form — supersedes the dev's original capture which used the broken `bun --cwd` form)

```
===== AC-1: bun pm ls | grep '@pekulo/' | sort =====
├── @pekulo/contracts@workspace:packages/contracts
├── @pekulo/oxlint-config@workspace:packages/oxlint-config
├── @pekulo/tsconfig@workspace:packages/tsconfig
├── @pekulo/types@workspace:packages/types
├── @pekulo/ui@workspace:packages/ui
├── @pekulo/validators@workspace:packages/validators
├── @pekulo/zod@workspace:packages/zod
(7/7 expected workspaces present)

===== AC-2: per-package typecheck — `(cd packages/<pkg> && bun run typecheck)` =====
--- @pekulo/zod ---           $ tsc --noEmit  (exit 0)
--- @pekulo/types ---         $ tsc --noEmit  (exit 0)
--- @pekulo/validators ---    $ tsc --noEmit  (exit 0)
--- @pekulo/contracts ---     $ tsc --noEmit  (exit 0)
--- @pekulo/oxlint-config --- $ tsc --noEmit  (exit 0)
--- @pekulo/ui ---            $ tsc --noEmit  (exit 0)
ALL TYPECHECKS PASSED

===== AC-2 strict-mode probe (proves strict TS is actually applied) =====
echo 'const x: string = 42;' > packages/zod/src/_probe.ts
(cd packages/zod && bun run typecheck)
→ src/_probe.ts(1,7): error TS2322: Type 'number' is not assignable to type 'string'.   exit 2 ✓

===== AC-3: dependency hierarchy =====
zod: {}
types: {}
validators: {"@pekulo/zod":"workspace:*","@pekulo/types":"workspace:*"}
contracts:  {"@pekulo/validators":"workspace:*","@pekulo/types":"workspace:*"}
tsconfig: {}
oxlint-config: {}
ui: {}
```
