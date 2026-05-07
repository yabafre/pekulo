---
step: 1
reads:
  - "docs/stories/{story-key}.md"
  - "docs/epics-context/epic-{N}-context.md"
  - "docs/architecture.md"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 1: Setup — Mode, Story, Inputs, File Surface

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

## Fresh-read discipline

Read every artefact fresh in this skill — story file, epic-context cache, architecture, lessons. Never trust a cached or compacted summary in agent memory; reviewing against a stale summary produces stale findings. If the context shows a "summary of the cache" instead of the file content, Read the file from disk.

## Fresh-context hard stop

If this Claude session just implemented this story (the implementation transcript is above this skill invocation), abort immediately:

> ❌ Reviewer must run fresh — prior implementation context will bias the review. Run `/clear` then re-invoke `aped-review` for this story.

A reviewer running in the dumb zone (post-100k tokens, post-compaction) reviews dumber than the agent that wrote the code. Fresh-read catches summary-vs-file drift; a clean session catches reasoning-vs-fresh-eyes drift.

## Mode + story key

Detect mode by checking `.aped/WORKTREE`:

- **Worktree mode** (file exists) — story key is in the marker. Auto-flow, no [C] gate.
- **Solo mode** — resolve from arg, then from `state.yaml.sprint.stories` (first story with status `review`).

If no story key resolvable, HALT and ask the user which one.

Verify the current branch matches the story's expected feature branch (`feature/{ticket}-{slug}`). If not, HALT and surface the mismatch.

## Required inputs (HALT on missing)

- ✱ **Story file** — `docs/stories/{story-key}.md`. Missing → *"No story file. Run `aped-story` first."*
- ✱ **Epic-context cache** — `docs/epics-context/epic-{N}-context.md` (N = epic number from story key). Missing → *"No epic context cache. Run `aped-story` first — never work around with raw PRD/UX loads, that's the drift the cache exists to prevent."*

## Soft inputs (load if present)

- `docs/architecture.md` — full file. Patterns are LAW. Missing → WARN, Code auditor runs in degraded mode.
- `docs/lessons.md` — filter `Scope: aped-review` or `Scope: all`.
- Last `done` story of the same epic — `docs/stories/{epic}-*.md` with status `done` (most recent). Skip if first story of epic.

**Do NOT load** raw PRD / UX / project-context. Their excerpts live in the cache. If you find yourself wanting one, the cache is incomplete — re-run `aped-story` to refresh it.

## File surface (drives Code auditor lens + Aria opt-in)

Read the story's File List. Detect:

- **backend** — server code (`apps/api`, `services/`, `packages/*/src`, `.py`, `.go`, `.rs`, `.java`, business logic).
- **frontend** — `.tsx`, `.jsx`, `.vue`, `.svelte`, `apps/web`, `src/pages`, `src/components`.
- **infra** — `.github/workflows`, `Dockerfile`, terraform, k8s, cdk.

Set the surface flags. They parameterise the Code auditor prompt in step 02 and decide whether Aria gets dispatched.

## Discovery report

Worktree mode (auto-injected, no human at the keyboard) — log a one-liner:

> Reviewing `{story-key}` ({surface}). Cache ✓, architecture {✓|⚠ degraded}, lessons {K}, last done story {key|—}.

Solo mode — present the report and HALT for `[C]`:

> Reviewing `{story-key}` in `{project_name}`.
> Surface: {backend|frontend|infra|cross-layer}
> Loaded: Story ✓, Epic Context ✓, Architecture {✓|⚠ degraded}, Lessons ({K}), Last done story {key|first story}.
>
> [C] Continue to dispatch
> [Other] Add a file path / paste content — I'll redisplay

## NEXT

Read fully and follow `.aped/aped-review/steps/step-02-dispatch.md`.
