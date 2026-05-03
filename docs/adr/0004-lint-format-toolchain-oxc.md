# Lint + format toolchain — oxlint + oxfmt

**Date:** 2026-05-03
**Status:** accepted
**Decided by:** Alex

## Context

The brownfield project uses `eslint-config-next` v16 as its sole linter and ships no formatter. Monorepo-wide ESLint runs are slow ; the absence of a formatter has produced inconsistent code style across `apps/web`, `apps/prices`, and incoming `packages/ui` work.

## Decision

- **Linter: `oxlint`** (Oxc, Rust-based) replaces `eslint-config-next` for the JavaScript / TypeScript surface. Configuration via `.oxlintrc.json` at the monorepo root. The `next/core-web-vitals` rules are reproduced via oxlint's Next plugin ; any rule with no oxlint equivalent is documented as a known gap and tracked.
- **Formatter: `oxfmt`** (Oxc, alpha) adopted across all `*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs`, `*.json` files. Pin a known-good version ; audit on every bump.
- Both run on pre-commit (`lefthook`) and CI (`pr.yml` matrix).

## Why

- Performance: oxlint reports 50–100× faster than ESLint on similar rule sets — material at monorepo scale.
- Toolchain coherence: a single Rust-backed engine for both lint and format reduces dependency surface and CI minutes.
- User-explicit choice (Alex requested oxlint + oxfmt directly).

## Considered options

- **Stay on ESLint + add Prettier** — rejected: keeps the perf cost ; formatting work would still be needed.
- **Biome (ex-Rome)** — rejected: oxc preferred for tighter Next.js rule parity at the time of decision.

## Consequences

- **oxfmt is pre-1.0 (alpha).** Risks: rule churn between releases, incomplete edge cases. Mitigation: pin version, audit on every bump, accept short-term cost of revisiting if a rule changes shape.
- ESLint disabled at root ; per-app ESLint configs removed in the same PR that lands oxlint.
- IDE integrations needed (`oxc.oxc-vscode` extension or equivalent) — documented in onboarding.
