---
name: aped-context
keep-coding-instructions: true
description: 'Brownfield entry-point — use when user says "document codebase", "project context", "existing project", "existing codebase", "legacy project", "onboarding to a codebase", "aped context", or invokes aped-context. The default first step for any brownfield project before aped-analyze; runs alongside aped-analyze on hybrid projects (new feature in a legacy system).'
allowed-tools: "Read Grep Glob Bash"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.12.2
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Context — Brownfield Entry-Point

**The default first step for any project that already has code.** Walks the existing codebase to generate `project-context.md` — language, framework, directory layout, entry points, conventions, integration boundaries, and a brownfield/greenfield/hybrid verdict. Downstream APED skills (`aped-analyze`, `aped-prd`, `aped-ux`, `aped-arch`, etc.) discover this file at entry and bias their behaviour accordingly: a brownfield verdict steers them away from greenfield assumptions like "pick a stack" or "design from scratch".

Run this before `aped-analyze` on any existing codebase. On hybrid projects (a new feature in a legacy system) both apply — they are no longer mutually exclusive. Skip only when scaffolding a true greenfield (empty directory or freshly initialised repo): the skill emits a "produces no useful output" advice in that case.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Setup

1. Confirm there is existing code to analyse (if the directory is empty / freshly initialised, tell the user this skill produces no useful output — they should run `aped-analyze` instead)
2. Read `.aped/aped-context/references/analysis-checklist.md` for the full analysis checklist

## Codebase Analysis

### Phase 1: Structure Discovery

Scan the project root:
- Detect language/framework from config files (package.json, Cargo.toml, go.mod, pyproject.toml, etc.)
- Map directory structure (max 3 levels deep)
- Identify entry points, main modules, config files
- Count: files, LOC, languages used

### Phase 2: Architecture Mapping

- Identify architectural pattern (MVC, hexagonal, microservices, monolith, etc.)
- Map data flow: entry point → processing → storage → response
- List external dependencies and integrations (APIs, databases, queues, caches)
- Identify test framework and coverage approach

### Phase 3: Convention Extraction

- Naming conventions (files, functions, variables, classes)
- Code organization patterns (feature-based, layer-based, domain-based)
- Error handling patterns
- Logging approach
- Config management (env vars, config files, secrets)

### Phase 4: Dependency Audit

- List production dependencies with versions
- Flag outdated or deprecated packages
- Identify security advisories (if available)
- Note lock file type (package-lock, yarn.lock, pnpm-lock, etc.)

## Phase 5: Doc Freshness Audit

For every documentation file discovered in the project root or `docs/` (e.g. `README.md`, `requirements.md`, `architecture.md`, `prd.md`, `design.md`, ADRs), classify by freshness against the code it describes:

```bash
# Detect shallow checkouts up-front — `git log` against a depth-1 clone returns
# only the latest commit and silently makes every doc look fresh. Mark every doc
# `unknown` instead of inviting that false-positive.
if [[ "$(git rev-parse --is-shallow-repository 2>/dev/null)" == "true" ]]; then
  echo "⚠ shallow git history — marking every doc as unknown (re-run after \`git fetch --unshallow\` for accurate freshness)."
  classification=unknown
else
  # For each candidate doc:
  doc_mtime=$(git log -1 --format=%cI -- "$doc" 2>/dev/null)
  # For each top-level src/app directory the doc references (or all of src/ if generic):
  code_mtime=$(git log -1 --format=%cI -- "$module" 2>/dev/null)
  # If either is empty (no git history for this path) → unknown, never fresh.
  # If doc_mtime predates code_mtime by >30 days → stale
fi
```

Three classifications:
- **`fresh`** — doc was last touched after the most-recent commit on the modules it references, OR within 30 days of the latest code change.
- **`stale`** — doc predates the latest code change by >30 days. The codebase has likely drifted past what the doc describes; downstream skills MUST NOT treat this doc as source-of-truth without explicit user override.
- **`unknown`** — git history cannot resolve (file untracked, repo shallow, doc references nothing in `src/`). Treat as `stale` for routing purposes — never `fresh`.

Surface the classification in the discovery report and in `project-context.md`'s `## Notes for Development` section. Stale docs get an explicit warning line:

> ⚠ `docs/requirements.md` is **stale** (last edited 2025-09-12; latest commit on `src/auth/` is 2026-03-17). Treat as historical context, not authoritative spec. Re-run `aped-prd` if a fresh requirement is needed.

