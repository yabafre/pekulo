---
step: 2
reads:
  - "docs/**"
  - ".aped/**"
  - "docs/**"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 2: Input Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER skip discovery — story content is biased by every loaded artefact
- 📖 Load every discovered file completely (no offset/limit)
- ✋ HALT for `[C]` confirmation before proceeding to selection
- 🚫 Treat lessons as enforcement, not advice (apply them to the draft)

## CONTEXT BOUNDARIES

- Mode (worktree / solo) is known from step 01.
- `state.yaml` is loaded.
- Story key may already be pinned (worktree mode) or pending selection (solo).

## YOUR TASK

Discover upstream APED artefacts, load them, report to the user, and bias the rest of the workflow.

## DISCOVERY

### 1. Glob

Search these locations in order:

- `docs/**`
- `.aped/**`
- `docs/**` (project root)

Look for these artefacts (✱ = required):

- Epics — `epics.md` ✱
- PRD — `*prd*.md` or `prd.md`
- UX Spec — `ux/*.md` (sharded: design-spec, screen-inventory, components, flows)
- Architecture — `*architecture*.md` or `architecture.md`
- Product Brief — `*brief*.md` or `product-brief.md`
- Project Context — `*context*.md` or `project-context.md`
- Lessons — `docs/lessons.md` (filter `Scope: aped-story` or `Scope: all`)
- Previous stories — `docs/stories/*.md` from completed stories of the current epic

### 2. Required-input validation (hard-stop)

For ✱ Epics:
- Found → continue.
- Missing → HALT: *"Story preparation requires `epics.md` (the story plan). Run `aped-epics` first."*

### 3. Load + report

Load every discovered file completely. Brownfield is detected from `project-context.md` presence.

Present a discovery report (adapt to `communication_language`):

> Setting up `aped-story` for {project_name}.
>
> **Documents discovered:**
> - Epics: {N} files {✓ loaded — {M} stories indexed | ✱ MISSING — HALT}
> - PRD: {N} files {✓ loaded — FRs cross-referenced for the story | (none)}
> - UX Spec: {N} files {✓ loaded — story will reference screens/components | (none)}
> - Architecture: {N} files {✓ loaded — story respects pattern decisions | (none)}
> - Project Context: {N} files {✓ loaded (brownfield) | (none)}
> - Lessons: {N} entries scoped to `aped-story` or `all` {✓ applied to draft | (none — first epic)}
> - Previous stories: {N} completed stories in epic {epic#} {✓ loaded for continuity | (none — first story of epic)}
>
> **Files loaded:** {comma-separated filenames}
>
> [C] Continue to story selection
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.**

### 4. Bias the rest of the workflow

Loaded artefacts inform story-file content:

- Acceptance criteria reference PRD FRs by ID (e.g. "FR-12, FR-13").
- Implementation notes reference architecture decisions by section.
- Frontend stories list concrete components/screens from the UX spec.
- In brownfield mode, story files include "files to modify" pulled from `project-context.md` rather than only "files to create".
- **Lessons are applied to the draft, not just acknowledged.** For each loaded lesson with scope `aped-story` or `all`:
  - Apply its `Rule:` to the story being drafted (e.g. if Epic 1's lesson was "always split auth from authz", check whether the new story conflates them and propose splitting).
  - Cite the lesson in Discussion Points: "Per Epic {N}'s retro lesson on `{topic}`, I'd suggest {adjustment}. Override?"
  - This is the feedback loop the retro phase exists for — do not treat lessons as advisory.
- **Previous stories of the current epic** inform continuity:
  - Reuse decisions made in earlier stories rather than re-litigating them (e.g. if story 1-1 chose Zod for validation, story 1-2 doesn't re-evaluate validation library).
  - Surface implicit dependencies ("story 1-3 builds on the schema introduced in 1-1").
  - Avoid contradictions in technical approach across the same epic.

## SUCCESS METRICS

✅ Globs ran in all three locations.
✅ Epics file loaded (or HALT triggered).
✅ Discovery report shown to user; user confirmed `[C]`.
✅ All discovered files loaded completely (no offset/limit).

## FAILURE MODES

❌ Proceeding without `[C]` confirmation — short-circuits the user check.
❌ Loading partial files (offset/limit) — incomplete context biases the draft.
❌ Skipping the lesson scan — re-introduces mistakes the retro already caught.
❌ Treating Epics as optional — it's the source of the story list.

## NEXT STEP

After `[C]` confirmation, load `.aped/aped-story/steps/step-03-story-selection.md` to pick the story and (in solo mode) create the feature branch.
