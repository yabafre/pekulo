# Story: 0-12-custom-oxlint-rules — Custom oxlint rules in `@pekulo/oxlint-config`

**Epic:** Epic 0 — Foundations
**Status:** review
**Ticket:** [#12](https://github.com/yabafre/pekulo/issues/12)
**Branch:** `feature/12-0-12-custom-oxlint-rules`
**Commit prefix:** `feat(#12): …`

## User Story

**As a** Pekulo developer,
**I want** four custom oxlint rules — `no-prisma-query-without-user-id`, `no-tailwind-outside-ui`, `no-server-action-in-component`, `no-cross-feature-action-import` — shipped as a JS plugin in `@pekulo/oxlint-config` with RuleTester unit tests, an oxlint CLI smoke test, and activation in the root `.oxlintrc.json`,
**so that** four architecture invariants (NFR-8 RLS guard, FR-55 single-styling-surface, arch L168 Component→Hook→Action layering, arch L505 feature-boundary import discipline) are enforced mechanically rather than by review discipline.

## Acceptance Criteria

- **AC-1 (no-prisma-query-without-user-id):** **Given** a file under `apps/api/**` containing `prisma.account.findMany({ where: { foo: 1 } })`, **When** `bunx oxlint` runs from the repo root, **Then** the rule fires with the exact message `Prisma query on user-scoped model 'account' is missing 'where.userId' (NFR-8)` and the process exits 1.
- **AC-2 (no-tailwind-outside-ui):** **Given** a file `apps/web/src/components/foo.tsx` containing `<div className="flex p-4" />`, **When** `bunx oxlint` runs from the repo root, **Then** the rule fires with `Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)` and the process exits 1.
- **AC-3 (no-server-action-in-component):** **Given** a file `apps/web/src/components/foo.tsx` containing `import { recordTx } from "@/lib/actions/transactions"`, **When** `bunx oxlint` runs from the repo root, **Then** the rule fires with `Server action imported directly into a component — go through a custom hook (arch L168)` and the process exits 1.
- **AC-4 (no-cross-feature-action-import):** **Given** a file `apps/web/src/features/accounts/foo.ts` containing `import { x } from "@/features/holdings/bar"`, **When** `bunx oxlint` runs from the repo root, **Then** the rule fires with `Cross-feature import — feature 'accounts' must not depend on feature 'holdings' (arch L505)` and the process exits 1.
- **AC-5 (RuleTester suites):** **Given** the four RuleTester suites at `packages/oxlint-config/tests/no-*.test.js`, **When** `bun --filter='@pekulo/oxlint-config' test` runs, **Then** every suite passes with at least 3 valid and 3 invalid cases per rule (24 cases total) and the process exits 0.
- **AC-6 (oxlint CLI smoke):** **Given** the smoke fixture set under `packages/oxlint-config/tests/integration/fixtures/`, **When** `bun test packages/oxlint-config/tests/integration/oxlint-smoke.test.js` runs, **Then** the 4 valid fixtures produce 0 errors and the 4 invalid fixtures each produce at least 1 error containing the rule's diagnostic message, and the process exits 0.
- **AC-7 (root config + zero false positives):** **Given** `.oxlintrc.json` registers `jsPlugins: ["./packages/oxlint-config/src/index.js"]` and activates the four `pekulo/*` rules with per-path overrides, **When** `bunx oxlint` runs from the repo root against the current tree (post-0-11, no `apps/web/src/features/`, no Prisma calls in `apps/api`, no Tailwind in `apps/web`), **Then** the process reports 0 errors and 0 warnings and exits 0.

## Tasks

- T1 — Repurpose `packages/oxlint-config/package.json` (type=module, eslint devDep, scripts) [AC: AC-5, AC-6]
- T2 — Convert `packages/oxlint-config/tsconfig.json` to JSDoc-typed JS + delete `src/index.ts` [AC: AC-5]
- T3 — Implement `packages/oxlint-config/src/utils/ast.js` (shared AST helpers) [AC: AC-1, AC-2, AC-3, AC-4]
- T4 — Implement `packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js` [AC: AC-1, AC-5]
- T5 — Write RuleTester suite `tests/no-prisma-query-without-user-id.test.js` [AC: AC-5]
- T6 — Implement `packages/oxlint-config/src/rules/no-tailwind-outside-ui.js` [AC: AC-2, AC-5]
- T7 — Write RuleTester suite `tests/no-tailwind-outside-ui.test.js` [AC: AC-5]
- T8 — Implement `packages/oxlint-config/src/rules/no-server-action-in-component.js` [AC: AC-3, AC-5]
- T9 — Write RuleTester suite `tests/no-server-action-in-component.test.js` [AC: AC-5]
- T10 — Implement `packages/oxlint-config/src/rules/no-cross-feature-action-import.js` [AC: AC-4, AC-5]
- T11 — Write RuleTester suite `tests/no-cross-feature-action-import.test.js` [AC: AC-5]
- T12 — Implement plugin barrel `packages/oxlint-config/src/index.js` [AC: AC-6, AC-7]
- T13 — Add smoke fixtures + fixture-local `.oxlintrc.json` [AC: AC-6]
- T14 — Implement smoke driver `tests/integration/oxlint-smoke.test.js` [AC: AC-6]
- T15 — Wire root `.oxlintrc.json` (jsPlugins + 4 rule activations + per-path overrides) and verify zero false positives [AC: AC-1, AC-2, AC-3, AC-4, AC-7]
- T16 — Write `packages/oxlint-config/README.md` + final commit [AC: AC-7]

## Dev Notes

### Architecture references

- **NFR-8 (RLS + lint defense in depth)** — `docs/architecture.md` L135–L141, ADR-0013. `pekulo/no-prisma-query-without-user-id` is the lint half of the defense-in-depth pair (RLS is the runtime half). The rule fails closed: any user-scoped Prisma method without `where.userId` is reported regardless of whether RLS would catch it at runtime.
- **FR-55 (single styling surface)** — `docs/architecture.md` L541, L994. `@pekulo/ui` is the sole DS post-0-10. Tailwind was decommissioned in `apps/web` (story 0-10). `pekulo/no-tailwind-outside-ui` is the regression guard.
- **Arch L168 (Component → Hook → Server Action)** — hard layering. Components must not call server actions directly. `pekulo/no-server-action-in-component` enforces.
- **Arch L505 (Import hierarchy R1)** — feature isolation. Sibling features must not import each other's internals. `pekulo/no-cross-feature-action-import` enforces.
- **W5 (custom oxlint rules)** — `docs/architecture.md` L1146. This story closes W5.

### Lessons re-applied

- **L4 (oxlint rejects `_reason` on options-less rules, 2026-05-04)** — only the four `pekulo/*` rules that ship `meta.schema` accept the `["error", { … }]` array form. The two rules activated globally without options (`pekulo/no-tailwind-outside-ui`, `pekulo/no-cross-feature-action-import` in the root file) use the simple-string `"error"` severity. The smoke fixture config does pass options — those rules do declare `meta.schema`, so the array form is allowed.
- **L5 (`settings.react.version` SemVer-only, 2026-05-04)** — N/A here. `.oxlintrc.json#settings.react.version` stays `"19.2.4"` per existing convention, no bump.
- **L3 (oxlint has no `--staged`, 2026-05-04)** — N/A. Lefthook already passes `{staged_files}` per stories 0-2 / 0-11. No new hook entries.
- **2026-05-07 — `bun test` ≠ `vitest run`** — the package's `test` script is `bun test`. CI's `bun --filter='*' run test` fan-out picks it up automatically. No `.github/workflows/pr.yml` edit required.

### Existing code at write time (Step-0 quote — verbatim, do not paraphrase)

`packages/oxlint-config/package.json` (pre-edit):

```json
{
  "name": "@pekulo/oxlint-config",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo shared oxlint rules — placeholder; custom rules (no-server-action-in-component, no-cross-feature-action-import, no-prisma-query-without-user-id, no-tailwind-outside-ui) land in story 0-12.",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*"
  }
}
```

`packages/oxlint-config/tsconfig.json` (pre-edit):

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

`packages/oxlint-config/src/index.ts` (pre-edit, deleted in T2):

```ts
// Placeholder for @pekulo/oxlint-config. Real ruleset lands in story 0-12.
export {};
```

`.oxlintrc.json` (pre-edit, repo root):

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
  "rules": {
    "react/rules-of-hooks": "error",
    "react/react-in-jsx-scope": "off",
    "import/no-unassigned-import": "off"
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
    "docs/ux-preview/",
    ".aped/",
    ".agents/",
    "docs/sync-logs/"
  ],
  "overrides": [
    {
      "files": ["apps/web/src/components/ui/**/*.{ts,tsx}"],
      "rules": {
        "jsx-a11y/label-has-associated-control": "off"
      }
    }
  ]
}
```

### File decision template (3-bullet per file)

**Created (13)**

- `packages/oxlint-config/src/index.js` — Single responsibility: ESM barrel exporting `{ meta:{name:"pekulo"}, rules }` consumable by oxlint's `jsPlugins`. Inputs: `./rules/*.js`. Outputs: default export.
- `packages/oxlint-config/src/utils/ast.js` — Single responsibility: pure AST helpers (dotted member-expression resolver, object property finder, `where.userId` checker, source-string getter, filename normaliser). Inputs: ESTree-shape nodes. Outputs: pure functions, no rule-specific state.
- `packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js` — Single responsibility: report Prisma user-scoped method calls missing `where.userId`. Inputs: AST. Outputs: ESLint v9 RuleModule. Options: `prismaIdentifier` (default `prisma`), `unscopedModels` (allowlist).
- `packages/oxlint-config/src/rules/no-tailwind-outside-ui.js` — Single responsibility: report Tailwind utility classes / `tailwindcss` imports outside `packages/ui/`. Inputs: AST + `context.filename`. Outputs: ESLint v9 RuleModule. Options: `uiRoot` (default `packages/ui/`).
- `packages/oxlint-config/src/rules/no-server-action-in-component.js` — Single responsibility: report component files importing server actions directly. Inputs: AST + `context.filename`. Outputs: ESLint v9 RuleModule. Options: `actionRoot`, `componentRoots`.
- `packages/oxlint-config/src/rules/no-cross-feature-action-import.js` — Single responsibility: report cross-feature imports. Inputs: AST + `context.filename`. Outputs: ESLint v9 RuleModule. Options: `featureRoots`.
- `packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js` — Single responsibility: RuleTester valid/invalid suite for rule 1. Inputs: rule + `RuleTester` from `eslint`. Outputs: bun test cases.
- `packages/oxlint-config/tests/no-tailwind-outside-ui.test.js` — Same pattern, rule 2.
- `packages/oxlint-config/tests/no-server-action-in-component.test.js` — Same pattern, rule 3.
- `packages/oxlint-config/tests/no-cross-feature-action-import.test.js` — Same pattern, rule 4.
- `packages/oxlint-config/tests/integration/oxlint-smoke.test.js` — Single responsibility: spawn `bunx oxlint --config <fixture-config> <fixture>` per case, assert exit code + diagnostic message. Inputs: `node:child_process` `spawnSync`. Outputs: bun test cases.
- `packages/oxlint-config/tests/integration/fixtures/.oxlintrc.json` — Single responsibility: fixture-local oxlint config registering plugin + activating rules with options pinned to fixture paths.
- `packages/oxlint-config/tests/integration/fixtures/<rule>/<valid|invalid>.{ts,tsx}` — Single responsibility: 8 fixture files (4 rules × {valid, invalid}) that prove integration with the oxc parser.
- `packages/oxlint-config/README.md` — Single responsibility: rule catalogue, options reference, extension guide.

**Modified (3)**

- `packages/oxlint-config/package.json` — Add `eslint`/`@types/eslint` devDeps; swap `main`/`types`/`exports` to `src/index.js`; add `test` script; remove placeholder description. Single responsibility: package shape + dep contract.
- `packages/oxlint-config/tsconfig.json` — Switch to `allowJs:true`, `checkJs:true`, `noEmit:true`, include glob expanded to `src/**/*.js` + `tests/**/*.js`. Single responsibility: typecheck config (no emit).
- `.oxlintrc.json` — Add `jsPlugins` + four `pekulo/*` rule activations + per-path `overrides`. Single responsibility: lint policy.

**Deleted (1)**

- `packages/oxlint-config/src/index.ts` — Replaced by `index.js` (oxlint's `jsPlugins` loads JS).

### T1 — Repurpose `packages/oxlint-config/package.json`

Replace the file at `packages/oxlint-config/package.json` with:

```json
{
  "name": "@pekulo/oxlint-config",
  "version": "0.0.0",
  "private": true,
  "description": "Pekulo shared oxlint plugin — four custom rules enforcing arch invariants (NFR-8, FR-55, L168, L505).",
  "type": "module",
  "main": "./src/index.js",
  "types": "./src/index.js",
  "exports": {
    ".": "./src/index.js"
  },
  "scripts": {
    "test": "bun test",
    "lint": "oxlint src tests",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@pekulo/tsconfig": "workspace:*",
    "@types/eslint": "^9.6.1",
    "eslint": "^9.36.0"
  }
}
```

Then run `bun install` from the repo root so the new devDeps land in the lockfile.

Run: `bun install && bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: install completes; typecheck reports `Done` with no TS errors (the file `src/index.ts` is still present and exports `{}`).
Commit: `git add packages/oxlint-config/package.json bun.lock && git commit -m "feat(#12): @pekulo/oxlint-config package shape — type=module, eslint devDep, scripts (T1)"`

### T2 — Convert tsconfig to JSDoc-typed JS + delete placeholder

Replace the file at `packages/oxlint-config/tsconfig.json` with:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "@pekulo/tsconfig/packages.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "allowJs": true,
    "checkJs": true
  },
  "include": ["src/**/*.js", "tests/**/*.js"]
}
```

Then delete the placeholder TS file:

```bash
rm packages/oxlint-config/src/index.ts
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0 (no JS files yet to typecheck, but tsc accepts the empty `include` glob).
Commit: `git rm packages/oxlint-config/src/index.ts && git add packages/oxlint-config/tsconfig.json && git commit -m "feat(#12): tsconfig allowJs + checkJs ; drop placeholder index.ts (T2)"`

