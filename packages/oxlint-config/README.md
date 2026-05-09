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
    "prismaIdentifier": "prisma",
    "unscopedModels": ["fxRate", "country"],
  },
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
    "componentRoots": ["apps/web/src/components/", "apps/web/src/app/"],
  },
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
cd packages/oxlint-config && bun test
```

The smoke driver spawns `bunx oxlint` per fixture; ensure root `bun install` has run.

## Lessons applied

- **L4** — only the four `pekulo/*` rules with `meta.schema` accept the `["error", { … }]` form. Rules without options use the simple-string severity.
- **Fixture config filename** — `tests/integration/fixtures/fixture-oxlintrc.json` (not `.oxlintrc.json`) so oxlint's walk-up auto-discovery does not pick up the fixture-local config when ambient lint runs cross deliberately rule-violating fixtures. The smoke driver passes `--config <path>` explicitly.
- **oxlint 1.62 schema** — `excludedFiles` is not supported in `overrides`. Use additional `files` globs or rely on the rule's runtime filename gate to scope.
