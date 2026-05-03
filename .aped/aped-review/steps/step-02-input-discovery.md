---
step: 2
reads:
  - "docs/stories/{story-key}.md"
  - "docs/**"
  - "docs/lessons.md"
  - "ticket/{provider}"
writes: []
mutates_state: false
---

# Step 2: Input Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The story file is required (✱) — HALT if missing
- 📖 Load every discovered file completely (no offset/limit)
- 🚫 Lessons become explicit checks, not implicit advisory

## CONTEXT BOUNDARIES

- Mode known, story key resolved (step 01).
- Fresh-context guard passed.

## YOUR TASK

Discover and load every upstream APED artefact. Bias each specialist's review with the loaded artefacts.

## DISCOVERY

### 1. Glob

Search these locations in order (in worktree mode, glob from the worktree's checkout):

- `docs/**`
- `.aped/**`
- `docs/**` (project root)

Look for these artefacts (✱ = required):

- Story file — `docs/stories/{story-key}.md` ✱
- PRD — `*prd*.md` or `prd.md`
- Architecture — `*architecture*.md` or `architecture.md` (strongly recommended — without it, the Pattern Compliance specialist runs in degraded mode)
- UX Spec — `ux/*.md` (sharded: design-spec, screen-inventory, components, flows)
- Epic Context Cache — `docs/epic-{N}-context.md`
- Project Context — `*context*.md` or `project-context.md`
- Product Brief — `*brief*.md` or `product-brief.md`
- Lessons — `docs/lessons.md` (filter `Scope: aped-review` or `Scope: all`)

### 2. Required-input validation (hard-stop)

For ✱ Story file:
- Found → continue.
- Missing → HALT: *"No story file found at `docs/stories/{story-key}.md`. The story may not have been prepared, or the story key is wrong."*

For Architecture (recommended, not required):
- Missing → WARN: *"No `architecture.md` found. Pattern Compliance review will operate in degraded mode (specialist must infer conventions from the codebase). Consider running `aped-arch` first if patterns matter for this review."*
- Continue without HALT.

### 3. Load + report

Load every discovered file completely. Brownfield is detected via `project-context.md` presence.

In **classic** mode, present the full discovery report and HALT for `[C]` confirmation:

> Reviewing story {story-key} in {project_name}.
> Loaded: Story ✓, PRD {✓|—}, Architecture {✓|⚠ missing — degraded mode}, UX Spec {✓|—}, Epic Context {✓|—}, Project Context {✓ brownfield|—}, Lessons ({K} review-scoped rules to enforce).
>
> [C] Continue to classification & dispatch
> [Other] Add a file path / paste content — I'll load it and redisplay

In **worktree** mode, log a one-liner — `aped-review` is auto-launched without a human at the keyboard:

> Reviewing story {story-key}. Loaded: Story ✓, PRD {✓|—}, Architecture {✓|⚠ degraded}, ...

### 4. Bias the rest of the workflow

Loaded artefacts inform every specialist's review:

- Pattern Compliance specialist checks code against `architecture.md` conventions and (in brownfield mode) `project-context.md` existing patterns.
- AC Coverage specialist cross-references the story's ACs back to PRD FRs.
- Frontend specialist (when applicable) verifies UX spec components are used as specified.
- Edge Case Hunter pulls scenarios from PRD NFRs and (in brownfield mode) from existing-system constraints.
- **Lessons become explicit checks, not implicit advisory.** For each loaded lesson with scope `aped-review` or `all`:
  - The `Rule:` is added to the relevant specialist's checklist (e.g. if Epic 1's lesson was "always verify error states are reachable in the UI", the Frontend specialist gets that as a mandatory check).
  - The `Mistake:` from the lesson becomes a specific finding category — the team is explicitly asked *"did this story repeat the {Mistake} we identified after Epic {N}?"*.
  - A lesson never "passes review by default" — if the relevant specialist can't confirm the rule was applied, that's a finding, not a non-event.
  - When dispatching specialists in step 04 / 06, include the lesson set scoped to that specialist in their prompt so their criteria are augmented at runtime, not just gathered post-hoc.

## SUCCESS METRICS

✅ Story file loaded (or HALT).
✅ Architecture absence handled (warn + degraded mode, no HALT).
✅ Classic mode: discovery report shown, `[C]` confirmed.
✅ Worktree mode: one-line log emitted.
✅ Lessons mapped to specialist prompts.

## FAILURE MODES

❌ Proceeding without a story file — there's nothing to review.
❌ Treating architecture absence as a HALT — degrades but doesn't block.
❌ Treating lessons as advisory — re-introduces mistakes the retro caught.

## NEXT STEP

Load `.aped/aped-review/steps/step-03-classify-and-prepare.md` to classify the story, check review capacity, and prepare specialist dispatch.