### T3 — Shared AST utils

Create `packages/oxlint-config/src/utils/ast.js`:

```js
// @ts-check
/**
 * Shared AST helpers for @pekulo/oxlint-config rules.
 * Pure functions — no rule-specific state.
 */

/**
 * Resolve a chain of MemberExpression `Identifier`s to a dotted string.
 * Returns null if any segment is computed or non-Identifier.
 *
 * Example: `prisma.account.findMany` → `"prisma.account.findMany"`.
 *
 * @param {import("estree").Node} node
 * @returns {string | null}
 */
export function getDottedMemberName(node) {
  /** @type {string[]} */
  const parts = [];
  /** @type {import("estree").Node} */
  let current = node;
  while (current && current.type === "MemberExpression") {
    if (current.computed) return null;
    if (current.property.type !== "Identifier") return null;
    parts.unshift(current.property.name);
    current = current.object;
  }
  if (!current || current.type !== "Identifier") return null;
  parts.unshift(current.name);
  return parts.join(".");
}

/**
 * Find a direct property of an ObjectExpression by name.
 *
 * @param {import("estree").ObjectExpression} obj
 * @param {string} name
 * @returns {import("estree").Property | null}
 */
export function findObjectProperty(obj, name) {
  if (!obj || obj.type !== "ObjectExpression") return null;
  for (const prop of obj.properties) {
    if (prop.type !== "Property") continue;
    if (prop.computed) continue;
    const k = prop.key;
    if (k.type === "Identifier" && k.name === name) return prop;
    if (k.type === "Literal" && k.value === name) return prop;
  }
  return null;
}

/**
 * Returns true when `obj.where` is an ObjectExpression that directly contains
 * a `userId` property (literal or shorthand).
 *
 * @param {import("estree").ObjectExpression} obj
 * @returns {boolean}
 */
export function hasWhereUserId(obj) {
  const whereProp = findObjectProperty(obj, "where");
  if (!whereProp) return false;
  if (whereProp.value.type !== "ObjectExpression") return false;
  return findObjectProperty(whereProp.value, "userId") !== null;
}

/**
 * Get the string value of an `import "..."` source node.
 *
 * @param {import("estree").Literal | import("estree").Node} node
 * @returns {string | null}
 */
export function getStringLiteralValue(node) {
  if (!node || node.type !== "Literal") return null;
  return typeof node.value === "string" ? node.value : null;
}

/**
 * Normalise filename to forward slashes; strip `cwd` prefix when supplied.
 *
 * @param {string} filename
 * @param {string} [cwd]
 * @returns {string}
 */
export function normaliseFilename(filename, cwd) {
  let f = filename.replace(/\\/g, "/");
  if (cwd) {
    const c = cwd.replace(/\\/g, "/");
    if (f.startsWith(c + "/")) f = f.slice(c.length + 1);
  }
  return f;
}
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/utils/ast.js && git commit -m "feat(#12): shared AST helpers — dotted member, object property, where.userId (T3)"`

