---
step: 2
reads:
  - "docs/stories/{story-key}.md"
  - "docs/**"
  - ".aped/**"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 2: Input Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The story file is required (✱) — HALT if missing
- 📖 Load every discovered file completely (no offset/limit)
- 🚫 Lessons are enforced, not advisory

## CONTEXT BOUNDARIES

- Mode known, branch verified, state.yaml loaded.
- Story key resolved (worktree marker) or deferred (solo).

## YOUR TASK

Discover and load upstream APED artefacts so the TDD cycle is grounded in real ACs, real FR/NFR IDs, and real architecture decisions.

### Worktree perspective

In worktree mode, glob from the worktree's checkout — discovery sees the feature branch's view of the docs, which is what the story implementation should ground in.

## DISCOVERY

### 1. Glob

Search these locations in order:

- `docs/**`
- `.aped/**`
- `docs/**` (project root)

Look for these artefacts (✱ = required):

- Story file — `docs/stories/{story-key}.md` ✱ (resolved after Worktree Mode Detection in step 01)
- PRD — `*prd*.md` or `prd.md`
- Architecture — `*architecture*.md` or `architecture.md`
- UX Spec — `ux/*.md` (sharded: design-spec, screen-inventory, components, flows)
- Epic Context Cache — `docs/epic-{N}-context.md` (where N = epic number from story key)
- Project Context — `*context*.md` or `project-context.md`
- Product Brief — `*brief*.md` or `product-brief.md`
- Lessons — `docs/lessons.md` (filter `Scope: aped-dev` or `Scope: all` — produced by `aped-retro` after each epic)

### 2. Required-input validation (hard-stop)

For ✱ Story file:
- Found → continue.
- Missing → HALT: *"No story file found at `docs/stories/{story-key}.md`. Run `aped-story` first to prepare it."*

### 3. Load + report

Load every discovered file completely. Brownfield is detected via `project-context.md` presence.

In **classic (non-worktree)** mode, present a full discovery report and HALT for `[C]` confirmation.
In **worktree mode**, log a one-liner — the worktree was launched by `aped-sprint` with auto-injected prompt, no human at the keyboard:

> Implementing story {story-key} in {project_name}.
> Loaded: PRD ({M} FRs), Architecture {✓|—}, UX Spec {✓|—}, Project Context {✓ brownfield|—}, Epic Context Cache {✓ fresh|recompiling|—}, Lessons ({K} dev-scoped rules to enforce).

### 4. Bias the rest of the workflow

Loaded artefacts inform every TDD cycle:

- Tests assert behaviour described in the story's ACs, which reference PRD FRs by ID.
- Implementation respects naming conventions, layering, and patterns from the architecture document.
- Frontend tasks render the components listed in the UX spec, not invented ones.
- In brownfield mode, *Existing Patterns Are Law* (see step 03 Guiding Principles) — patterns documented in `project-context.md` win even over architecture decisions if the architecture decision was made for greenfield work.
- **Lessons are enforced, not advisory.** For each loaded lesson with scope `aped-dev` or `all`:
  - The `Rule:` becomes a check in the Pre-Implementation Checklist (step 03).
  - When the lesson's `Mistake:` matches a pattern detectable in the current task, surface it before writing code.
  - Lessons that contradict the story's ACs win — flag the conflict to the user rather than silently overriding.

### 4b. Update the epic-context cache to reflect lessons

The epic-context cache (compiled in step 04) has lessons as a 4th input source. When recompiling, lessons scoped `aped-dev` or `all` are interpolated into the "Key code patterns" section so they're surfaced inline during implementation, not just at skill entry.

### Fresh-read discipline

Read every source-of-truth file fresh in this skill — story file, PRD, architecture, UX spec, lessons. Never trust a cached or compacted summary. If your context shows you a "summary of the PRD" instead of the file content, Read the file from disk. The TDD discipline below depends on the agent grounding tests in real ACs, real FR IDs, real architecture decisions — not on its memory of them.

## SUCCESS METRICS

✅ Story file loaded (or HALT triggered).
✅ Classic mode: discovery report shown, user confirmed `[C]`.
✅ Worktree mode: one-line log emitted.
✅ Brownfield/greenfield detected.

## FAILURE MODES

❌ Proceeding without a story file — there's nothing to implement.
❌ Loading partial files — incomplete context produces wrong tests.
❌ Treating lessons as advisory — re-introduces mistakes the retro caught.

## NEXT STEP

Load `.aped/aped-dev/steps/step-03-pre-implementation.md` to walk the Pre-Implementation Checklist before any task starts.
