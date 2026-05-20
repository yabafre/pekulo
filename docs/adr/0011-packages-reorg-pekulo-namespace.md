# Packages reorg under `@pekulo/*` namespace

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

Brownfield Pekulo had a single `packages/*` glob resolving to a `.gitkeep` placeholder. Phase 2 originally introduced `packages/{ui, types, llm}`. Alex's pivot after Phase 3 review adopts the seven-package layout proven on his prior project, expanded to cover oRPC contract-first delivery, shared validation, and tooling configs.

## Decision

The monorepo workspaces under `packages/*` reorganise to:

| Package                 | Role                                                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pekulo/zod`           | Re-exports Zod v4 + Pekulo-specific helpers (`tabularNum`, `IsoDate`, `Money`, `EuroAmount`, `Percent`)                                                                    |
| `@pekulo/types`         | Shared TS types across apps (`UserId`, `CompassSnapshot`, `LlmRoute`, `PriceQuote`, `MonthlyRecord`)                                                                       |
| `@pekulo/validators`    | Zod schemas (`camelCase + Schema` suffix) — `createCompassSchema`, `recordValuationSchema`, `attestLlmCallSchema`, etc.                                                    |
| `@pekulo/contracts`     | oRPC contracts, one sub-tree per Elysia module (`compassContract`, `holdingsContract`, `llmContract`, …)                                                                   |
| `@pekulo/tsconfig`      | Shared `tsconfig.base.json` + presets (`apps`, `packages`, `next`)                                                                                                         |
| `@pekulo/oxlint-config` | Shared oxlint rules + Pekulo custom rules (`no-tailwind-outside-ui`, `no-server-action-in-component`, `no-cross-feature-action-import`, `no-prisma-query-without-user-id`) |
| `@pekulo/ui`            | Pekulo Design System on Tamagui Core (renamed from earlier `packages/ui`)                                                                                                  |

Import hierarchy is enforced (R1):

```
@pekulo/zod → @pekulo/validators → @pekulo/contracts → apps
                  ↑                                       ↓
              @pekulo/types ← apps
```

`@pekulo/types` is the only package consumed _bidirectionally_ (apps import types ; lower packages re-export type-only definitions to types consumers). All other dependencies flow strictly downward.

## Why

- **oRPC contract-first requires `@pekulo/contracts`** as a standalone package consumable by both `apps/api` (server) and `apps/web` (client) without circular workspace deps.
- **`@pekulo/validators` separation from `@pekulo/contracts`** — contracts describe shapes for the wire ; validators carry the Zod schemas usable by forms (`@tanstack/react-form`), env validation, and ad-hoc parse calls. Same schemas, two consumption sites.
- **`@pekulo/oxlint-config` as a package** — Pekulo-specific lint rules (boundary enforcement, prefix discipline) live in one place ; every app consumes the same ruleset.
- **`@pekulo/tsconfig` package** — eliminates per-app tsconfig drift ; presets (`apps`, `packages`, `next`) keep settings appropriate per workspace shape.

## Considered options

- **Single `@pekulo/core` mega-package** — rejected: forces every consumer to depend on the entire surface ; defeats the point of fine-grained dependency control.
- **Three packages (`@pekulo/{ui, types, llm}`)** — Phase 2's original split. Rejected: insufficient for oRPC contract-first delivery and shared tooling configs.

## Consequences

- **Workspace bootstrapping touches every app** — `apps/web`, `apps/api`, `apps/mobile`, `apps/prices` (only for shared types if applicable) declare `@pekulo/*` deps in `package.json`.
- **Bun workspace resolution** — `packages/*` glob in root `package.json` workspaces array (already present) ; package names follow `@pekulo/<name>` in each `package.json`.
- **Publish surface** — packages stay private (`"private": true`) ; never published to npm at V1 / V1.5.
- **Lint custom rules in `@pekulo/oxlint-config`** — implemented as JS rules (oxlint's plugin model) ; CI lint is the gating mechanism.

## Amendments

### 2026-05-20 — PR #86 (archi-deadcode audit)

Two refinements ratified in `architecture.md` Phase 3 (Audit-derived conventions):

- **R1** — `@pekulo/zod` is the SOLE zod entry point. No file under `packages/*` or `apps/*` is allowed to `import { z } from "zod"` directly. The `@pekulo/zod` package was the placeholder mentioned in the original Decision — promotion to real surface lands the `z` re-export today ; Money/EuroAmount/IsoDate/Percent/tabularNum helpers ship in a follow-up story without forcing consumers to re-migrate. Direct `zod` dependency removed from `apps/web`, `apps/api`, `packages/validators` package.json files. Codified in PR #86 commit 29202bb.
- **R11** — Folder-by-domain layout inside every `packages/<pkg>/src/`. The original decision was silent on internal layout ; flat files at the package root were the implicit pattern. R11 mandates `src/index.ts` (aggregate barrel) + `<domain>/<domain>.<suffix>.ts` + `<domain>/index.ts` (domain barrel) so cross-domain navigation is uniform with the apps/api module shape. Codified in PR #86 commits dfaa280 + ec8115e.

See `docs/architecture.md` Phase 3 — Audit-derived conventions (2026-05-20 — PR #86) for the canonical statement and consumer rules.