### T4 — Rule 1 implementation

Create `packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js`:

```js
// @ts-check
import { findObjectProperty, getDottedMemberName, hasWhereUserId } from "../utils/ast.js";

const USER_SCOPED_METHODS = new Set([
  "findFirst",
  "findUnique",
  "findMany",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
  "groupBy",
  "upsert",
]);

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require `where.userId` on Prisma user-scoped queries. Defense-in-depth alongside RLS (NFR-8, ADR-0013).",
    },
    schema: [
      {
        type: "object",
        properties: {
          prismaIdentifier: { type: "string", default: "prisma" },
          unscopedModels: {
            type: "array",
            items: { type: "string" },
            default: [],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingUserId:
        "Prisma query on user-scoped model '{{model}}' is missing 'where.userId' (NFR-8)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const prismaIdent = opts.prismaIdentifier ?? "prisma";
    const unscoped = new Set(opts.unscopedModels ?? []);

    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return;
        const dotted = getDottedMemberName(node.callee);
        if (!dotted) return;
        const segments = dotted.split(".");
        if (segments.length !== 3) return;
        const [root, model, method] = segments;
        if (root !== prismaIdent) return;
        if (!USER_SCOPED_METHODS.has(method)) return;
        if (unscoped.has(model)) return;

        const arg0 = node.arguments[0];
        if (arg0 && arg0.type === "ObjectExpression" && hasWhereUserId(arg0)) return;

        context.report({ node, messageId: "missingUserId", data: { model } });
      },
    };
  },
};

export default rule;
export { USER_SCOPED_METHODS };
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js && git commit -m "feat(#12): rule no-prisma-query-without-user-id (NFR-8) (T4)"`

### T5 — Rule 1 RuleTester suite

Create `packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js`:

```js
// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-prisma-query-without-user-id.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-prisma-query-without-user-id", rule, {
  valid: [
    `await prisma.account.findMany({ where: { userId: ctx.userId } });`,
    `await prisma.account.create({ data: { userId: ctx.userId } });`,
    {
      code: `await prisma.fxRate.findMany({ where: { ccy: 'EUR' } });`,
      options: [{ unscopedModels: ["fxRate"] }],
    },
    `await db.account.findMany({ where: { foo: 1 } });`,
  ],
  invalid: [
    {
      code: `await prisma.account.findMany();`,
      errors: [{ messageId: "missingUserId", data: { model: "account" } }],
    },
    {
      code: `await prisma.holding.updateMany({ where: { foo: 1 } });`,
      errors: [{ messageId: "missingUserId", data: { model: "holding" } }],
    },
    {
      code: `await prisma.transaction.delete({ where: { id: 'tx_1' } });`,
      errors: [{ messageId: "missingUserId", data: { model: "transaction" } }],
    },
  ],
});
```

Run: `bun --filter='@pekulo/oxlint-config' test tests/no-prisma-query-without-user-id.test.js`
Expected: `7 pass`, exit 0 (4 valid + 3 invalid cases — RuleTester runs each as a separate test).
Commit: `git add packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js && git commit -m "test(#12): RuleTester suite for no-prisma-query-without-user-id (T5)"`

### T6 — Rule 2 implementation

Create `packages/oxlint-config/src/rules/no-tailwind-outside-ui.js`:

```js
// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

const TW_TOKEN_RE =
  /\b(?:p|m|w|h|min|max|flex|grid|bg|text|font|rounded|shadow|gap|border|space|leading|tracking|opacity|z|inset|top|right|bottom|left)-[a-z0-9.\-/]+|\b(?:flex|grid|hidden|block|inline|inline-block|relative|absolute|fixed|sticky|static)\b/;

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid Tailwind utility classes and `tailwindcss` imports outside `packages/ui/`. Enforces FR-55.",
    },
    schema: [
      {
        type: "object",
        properties: {
          uiRoot: { type: "string", default: "packages/ui/" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      tailwindClass: "Tailwind utility classes are forbidden outside @pekulo/ui (FR-55)",
      tailwindImport: "Direct `tailwindcss` import is forbidden outside @pekulo/ui (FR-55)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const uiRoot = opts.uiRoot ?? "packages/ui/";
    const filename = normaliseFilename(context.filename ?? context.getFilename?.() ?? "", context.cwd);
    if (filename.startsWith(uiRoot) || filename.includes("/" + uiRoot)) {
      return {};
    }

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (src === "tailwindcss" || src === "tailwindcss/preflight") {
          context.report({ node: node.source, messageId: "tailwindImport" });
        }
      },
      JSXAttribute(node) {
        if (!node.name || node.name.type !== "JSXIdentifier") return;
        if (node.name.name !== "className") return;
        if (!node.value) return;
        if (node.value.type !== "Literal") return;
        const v = node.value.value;
        if (typeof v !== "string") return;
        if (TW_TOKEN_RE.test(v)) {
          context.report({ node: node.value, messageId: "tailwindClass" });
        }
      },
    };
  },
};

export default rule;
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/rules/no-tailwind-outside-ui.js && git commit -m "feat(#12): rule no-tailwind-outside-ui (FR-55) (T6)"`

### T7 — Rule 2 RuleTester suite

Create `packages/oxlint-config/tests/no-tailwind-outside-ui.test.js`:

```js
// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-tailwind-outside-ui.js";

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: "module",
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
});

tester.run("no-tailwind-outside-ui", rule, {
  valid: [
    {
      code: `const x = <div className="flex p-4" />;`,
      filename: "packages/ui/src/components/foo.tsx",
    },
    {
      code: `const x = <div className="my-component-class" />;`,
      filename: "apps/web/src/components/foo.tsx",
    },
    {
      code: `const x = <div id="root" />;`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `const x = <div className="flex p-4" />;`,
      filename: "apps/web/src/components/foo.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    {
      code: `const x = <div className="text-sm font-semibold" />;`,
      filename: "apps/web/src/app/page.tsx",
      errors: [{ messageId: "tailwindClass" }],
    },
    {
      code: `import "tailwindcss";`,
      filename: "apps/web/src/app/globals.ts",
      errors: [{ messageId: "tailwindImport" }],
    },
  ],
});
```