When a downstream skill (`aped-analyze`, `aped-prd`, `aped-arch`) tries to load a doc marked `stale` from `project-context.md`, it must ask the user whether to (a) refresh the doc first, (b) use it as historical context only, or (c) override and treat as authoritative. The reasoning: a month later, the actual code has often changed enough that the original PRD becomes unrecognizable.

## Self-review (run before user gate)

Before presenting the project context to the user, walk this checklist. Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Placeholder lint** — run `bash .aped/scripts/lint-placeholders.sh docs/project-context.md`.
- [ ] **Tech stack complete** — every primary language, framework, and major dependency is listed (downstream skills treat this as the definitive list).
- [ ] **Conventions concrete** — named patterns and concrete examples, not "follow standard practices".
- [ ] **Integration points enumerated** — every external system the project talks to (APIs, databases, queues) appears with its role.
- [ ] **No bare "see the codebase"** — if a convention exists, name it; if it doesn't, say so explicitly.
- [ ] **Doc freshness classified** — every documentation file under root or `docs/` is tagged `fresh` / `stale` / `unknown` based on its mtime versus the modules it describes. Stale docs carry an explicit warning in `project-context.md`.

## Output

Write project context to `docs/project-context.md`:

```markdown
# Project Context: {project_name}

## Tech Stack
- Language: {lang} {version}
- Framework: {framework} {version}
- Database: {db}
- Test Framework: {test_framework}

## Architecture
- Pattern: {pattern}
- Entry Point: {entry}
- Key Modules: {modules}

## Conventions
- File naming: {convention}
- Code style: {style}
- Error handling: {pattern}

## Dependencies
| Package | Version | Purpose |
|---------|---------|---------|

## Integration Points
- {service}: {purpose}

## Notes for Development
- {important context for new feature development}
```

## State Update

Update `docs/state.yaml` under `pipeline.phases.context` with the structured fields below. The block is the canonical record of *which* kind of project this is — downstream skills read `type` to decide whether to apply brownfield bias.

```yaml
pipeline:
  phases:
    context:
      generated: true
      path: "docs/project-context.md"
      type: "brownfield"        # brownfield | greenfield | hybrid
      generated_at: "<YYYY-MM-DD>"   # set on FIRST run; preserved across re-runs
      refreshed_at: "<YYYY-MM-DD>"   # set on every run (including the first)
```

### `type` derivation rules

- `type: "brownfield"` — existing repository with code already present (Phase 1 found a non-trivial source tree, package files like `package.json` / `Cargo.toml` / `pyproject.toml`, multiple modules, prior commits beyond scaffolding).
- `type: "greenfield"` — empty repository or scaffold-only (no source code beyond what `create-aped` / template generators produced; commit history is just the initial scaffolding).
- `type: "hybrid"` — mixed: a new module/feature is being grafted onto an existing system (e.g. greenfield `apps/new-feature/` inside a brownfield monorepo). Use `hybrid` when the user has explicitly framed the work as "new feature in legacy system" OR when Phase 1 finds both legacy modules with mature conventions AND fresh scaffold areas with none.

### `generated_at` vs `refreshed_at`

- On the **first** run, set both `generated_at` and `refreshed_at` to today (YYYY-MM-DD).
- On a **re-run** (the existing `phases.context.generated_at` is already set), preserve `generated_at` verbatim and only update `refreshed_at` to today. Do not overwrite `generated_at` — it's the original-context anchor.

## Next Steps

The generated `project-context.md` is now discoverable by every downstream APED skill. Suggest based on what the user has already produced:
- No brief yet → run `aped-analyze` (it will discover and consume the context automatically — no flag needed)
- Brief exists, no PRD → run `aped-prd` (same — auto-consumes the context)
- PRD exists → context will be picked up by `aped-arch`, `aped-ux`, `aped-dev`, `aped-review`, `aped-from-ticket`

## Example

Scanning a Next.js SaaS project → project-context.md:
- Stack: TypeScript, Next.js 14, Prisma, PostgreSQL
- Pattern: App Router, server components, feature-based folders
- Conventions: camelCase files, Zod validation, Tailwind CSS
- 45 dependencies, 3 outdated, 0 security advisories

## Common Issues

- **No package.json/Cargo.toml found**: Project may be multi-language or unconventional — scan for entry points manually
- **Very large codebase (>1000 files)**: Focus on src/ and key config files, don't scan node_modules or build output
- **Monorepo detected**: Document each package/app separately in the context file
