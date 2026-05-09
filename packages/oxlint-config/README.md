# @pekulo/oxlint-config

Custom oxlint plugin enforcing four Pekulo architecture invariants. Loaded via `jsPlugins` in the root `.oxlintrc.json`.

## Rules

| Rule key                                 | Enforces                                                      | Default scope                      |
| ---------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| `pekulo/no-prisma-query-without-user-id` | NFR-8 — every user-scoped Prisma query carries `where.userId` | `apps/api/**`                      |
| `pekulo/no-tailwind-outside-ui`          | FR-55 — `@pekulo/ui` is the sole styling surface              | repo-wide except `packages/ui/**`  |
| `pekulo/no-server-action-in-component`   | arch L168 — Component → Hook → Action layering                | `apps/web/src/{components,app}/**` |
| `pekulo/no-cross-feature-action-import`  | arch L505 — feature-boundary import discipline                | `apps/web/src/features/**`         |

## Rule options

### `pekulo/no-prisma-query-without-user-id`

```jsonc
[
  "error",
  {
    // Single identifier (legacy) OR a list. Lists cover transactional
    // callbacks (`prisma.$transaction(async tx => tx.account.findMany)`)
    // and aliased clients (`const p = prisma`). Recommended in apps/api
    // wherever transactions appear.
    "prismaIdentifier": ["prisma", "tx"],
    // Models exempt from the rule (no `where.userId` required). Accepts
    // either Prisma client form (camelCase, e.g. `fxRate`) or schema form
    // (PascalCase, e.g. `FxRate`) — both match.
    "unscopedModels": ["fxRate", "country"],
  },
]
```

User-scoped methods reported when `where.userId` is missing: `findFirst`, `findFirstOrThrow`, `findUnique`, `findUniqueOrThrow`, `findMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`, `groupBy`, `upsert`.

The detector handles plain dotted access, optional chaining (`prisma?.account?.findMany`), computed string-literal access (`prisma["account"].findMany`), and `this.prisma.…` from service classes (the trailing 3-tuple decides). Calls that pass an opaque arg or spread the args object (`prisma.account.findMany({ ...args })`) **fail open** — the lint half cannot statically prove `where.userId` is missing, and RLS catches it at runtime (ADR-0013).

**Known limitations.** The rule does NOT track aliased clients introduced via `const p = prisma` or destructured method handles (`const { account } = prisma; account.findMany(…)`) without scope analysis. If a project uses these patterns, add the alias to `prismaIdentifier`. Re-export laundering (a wrapper module that proxies the Prisma client) is also out of scope.

### `pekulo/no-tailwind-outside-ui`

```jsonc
[
  "error",
  {
    "uiRoot": "packages/ui/",
    // Function names treated as className helpers — their string-literal
    // arguments are scanned through the Tailwind detector regex.
    "classnameHelpers": ["clsx", "cn", "tw", "twMerge", "classNames"],
  },
]
```

The detector covers: raw `className="…"` literals, `className={…}` JSX expression containers (Literal, TemplateLiteral with no expressions, LogicalExpression branches, ConditionalExpression branches, ArrayExpression elements), and helper calls (`cn("flex p-4")`, `clsx({ "flex p-4": cond })`). Tailwind imports caught: `tailwindcss`, `tailwindcss/preflight`, `tailwindcss/utilities`, `tailwindcss/components`, any `@tailwindcss/*` sub-package.

**Known limitations.** The token regex is heuristic — false positives on user-defined classnames that share a Tailwind prefix (`text-content`, `flex-container`) are possible; false negatives on arbitrary values (`[mask:…]`), modifiers (`hover:`, `dark:`, `md:`), and gradient stops (`from-`, `to-`, `via-`) exist by design. Post-0-10 the codebase has zero Tailwind so the trade-off favours speed over completeness; if Tailwind ever leaks back, prefer narrowing `classnameHelpers` and tightening the token list.

### `pekulo/no-server-action-in-component`

```jsonc
[
  "error",
  {
    "actionRoot": "apps/web/src/lib/actions/",
    "componentRoots": ["apps/web/src/components/", "apps/web/src/app/"],
  },
]
```

Catches static `import { … } from "@/lib/actions/…"` AND dynamic `await import("@/lib/actions/…")` from any file under `componentRoots`.

**Known limitations.** Re-export laundering (a non-action module that re-exports the action) is invisible — this rule is a first-hop check only. Tracked as a follow-up on the broader Import hierarchy R1 (architecture L505) — today only the cross-feature half ships as a custom rule; the package-layer hierarchy (`@pekulo/zod → validators → contracts`) is enforced by `tsconfig` path maps + `import/no-cycle`.

### `pekulo/no-cross-feature-action-import`

```jsonc
[
  "error",
  {
    "featureRoots": ["apps/web/src/features/"],
    // When true (default), `import type { … }` between sibling features is
    // allowed — types erase at compile time, expressing a contract via
    // shared types is a deliberate idiom. Set to false to enforce on types.
    "allowTypeImports": true,
  },
]
```

Catches static `import { … } from "@/features/<other>/…"` AND dynamic `await import("@/features/<other>/…")` from a sibling feature.

**Known limitations.** Same first-hop caveat as `no-server-action-in-component` — re-export barrels (`@/lib/feature-shim` that re-exports `@/features/holdings/server/list`) bypass static analysis. Type-only imports default to fail-open (`allowTypeImports: true`); flip the option to enforce on types.

## Adding a new rule

1. Implement `src/rules/<name>.js` (ESM, `// @ts-check`, ESLint v9 RuleModule shape).
2. Add a RuleTester suite at `tests/<name>.test.js` (≥ 3 valid + ≥ 3 invalid cases).
3. Add a smoke fixture pair under `tests/integration/fixtures/<name>/{valid, invalid}.*`.
4. Register the rule in `src/index.js` under the `pekulo` namespace.
5. Activate it in the root `.oxlintrc.json` with the appropriate `overrides` glob.

## Running tests locally

```bash
cd packages/oxlint-config && bun test
```

The smoke driver spawns `bunx oxlint` per fixture in parallel via `Bun.spawn`; ensure root `bun install` has run.

## Lessons applied

- **L4** — only the four `pekulo/*` rules with `meta.schema` accept the `["error", { … }]` form. Rules without options use the simple-string severity.
- **Fixture config filename** — `tests/integration/fixtures/fixture-oxlintrc.json` (not `.oxlintrc.json`) so oxlint's walk-up auto-discovery does not pick up the fixture-local config when ambient lint runs cross deliberately rule-violating fixtures. The smoke driver passes `--config <path>` explicitly.
- **oxlint 1.62 schema** — `excludedFiles` is not supported in `overrides`. Use additional `files` globs or rely on the rule's runtime filename gate to scope.

## Follow-ups (review-residual)

- **R1 package-layer hierarchy** — `pekulo/no-cross-feature-action-import` only covers the feature-isolation half of architecture L505. The package-layer DAG (`@pekulo/zod → validators → contracts`) is enforced today by `tsconfig` `paths` + `import/no-cycle`; a custom rule could add belt-and-braces.
- **Aliased Prisma clients** — extend `no-prisma-query-without-user-id` with scope-tracking to catch `const p = prisma; p.account.findMany(…)` without an explicit `prismaIdentifier` list.
- **Re-export laundering** — both layering rules are first-hop only. A separate import-graph walker could close the gap.