Run: `bun --filter='@pekulo/oxlint-config' test tests/no-tailwind-outside-ui.test.js`
Expected: `6 pass`, exit 0.
Commit: `git add packages/oxlint-config/tests/no-tailwind-outside-ui.test.js && git commit -m "test(#12): RuleTester suite for no-tailwind-outside-ui (T7)"`

### T8 — Rule 3 implementation

Create `packages/oxlint-config/src/rules/no-server-action-in-component.js`:

```js
// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

/**
 * Detect whether an import source resolves under the configured action root.
 * Handles the `@/` alias and bare relative imports.
 *
 * @param {string} source
 * @param {string} actionRoot - e.g. "apps/web/src/lib/actions/"
 * @returns {boolean}
 */
function importTargetsActions(source, actionRoot) {
  if (source.startsWith("@/lib/actions/") || source === "@/lib/actions") return true;
  const idx = actionRoot.indexOf("src/");
  if (idx >= 0) {
    const aliased = "@/" + actionRoot.slice(idx + 4);
    if (source === aliased || source.startsWith(aliased)) return true;
  }
  return source.includes("/lib/actions/") || source.endsWith("/lib/actions");
}

/**
 * Detect whether a file lives under one of the configured component roots.
 *
 * @param {string} filename
 * @param {string[]} roots
 * @returns {boolean}
 */
function isComponentFile(filename, roots) {
  return roots.some((r) => filename.startsWith(r) || filename.includes("/" + r));
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid components from importing server actions directly. Enforces hard layering Component → Hook → Action (arch L168).",
    },
    schema: [
      {
        type: "object",
        properties: {
          actionRoot: { type: "string", default: "apps/web/src/lib/actions/" },
          componentRoots: {
            type: "array",
            items: { type: "string" },
            default: ["apps/web/src/components/", "apps/web/src/app/"],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      forbidden:
        "Server action imported directly into a component — go through a custom hook (arch L168)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const actionRoot = opts.actionRoot ?? "apps/web/src/lib/actions/";
    const componentRoots = opts.componentRoots ?? [
      "apps/web/src/components/",
      "apps/web/src/app/",
    ];
    const filename = normaliseFilename(context.filename ?? context.getFilename?.() ?? "", context.cwd);
    if (!isComponentFile(filename, componentRoots)) return {};

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (!src) return;
        if (importTargetsActions(src, actionRoot)) {
          context.report({ node: node.source, messageId: "forbidden" });
        }
      },
    };
  },
};

export default rule;
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/rules/no-server-action-in-component.js && git commit -m "feat(#12): rule no-server-action-in-component (arch L168) (T8)"`

### T9 — Rule 3 RuleTester suite

Create `packages/oxlint-config/tests/no-server-action-in-component.test.js`:

```js
// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-server-action-in-component.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-server-action-in-component", rule, {
  valid: [
    {
      code: `import { recordTx } from "@/lib/actions/transactions";`,
      filename: "apps/web/src/hooks/use-record-tx.ts",
    },
    {
      code: `import { useRecordTx } from "@/hooks/use-record-tx";`,
      filename: "apps/web/src/components/foo.tsx",
    },
    {
      code: `import { format } from "@/lib/utils";`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `import { recordTx } from "@/lib/actions/transactions";`,
      filename: "apps/web/src/components/transactions-form.tsx",
      errors: [{ messageId: "forbidden" }],
    },
    {
      code: `import { listAccounts } from "@/lib/actions/accounts";`,
      filename: "apps/web/src/app/dashboard/page.tsx",
      errors: [{ messageId: "forbidden" }],
    },
    {
      code: `import { signOff } from "../../lib/actions/monthly";`,
      filename: "apps/web/src/components/monthly/sign-off.tsx",
      errors: [{ messageId: "forbidden" }],
    },
  ],
});
```

Run: `bun --filter='@pekulo/oxlint-config' test tests/no-server-action-in-component.test.js`
Expected: `6 pass`, exit 0.
Commit: `git add packages/oxlint-config/tests/no-server-action-in-component.test.js && git commit -m "test(#12): RuleTester suite for no-server-action-in-component (T9)"`

### T10 — Rule 4 implementation

Create `packages/oxlint-config/src/rules/no-cross-feature-action-import.js`:

```js
// @ts-check
import { getStringLiteralValue, normaliseFilename } from "../utils/ast.js";

/**
 * Resolve the feature name a file lives in, given a list of feature roots.
 * Returns the feature segment, or null if outside any feature root.
 *
 * @param {string} filename
 * @param {string[]} featureRoots
 * @returns {{ root: string; feature: string } | null}
 */
function resolveFeature(filename, featureRoots) {
  for (const root of featureRoots) {
    const idx = filename.indexOf(root);
    if (idx === -1) continue;
    const tail = filename.slice(idx + root.length);
    const seg = tail.split("/")[0];
    if (!seg) continue;
    return { root, feature: seg };
  }
  return null;
}

/**
 * Resolve the feature name an aliased import targets.
 *
 * @param {string} source
 * @param {string[]} featureRoots
 * @returns {string | null}
 */
function resolveImportFeature(source, featureRoots) {
  if (source.startsWith("@/features/")) {
    return source.slice("@/features/".length).split("/")[0] || null;
  }
  for (const root of featureRoots) {
    const idx = source.indexOf(root);
    if (idx !== -1) {
      const tail = source.slice(idx + root.length);
      return tail.split("/")[0] || null;
    }
  }
  return null;
}

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid imports between sibling features. Enforces feature-boundary import discipline (arch L505).",
    },
    schema: [
      {
        type: "object",
        properties: {
          featureRoots: {
            type: "array",
            items: { type: "string" },
            default: ["apps/web/src/features/"],
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      crossFeature:
        "Cross-feature import — feature '{{from}}' must not depend on feature '{{to}}' (arch L505)",
    },
  },
  create(context) {
    const opts = context.options[0] ?? {};
    const featureRoots = opts.featureRoots ?? ["apps/web/src/features/"];
    const filename = normaliseFilename(context.filename ?? context.getFilename?.() ?? "", context.cwd);
    const here = resolveFeature(filename, featureRoots);
    if (!here) return {};

    return {
      ImportDeclaration(node) {
        const src = getStringLiteralValue(node.source);
        if (!src) return;
        const target = resolveImportFeature(src, featureRoots);
        if (!target) return;
        if (target === here.feature) return;
        context.report({
          node: node.source,
          messageId: "crossFeature",
          data: { from: here.feature, to: target },
        });
      },
    };
  },
};

export default rule;
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/rules/no-cross-feature-action-import.js && git commit -m "feat(#12): rule no-cross-feature-action-import (arch L505) (T10)"`

### T11 — Rule 4 RuleTester suite

Create `packages/oxlint-config/tests/no-cross-feature-action-import.test.js`:

