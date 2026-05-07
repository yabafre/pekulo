---
step: 2
reads:
  - "docs/stories/{story-key}.md"
  - "docs/epics-context/epic-{N}-context.md"
  - "docs/architecture.md"
  - "docs/lessons.md"
  - ".aped/**"
writes: []
mutates_state: false
---

# Step 2: Input Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The story file AND the epic-context cache are required (✱) — HALT if either missing
- 📖 Load every discovered file completely (no offset/limit)
- 🚫 Do NOT load raw PRD / UX / Project Context — that's the cache's job (6.2.0+)
- 🚫 Lessons are enforced, not advisory

## CONTEXT BOUNDARIES

- Mode known, branch verified, state.yaml loaded.
- Story key resolved (worktree marker) or deferred (solo).
- Epic N inferable from the story key (`{epic}-{num}-{slug}`).

## YOUR TASK

Discover and load upstream APED artefacts so the TDD cycle is grounded in real ACs, real FR/NFR IDs, and real architecture decisions. **`aped-dev` is a cache consumer, not a re-compiler** — the epic-context cache (produced by `aped-story`) carries the cross-cutting epic knowledge so the per-story token bill stays flat.

### Worktree perspective

In worktree mode, glob from the worktree's checkout — discovery sees the feature branch's view of the docs, which is what the story implementation should ground in.

## DISCOVERY

### 1. Inputs

Load each of these (✱ = required):

- ✱ Story file — `docs/stories/{story-key}.md`.
- ✱ Epic context cache — `docs/epics-context/epic-{N}-context.md` (N = epic number from story key, e.g. `1-2-jwt` → epic 1).
- Architecture — `docs/architecture.md` (full load — patterns are LAW for dev; architecture stays primordial, not in the cache).
- Lessons — `docs/lessons.md` (filter `Scope: aped-dev` or `Scope: all` — produced by `aped-retro` after each epic).
- Last done story of same epic — the most recent `docs/stories/{epic}-*.md` with status `done` (continuity for fine-grain decisions; skip if first story of epic).

**Do NOT load** PRD, UX spec, project-context, or product brief raw. Their relevant excerpts already live in the epic-context cache. If you find yourself wanting one of them, the cache is incomplete — re-run `aped-story` to refresh it.

### 2. Required-input validation (hard-stop)

For ✱ Story file:
- Found → continue.
- Missing → HALT: *"No story file found at `docs/stories/{story-key}.md`. Run `aped-story` first to prepare it."*

For ✱ Epic context cache:
- Found → continue.
- Missing → HALT: *"No epic context cache found at `docs/epics-context/epic-{N}-context.md`. Run `aped-story` first — it compiles the cache so `aped-dev` can stay token-light. Do not work around this by loading PRD/UX/architecture raw — that's exactly the drift the cache exists to prevent."*

### 3. Load + report

Load every required file completely. Brownfield context lives in the cache — if the cache's "Project context (brownfield only)" section is non-empty, treat the story as brownfield.

In **classic (non-worktree)** mode, present a full discovery report and HALT for `[C]` confirmation.
In **worktree mode**, log a one-liner — the worktree was launched by `aped-sprint` with auto-injected prompt, no human at the keyboard:

> Implementing story {story-key} in {project_name}.
> Loaded: Story ✓, Epic Context Cache ✓, Architecture {✓|—}, Lessons ({K} dev-scoped rules), Last done story of epic {epic#} {✓ {key}|— first story}.

### 4. Bias the rest of the workflow

Loaded artefacts inform every TDD cycle:

- Tests assert behaviour described in the story's ACs, which reference FR IDs from the cache's "Scope from PRD" section.
- Implementation respects naming conventions, layering, and patterns from `architecture.md` (full load — patterns are LAW for dev) and the cache's "Architecture references" cross-references.
- Frontend tasks render the components listed in the cache's "UX references" section.
- Brownfield context lives in the cache's "Project context" section — if non-empty, *Existing Patterns Are Law* (see step 03 Guiding Principles).
- **Lessons are enforced, not advisory.** For each loaded lesson with scope `aped-dev` or `all`:
  - The `Rule:` becomes a check in the Pre-Implementation Checklist (step 03).
  - When the lesson's `Mistake:` matches a pattern detectable in the current task, surface it before writing code.
  - Lessons that contradict the story's ACs win — flag the conflict to the user rather than silently overriding.

### Fresh-read discipline

Read every required file fresh in this skill — story file, epic-context cache, architecture, lessons, last done story. Never trust a cached or compacted summary in your conversation memory. If your context shows you a "summary of the cache" instead of the file content, Read the file from disk. The TDD discipline below depends on grounding tests in real ACs, real FR IDs, real architecture decisions — not on agent memory of them.

The epic-context cache itself is a *distillate*, not a *summary in your head* — it's a real file on disk produced by `aped-story` and re-read at every skill entry.

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