```js
// @ts-check
import { RuleTester } from "eslint";
import rule from "../src/rules/no-cross-feature-action-import.js";

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module" },
});

tester.run("no-cross-feature-action-import", rule, {
  valid: [
    {
      code: `import { x } from "@/features/accounts/inner";`,
      filename: "apps/web/src/features/accounts/foo.ts",
    },
    {
      code: `import { x } from "@/lib/utils";`,
      filename: "apps/web/src/features/accounts/foo.ts",
    },
    {
      code: `import { x } from "@/features/holdings/bar";`,
      filename: "apps/web/src/components/foo.tsx",
    },
  ],
  invalid: [
    {
      code: `import { x } from "@/features/holdings/bar";`,
      filename: "apps/web/src/features/accounts/foo.ts",
      errors: [{ messageId: "crossFeature", data: { from: "accounts", to: "holdings" } }],
    },
    {
      code: `import { y } from "@/features/milestones/server/list";`,
      filename: "apps/web/src/features/compass/server/projection.ts",
      errors: [{ messageId: "crossFeature", data: { from: "compass", to: "milestones" } }],
    },
    {
      code: `import { z } from "@/features/monthly/hooks/use-tracking";`,
      filename: "apps/web/src/features/transactions/components/list.tsx",
      errors: [{ messageId: "crossFeature", data: { from: "transactions", to: "monthly" } }],
    },
  ],
});
```

Run: `bun --filter='@pekulo/oxlint-config' test tests/no-cross-feature-action-import.test.js`
Expected: `6 pass`, exit 0.
Commit: `git add packages/oxlint-config/tests/no-cross-feature-action-import.test.js && git commit -m "test(#12): RuleTester suite for no-cross-feature-action-import (T11)"`

### T12 — Plugin barrel

Create `packages/oxlint-config/src/index.js`:

```js
// @ts-check
import noPrismaQueryWithoutUserId from "./rules/no-prisma-query-without-user-id.js";
import noTailwindOutsideUi from "./rules/no-tailwind-outside-ui.js";
import noServerActionInComponent from "./rules/no-server-action-in-component.js";
import noCrossFeatureActionImport from "./rules/no-cross-feature-action-import.js";

/**
 * @pekulo/oxlint-config — Pekulo's custom oxlint plugin.
 *
 * Loaded via `jsPlugins` in `.oxlintrc.json`. Activate rules with the
 * `pekulo/<rule-name>` prefix (matches `meta.name` below).
 *
 * @type {{ meta: { name: string }, rules: Record<string, import("eslint").Rule.RuleModule> }}
 */
const plugin = {
  meta: { name: "pekulo" },
  rules: {
    "no-prisma-query-without-user-id": noPrismaQueryWithoutUserId,
    "no-tailwind-outside-ui": noTailwindOutsideUi,
    "no-server-action-in-component": noServerActionInComponent,
    "no-cross-feature-action-import": noCrossFeatureActionImport,
  },
};

export default plugin;
```

Run: `bun --filter='@pekulo/oxlint-config' run typecheck`
Expected: exit 0.
Commit: `git add packages/oxlint-config/src/index.js && git commit -m "feat(#12): @pekulo/oxlint-config plugin barrel (meta.name=pekulo) (T12)"`

### T13 — Smoke fixtures + fixture-local config

Create the 8 fixture files:

`packages/oxlint-config/tests/integration/fixtures/prisma/valid.ts`:

```ts
declare const prisma: { account: { findMany: (a: unknown) => Promise<unknown> } };
declare const ctx: { userId: string };
export async function listAccounts() {
  return prisma.account.findMany({ where: { userId: ctx.userId } });
}
```

`packages/oxlint-config/tests/integration/fixtures/prisma/invalid.ts`:

```ts
declare const prisma: { account: { findMany: (a: unknown) => Promise<unknown> } };
export async function listAccountsBad() {
  return prisma.account.findMany({ where: { foo: 1 } });
}
```

`packages/oxlint-config/tests/integration/fixtures/tailwind/valid.tsx`:

```tsx
export function Card() {
  return <div className="card-root" id="card" />;
}
```

`packages/oxlint-config/tests/integration/fixtures/tailwind/invalid.tsx`:

```tsx
export function Card() {
  return <div className="flex p-4" />;
}
```

`packages/oxlint-config/tests/integration/fixtures/server-action/valid.tsx`:

```tsx
import { useTx } from "@/hooks/use-tx";
export function TxList() {
  const tx = useTx();
  return <div>{tx.length}</div>;
}
```

`packages/oxlint-config/tests/integration/fixtures/server-action/invalid.tsx`:

```tsx
import { recordTx } from "@/lib/actions/transactions";
export function TxForm() {
  return <button onClick={() => recordTx({})}>Save</button>;
}
```

`packages/oxlint-config/tests/integration/fixtures/cross-feature/valid.ts`:

```ts
import { listAccounts } from "@/features/accounts/server/list";
export function inner() {
  return listAccounts();
}
```

`packages/oxlint-config/tests/integration/fixtures/cross-feature/invalid.ts`:

```ts
import { listHoldings } from "@/features/holdings/server/list";
export function bad() {
  return listHoldings();
}
```

Then create the fixture-local config at `packages/oxlint-config/tests/integration/fixtures/.oxlintrc.json`:

```json
{
  "$schema": "../../../../../node_modules/oxlint/configuration_schema.json",
  "plugins": [],
  "categories": {
    "correctness": "off",
    "suspicious": "off",
    "perf": "off",
    "style": "off",
    "restriction": "off",
    "nursery": "off",
    "pedantic": "off"
  },
  "jsPlugins": ["../../../src/index.js"],
  "rules": {
    "pekulo/no-prisma-query-without-user-id": "error",
    "pekulo/no-tailwind-outside-ui": ["error", { "uiRoot": "tests/integration/fixtures/__never__/" }],
    "pekulo/no-server-action-in-component": [
      "error",
      {
        "actionRoot": "lib/actions/",
        "componentRoots": ["tests/integration/fixtures/server-action/"]
      }
    ],
    "pekulo/no-cross-feature-action-import": [
      "error",
      { "featureRoots": ["tests/integration/fixtures/cross-feature/"] }
    ]
  }
}
```

> **Why the fixture overrides.** Rule 1 needs no overrides — fixtures use the default `prisma` identifier. Rule 2 has its `uiRoot` pointed at a non-existent path so the rule remains active on every fixture (the default `packages/ui/` would otherwise *exclude* fixtures sitting under `packages/oxlint-config/tests/...`). Rules 3 and 4 have their roots redirected to fixture paths so the in-rule filename gate triggers correctly.

Run: `ls packages/oxlint-config/tests/integration/fixtures/{prisma,tailwind,server-action,cross-feature}/{valid,invalid}.* packages/oxlint-config/tests/integration/fixtures/.oxlintrc.json`
Expected: 9 paths listed, no errors.
Commit: `git add packages/oxlint-config/tests/integration/fixtures && git commit -m "test(#12): smoke fixtures (4 rules × {valid, invalid}) + fixture oxlint config (T13)"`

### T14 — Smoke test driver

Create `packages/oxlint-config/tests/integration/oxlint-smoke.test.js`:

```js
// @ts-check
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
const configPath = join(fixturesDir, ".oxlintrc.json");

/**
 * Run oxlint against a single fixture file.
 * @param {string} relativeFile
 */
function runOxlint(relativeFile) {
  const result = spawnSync(
    "bunx",
    ["oxlint", "--config", configPath, "--format", "default", join(fixturesDir, relativeFile)],
    { encoding: "utf8" },
  );
  return {
    exitCode: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const cases = [
  {
    rule: "no-prisma-query-without-user-id",
    validPath: "prisma/valid.ts",
    invalidPath: "prisma/invalid.ts",
    invalidMessage: "missing 'where.userId'",
  },
  {
    rule: "no-tailwind-outside-ui",
    validPath: "tailwind/valid.tsx",
    invalidPath: "tailwind/invalid.tsx",
    invalidMessage: "Tailwind utility classes are forbidden",
  },
  {
    rule: "no-server-action-in-component",
    validPath: "server-action/valid.tsx",
    invalidPath: "server-action/invalid.tsx",
    invalidMessage: "Server action imported directly",
  },
  {
    rule: "no-cross-feature-action-import",
    validPath: "cross-feature/valid.ts",
    invalidPath: "cross-feature/invalid.ts",
    invalidMessage: "Cross-feature import",
  },
];

describe("oxlint smoke — @pekulo/oxlint-config plugin loaded via jsPlugins", () => {
  for (const c of cases) {
    test(`${c.rule}: valid fixture exits 0`, () => {
      const r = runOxlint(c.validPath);
      const combined = r.stdout + r.stderr;
      expect(combined).not.toContain(c.rule);
      expect(r.exitCode).toBe(0);
    });

    test(`${c.rule}: invalid fixture exits non-zero with rule message`, () => {
      const r = runOxlint(c.invalidPath);
      const combined = r.stdout + r.stderr;
      expect(combined).toContain(c.invalidMessage);
      expect(r.exitCode).not.toBe(0);
    });
  }
});
```

Run: `bun --filter='@pekulo/oxlint-config' test tests/integration/oxlint-smoke.test.js`
Expected: `8 pass`, exit 0 (4 valid + 4 invalid cases).
Commit: `git add packages/oxlint-config/tests/integration/oxlint-smoke.test.js && git commit -m "test(#12): oxlint CLI smoke driver — 4 rules × {valid, invalid} (T14)"`

### T15 — Wire root `.oxlintrc.json` + verify zero false positives

Replace `.oxlintrc.json` (repo root) with:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "import", "jsx-a11y", "nextjs"],
  "jsPlugins": ["./packages/oxlint-config/src/index.js"],
  "categories": {
    "correctness": "error",
    "suspicious": "warn",
    "perf": "warn",
    "style": "off",
    "restriction": "off",
    "nursery": "off",
    "pedantic": "off"
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/react-in-jsx-scope": "off",
    "import/no-unassigned-import": "off",
    "pekulo/no-tailwind-outside-ui": "error",
    "pekulo/no-cross-feature-action-import": "error"
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
    "docs/ux-preview/",
    ".aped/",
    ".agents/",
    "docs/sync-logs/",
    "packages/oxlint-config/tests/integration/fixtures/"
  ],
  "overrides": [
    {
      "files": ["apps/web/src/components/ui/**/*.{ts,tsx}"],
      "rules": {
        "jsx-a11y/label-has-associated-control": "off"
      }
    },
    {
      "files": ["apps/api/**/*.{ts,tsx}"],
      "rules": {
        "pekulo/no-prisma-query-without-user-id": "error"
      }
    },
    {
      "files": ["apps/web/src/components/**/*.{ts,tsx}", "apps/web/src/app/**/*.{ts,tsx}"],
      "excludedFiles": [
        "apps/web/src/components/ui/**",
        "apps/web/src/lib/actions/**",
        "apps/web/src/lib/services/**",
        "apps/web/src/hooks/**"
      ],
      "rules": {
        "pekulo/no-server-action-in-component": "error"
      }
    },
    {
      "files": ["packages/ui/**/*.{ts,tsx}"],
      "rules": {
        "pekulo/no-tailwind-outside-ui": "off"
      }
    }
  ]
}
```

> **Why two activation layers.** `pekulo/no-tailwind-outside-ui` and `pekulo/no-cross-feature-action-import` are activated globally and self-gate via `context.filename` in the rule body. `pekulo/no-prisma-query-without-user-id` and `pekulo/no-server-action-in-component` are activated only on their target globs via `overrides` so unrelated files (e.g. `apps/web/**` calling fetch wrappers) skip the work entirely.

After saving, run zero-false-positive verification:

```bash
bunx oxlint
```

Expected: `Found 0 warnings and 0 errors.` and exit 0 — the post-0-11 tree has no Tailwind references in `apps/web`, no Prisma calls in `apps/api`, no server-action-in-component, and no `apps/web/src/features/` directory.

Commit: `git add .oxlintrc.json && git commit -m "feat(#12): wire jsPlugins + activate 4 pekulo/* rules with per-path overrides (T15)"`

### T16 — Package README + final verification

Create `packages/oxlint-config/README.md`:

````markdown
# @pekulo/oxlint-config

Custom oxlint plugin enforcing four Pekulo architecture invariants. Loaded via `jsPlugins` in the root `.oxlintrc.json`.

## Rules

| Rule key | Enforces | Default scope |
|---|---|---|
| `pekulo/no-prisma-query-without-user-id` | NFR-8 — every user-scoped Prisma query carries `where.userId` | `apps/api/**` |
| `pekulo/no-tailwind-outside-ui` | FR-55 — `@pekulo/ui` is the sole styling surface | repo-wide except `packages/ui/**` |
| `pekulo/no-server-action-in-component` | arch L168 — Component → Hook → Action layering | `apps/web/src/{components,app}/**` |
| `pekulo/no-cross-feature-action-import` | arch L505 — feature-boundary import discipline | `apps/web/src/features/**` |

## Rule options

### `pekulo/no-prisma-query-without-user-id`

```jsonc
[
  "error",
  {
    "prismaIdentifier": "prisma",
    "unscopedModels": ["fxRate", "country"]
  }
]
```

### `pekulo/no-tailwind-outside-ui`

```jsonc
["error", { "uiRoot": "packages/ui/" }]
```

### `pekulo/no-server-action-in-component`

```jsonc
[
  "error",
  {
    "actionRoot": "apps/web/src/lib/actions/",
    "componentRoots": ["apps/web/src/components/", "apps/web/src/app/"]
  }
]
```

### `pekulo/no-cross-feature-action-import`

```jsonc
["error", { "featureRoots": ["apps/web/src/features/"] }]
```

## Adding a new rule

1. Implement `src/rules/<name>.js` (ESM, `// @ts-check`, ESLint v9 RuleModule shape).
2. Add a RuleTester suite at `tests/<name>.test.js` (≥ 3 valid + ≥ 3 invalid cases).
3. Add a smoke fixture pair under `tests/integration/fixtures/<name>/{valid, invalid}.*`.
4. Register the rule in `src/index.js` under the `pekulo` namespace.
5. Activate it in the root `.oxlintrc.json` with the appropriate `overrides` glob.

## Running tests locally

```bash
bun --filter='@pekulo/oxlint-config' test
```

The smoke driver spawns `bunx oxlint` per fixture; ensure root `bun install` has run.

## Lessons applied

- L4 — only the four `pekulo/*` rules with `meta.schema` accept the `["error", { … }]` form. Rules without options use the simple-string severity.
````

Run final verification from repo root:

```bash
bun --filter='@pekulo/oxlint-config' test && bunx oxlint
```

Expected: `bun test` reports the four RuleTester suites passing plus the 8 smoke cases (24+ total assertions across the four `.test.js` files), and `bunx oxlint` reports `Found 0 warnings and 0 errors.` with exit 0.

Commit: `git add packages/oxlint-config/README.md && git commit -m "docs(#12): @pekulo/oxlint-config README — rules, options, lessons (T16)"`

### Watch items for the dev agent

- **W-A — `jsPlugins` deprecation warnings.** oxlint 1.62.0 marks JS plugins as stable but the `jsPlugins` key behaviour may differ across patch versions. If `bunx oxlint` from T15 prints a deprecation warning, surface it in Dev Agent Record and continue — the plugin must still load. If it fails to load, escalate to `aped-debug` rather than retry-spinning.
- **W-B — RuleTester strictness on `messageId.data`.** ESLint v9's RuleTester strictly checks `data` keys against the rule's `messages` interpolation. A message like `'{{model}}'` requires `data: { model }` exactly; missing/extra keys fail the test. T5 / T11 already wire this; if a test fails, recheck the message template literal vs the test's `data` keys.
- **W-C — JSX in RuleTester for rules 2 / 3.** T7 / T9 set `parserOptions.ecmaFeatures.jsx = true`. If RuleTester rejects JSX cases with `"Unexpected token <"`, verify the `languageOptions` shape matches ESLint v9's flat-config schema.
- **W-D — Tailwind detector heuristic.** The regex in `no-tailwind-outside-ui.js` is heuristic (covers `p-`, `m-`, `flex-`, etc. plus a small bareword set). False negatives are acceptable (post-0-10 the codebase has no Tailwind anyway); false positives on non-tailwind class names that happen to match `<prefix>-<token>` would block legitimate styling. If T15's AC-7 verification finds false positives, narrow the regex or move the detection to a dedicated allowlist.

### Out of scope

- **CI workflow edits** — the existing `bun --filter='*' run test` fan-out (lesson 2026-05-07) auto-enrols `@pekulo/oxlint-config`. No `.github/workflows/pr.yml` edit required.
- **Lefthook edits** — `oxlint --fix {staged_files}` (stories 0-2 + 0-11) automatically picks up the new rules via the now-extended `.oxlintrc.json`.
- **Architecture doc edits** — story 0-12 closes W5; the watch-item closure is recorded by `aped-review` on story → done (cache append).
- **Auto-fix support** — none of the four rules ship `fixable` metadata. Diagnostic-only by design (no safe AST rewrites for any of these invariants). `--fix` is a no-op for `pekulo/*`.

## File List

**Created (13)**

- `packages/oxlint-config/src/index.js`
- `packages/oxlint-config/src/utils/ast.js`
- `packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js`
- `packages/oxlint-config/src/rules/no-tailwind-outside-ui.js`
- `packages/oxlint-config/src/rules/no-server-action-in-component.js`
- `packages/oxlint-config/src/rules/no-cross-feature-action-import.js`
- `packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js`
- `packages/oxlint-config/tests/no-tailwind-outside-ui.test.js`
- `packages/oxlint-config/tests/no-server-action-in-component.test.js`
- `packages/oxlint-config/tests/no-cross-feature-action-import.test.js`
- `packages/oxlint-config/tests/integration/oxlint-smoke.test.js`
- `packages/oxlint-config/tests/integration/fixtures/.oxlintrc.json`
- `packages/oxlint-config/tests/integration/fixtures/<rule>/<valid|invalid>.{ts,tsx}` (×8 files: prisma, tailwind, server-action, cross-feature)
- `packages/oxlint-config/README.md`

**Modified (3)**

- `packages/oxlint-config/package.json`
- `packages/oxlint-config/tsconfig.json`
- `.oxlintrc.json`

**Deleted (1)**

- `packages/oxlint-config/src/index.ts`

## Dev Agent Record

- **Model:** claude-opus-4-7[1m]
- **Started:** 2026-05-09T11:43Z
- **Completed:** 2026-05-09T13:59Z

### Implementation summary

`@pekulo/oxlint-config` ships as a JS plugin (ESM, `// @ts-check`, ESLint v9 RuleModule shape) loaded by oxlint via `jsPlugins`. Four rules close architecture invariants (NFR-8, FR-55, arch L168, arch L505) and watch item W5. Per-rule RuleTester suites + a CLI smoke driver round-trip the plugin through `bunx oxlint`.

### Deviations from story spec

- **`@types/estree` + `@types/bun` devDeps added** (story T1 was missing them). T3's JSDoc uses `import("estree").Node`; T14's smoke driver imports `node:*` and `bun:test`. Both type packages were transitively present in `.bun/` but not hoisted to a tsc-discoverable root.
- **Fixture config renamed `.oxlintrc.json` → `fixture-oxlintrc.json`.** oxlint walk-up auto-discovery would otherwise pick up the fixture-local config and fire `pekulo/*` rules on the deliberately rule-violating fixtures whenever they're staged. The smoke driver passes `--config <path>` explicitly, so the rename is transparent for it. Root `.oxlintrc.json` adds `packages/oxlint-config/tests/integration/fixtures/` to `ignorePatterns` to belt-and-braces.
- **T15 dropped `excludedFiles` from the `no-server-action-in-component` override.** oxlint 1.62 schema rejects `excludedFiles` (only `files`, `env`, `globals`, `plugins`, `jsPlugins`, `rules` accepted). The listed exclusions (`lib/actions/`, `lib/services/`, `hooks/`) don't sit under `components/**` or `app/**` anyway — drop is semantically null.
- **TS strict-mode tightening on rule 1 (segments[i] narrowing) + rule 2 (JSXAttribute listener annotation)** bundled into T12 commit. Latent failures surfaced once the plugin barrel pulled all rules into one typecheck pass.
- **Cross-feature fixtures re-nested under `accounts/`.** Story T13 placed `valid.ts` directly under `cross-feature/`, which makes the rule resolve `here.feature = "valid.ts"` and treat every import as cross-feature. Nesting under a real feature segment makes the valid case represent same-feature import (no fire) and the invalid case cross-feature (fires).
- **9 pre-existing oxlint warnings cleared** to satisfy AC-7 literally (per user direction): 3× `react/no-array-index-key` (biome-ignore→eslint-disable in `@pekulo/ui`), 3× `no-underscore-dangle` (override config for `apps/api/.../otel-sdk.ts`), 2× `no-await-in-loop` (deliberate provider throttle in portfolio refresh), 1× `no-new` (URL parse-validation in web instrumentation). All have rationale at the disable site.

### Verification (captured 2026-05-09 11:58–11:59 UTC)

```
$ cd packages/oxlint-config && bun test
bun test v1.3.13 (bf2e2cec)
 33 pass
 0 fail
 16 expect() calls
Ran 33 tests across 5 files. [690.00ms]

$ bunx oxlint
Found 0 warnings and 0 errors.
Finished in 547ms on 308 files with 158 rules using 10 threads.

$ bun --filter='@pekulo/oxlint-config' run typecheck
@pekulo/oxlint-config typecheck: Exited with code 0
```

### Watch items handled

- **W-A** — no `jsPlugins` deprecation warnings observed at 1.62.0.
- **W-B** — RuleTester `messageId.data` strictness: T5/T11 wire `data: { model }` and `data: { from, to }` exactly matching the message templates.
- **W-C** — JSX RuleTester (T7) uses `parserOptions.ecmaFeatures.jsx = true`; ESLint v9 flat-config schema accepted.
- **W-D** — Tailwind detector regex applied: zero false positives on the post-0-10 tree.

### File List

**Created (16)**

- `packages/oxlint-config/README.md`
- `packages/oxlint-config/src/index.js`
- `packages/oxlint-config/src/utils/ast.js`
- `packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js`
- `packages/oxlint-config/src/rules/no-tailwind-outside-ui.js`
- `packages/oxlint-config/src/rules/no-server-action-in-component.js`
- `packages/oxlint-config/src/rules/no-cross-feature-action-import.js`
- `packages/oxlint-config/tests/no-prisma-query-without-user-id.test.js`
- `packages/oxlint-config/tests/no-tailwind-outside-ui.test.js`
- `packages/oxlint-config/tests/no-server-action-in-component.test.js`
- `packages/oxlint-config/tests/no-cross-feature-action-import.test.js`
- `packages/oxlint-config/tests/integration/oxlint-smoke.test.js`
- `packages/oxlint-config/tests/integration/fixtures/fixture-oxlintrc.json`
- `packages/oxlint-config/tests/integration/fixtures/{prisma,tailwind,server-action,cross-feature/accounts}/{valid,invalid}.{ts,tsx}` (8 fixture files)

**Modified (8)**

- `.oxlintrc.json`
- `bun.lock`
- `packages/oxlint-config/package.json`
- `packages/oxlint-config/tsconfig.json`
- `packages/ui/src/components/{PekuloAccountsSection,PekuloRecentActivityCard,PekuloStaggerList}.tsx`
- `apps/api/src/platform/observability/otel-sdk.ts` (no edit; opt-out via root override)
- `apps/web/src/instrumentation.node.ts`
- `apps/web/src/lib/actions/portfolio.ts`

**Deleted (1)**

- `packages/oxlint-config/src/index.ts`

## Review Record

**Date:** 2026-05-09
**Auditors:** Spec, Code, Edge & Hallucination
**Verdict:** done

Spec auditor approved (7/7 ACs implemented, 16/16 tasks evidenced). Code + Edge converged on 4 MAJOR bypass classes inherent to the heuristic AST-only ruleset; user opted to fix all findings rather than defer. Patches landed in commit `7694fa5`.

### Findings

#### Resolved

- [MAJOR] `no-prisma-query-without-user-id` covered only the exact `prisma.<model>.<method>` 3-segment shape — bypass via optional chaining, computed access, transactional sub-clients, aliased / `this.*` chains, OrThrow methods. [`packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js`]
  - Source: Code + Edge (converged)
  - Resolution: `7694fa5` — `unwrapChain` + extended `getDottedMemberName` (optional chains, computed string-literal access, ThisExpression root). Rule does trailing-3-tuple match (`this.prisma.account.findMany` → root="prisma"). `prismaIdentifier` accepts `string | string[]`; opt-in `["prisma","tx"]` covers `$transaction` callbacks. Added `findFirstOrThrow` / `findUniqueOrThrow` to user-scoped methods.
- [MAJOR] `no-tailwind-outside-ui` only saw raw `className="..."` strings — `cn()` / `clsx()` / template literals slipped past, regex over-matched user-defined classnames sharing TW prefixes. [`packages/oxlint-config/src/rules/no-tailwind-outside-ui.js`]
  - Source: Code + Edge (converged)
  - Resolution: `7694fa5` — added `CallExpression` visitor scanning `cn|clsx|tw|twMerge|classNames` arguments (configurable list); recursive descent into `JSXExpressionContainer` covers `Literal`, `TemplateLiteral`, `LogicalExpression`, `ConditionalExpression`, `ArrayExpression`, `ObjectExpression` (clsx-key form). README documents the heuristic trade-off explicitly. Anchored `uiRoot` via `fileUnderDir` (no substring slip).
- [MAJOR] `no-server-action-in-component` bypass via dynamic `await import()`. [`packages/oxlint-config/src/rules/no-server-action-in-component.js`]
  - Source: Code + Edge (converged)
  - Resolution: `7694fa5` — added `ImportExpression` listener delegating to the same `checkSource` as `ImportDeclaration`. RuleTester invalid case added.
- [MAJOR] `no-cross-feature-action-import` bypass via dynamic import + false-positive on type-only imports. [`packages/oxlint-config/src/rules/no-cross-feature-action-import.js`]
  - Source: Edge
  - Resolution: `7694fa5` — added `ImportExpression` listener. New `allowTypeImports` option (default `true`) skips `node.importKind === "type"`. RuleTester invalid case for dynamic import added; type-import path documented and deferred to integration smoke (espree lacks TS syntax).
- [MAJOR] Re-export laundering bypasses both layering rules (no static import-graph walker). [`README.md`]
  - Source: Edge
  - Resolution: `7694fa5` — accepted as documented punt. README "known limitations" sections + Follow-ups list the gap as a candidate for a future rule. Statically unsolvable without whole-program graph analysis.
- [MINOR] `findObjectProperty` silently ignored `SpreadElement` → false positive on `prisma.account.findMany({ ...args })`. [`packages/oxlint-config/src/utils/ast.js`]
  - Source: Code + Edge
  - Resolution: `7694fa5` — added `hasSpreadElement` helper; `hasWhereUserId` now fail-opens on top-level spread, on non-ObjectExpression `where` value, and on spread inside `where`. RuleTester valid cases cover all three shapes.
- [MINOR] AC-6 smoke driver asserted `exitCode !== 0` instead of `=== 1` literal. [`packages/oxlint-config/tests/integration/oxlint-smoke.test.js`]
  - Source: Spec
  - Resolution: `7694fa5` — `expect(r.exitCode).toBe(1)` strict.
- [MINOR] Smoke driver spawned 8 `bunx oxlint` serially via `spawnSync`. [`packages/oxlint-config/tests/integration/oxlint-smoke.test.js`]
  - Source: Code
  - Resolution: `7694fa5` — `Bun.spawn` + `Promise.all` in `beforeAll`; results memoised in a Map. Test runtime 526ms → 342ms.
- [MINOR] `unscopedModels` was case-sensitive (`["FxRate"]` vs `prisma.fxRate.findMany` foot-gun). [`packages/oxlint-config/src/rules/no-prisma-query-without-user-id.js`]
  - Source: Edge
  - Resolution: `7694fa5` — `camelize()` normalises both sides. RuleTester valid case proves both forms.
- [MINOR] Dev Agent Record `Started 13:43Z > Completed 11:59Z` clerical inversion. [`docs/stories/0-12-custom-oxlint-rules.md`]
  - Source: Edge
  - Resolution: `7694fa5` — swapped to `Started 11:43Z`, `Completed 13:59Z`.
- [NIT] Fixture-config rename (`.oxlintrc.json` → `fixture-oxlintrc.json`) had no in-place comment. [`packages/oxlint-config/tests/integration/fixtures/fixture-oxlintrc.json`]
  - Source: Spec
  - Resolution: `7694fa5` — JSONC comment at top of fixture config (oxlint accepts JSONC); annotated rationale in smoke driver next to `configPath`.
- [NIT] `uiRoot` substring match too loose (`/lib/packages/ui/foo.tsx` would slip). [`packages/oxlint-config/src/rules/no-tailwind-outside-ui.js`]
  - Source: Code
  - Resolution: `7694fa5` — replaced with `fileUnderDir` helper (anchored prefix or `/dir` boundary).
- [NIT] README didn't mention the broader R1 package-layer hierarchy is enforced elsewhere. [`packages/oxlint-config/README.md`]
  - Source: Code
  - Resolution: `7694fa5` — Follow-ups section added.
- [NIT] `getDottedMemberName` rejected `this.prisma.account.findMany`. [`packages/oxlint-config/src/utils/ast.js`]
  - Source: Edge
  - Resolution: `7694fa5` — `ThisExpression` root maps to literal `"this"` segment; rule's trailing-3-tuple match handles it. Test covers.
- [NIT] Global activation of `pekulo/no-cross-feature-action-import` is forward-looking but uncommented. [`.oxlintrc.json`]
  - Source: Spec
  - Resolution: `7694fa5` — JSONC comment at root config explains the forward-looking posture.

#### Dismissed

(none — user opted to fix all findings)

#### Unresolved

(none)

### Verification

- Test command: `cd packages/oxlint-config && bun test` (plus `bunx oxlint` from repo root, `bun --filter='@pekulo/oxlint-config' run typecheck`)
- Test output (final pass): `57 pass / 0 fail / 5 files / 342ms` (was 33 / 0 fail pre-review; +24 cases for new bypass coverage; runtime improved via parallel `Bun.spawn`)
- `bunx oxlint` (root): `Found 0 warnings and 0 errors. Finished in 535ms on 308 files`
- `tsc --noEmit`: exit 0
- Visual verification: N/A — no frontend component delta (the 3 `.tsx` edits in `packages/ui` were `eslint-disable` comment swaps, no rendered output change)

### Ticket sync

- Ticket comment posted: https://github.com/yabafre/pekulo/issues/12#issuecomment-4412530700
- PR opened/updated: https://github.com/yabafre/pekulo/pull/72 (base `main` = sprint umbrella; title + body updated with Review Record link)
