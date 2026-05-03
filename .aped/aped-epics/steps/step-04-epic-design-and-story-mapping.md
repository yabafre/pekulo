---
step: 4
reads:
  - "docs/prd.md"
  - ".aped/aped-epics/references/epic-rules.md"
writes: []
mutates_state: false
---

# Step 4: Epic Design + Story Mapping + Running FR Coverage Matrix

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 EVERY PRD FR maps to exactly one epic — no orphans, no phantoms
- 🛑 Surface the running coverage matrix at end of every epic
- 🚫 NEVER create story files here — `aped-story` does that one at a time later

## CONTEXT BOUNDARIES

- FR/NFR list extracted (step 03).
- Epic-level file map sketched.

## YOUR TASK

Design epics (user-value groupings), produce the per-epic story list (entries only, no story files), and surface a running FR coverage matrix.

## EPIC DESIGN — CORE RULES

Read `.aped/aped-epics/references/epic-rules.md` for design principles.

1. **User value first** — each epic delivers COMPLETE functionality for its domain.
2. **Independent epics** — each stands alone, no forward dependencies.
3. **User-outcome naming** — epic names describe what users can do.
4. **Starter template rule** — if project needs scaffolding, Epic 1 Story 1 = project setup.

## STORY LISTING (NOT story files)

For each epic, list the stories with:

- **Title** — what the story achieves (user-facing outcome).
- **Story key** — `{epic#}-{story#}-{slug}` (slug from title, lowercase, hyphens, max 30 chars).
- **Summary** — 1-2 sentences of scope.
- **FRs covered** — list explicit FR IDs from the PRD (e.g. `FR-1, FR-3, FR-7`), never vague descriptions like *"auth-related FRs"*. Every listed ID must exist in the loaded PRD.
- **Acceptance Criteria** — high-level Given/When/Then (will be refined in `aped-story`).
- **Estimated complexity** — S / M / L.
- **Depends on** — comma-separated list of story keys this one blocks on, or `none`.

Pick dependencies conservatively: if story B *needs* an artefact produced by story A (contract, schema, shared util), list A. If B only shares files with A but could technically be rebased after, no dep — parallel sprint wins. *"Pure foundation"* stories (1-1 auth scaffold, 1-1 schema base) usually have `depends_on: none` and unlock a fan-out.

## RUNNING FR COVERAGE MATRIX

After completing each epic's story list (NOT only at the end of all epics), update a running FR-coverage matrix and surface it to the user before moving to the next epic. Three columns:

| FR ID | Covered by | Status |
|-------|------------|--------|
| FR-1  | 1-1-init, 1-2-schema | ✓ covered |
| FR-2  | (none)               | ✗ uncovered |
| FR-3  | 1-1-init, 2-1-flow, 2-2-export, 3-1-bulk | ⚠ multi-cover (4) |

Surface the matrix at three trigger points:

1. **End of every epic's story list** — running matrix shows which FRs are now covered, which are still uncovered, and which are multi-covered.
2. **Immediately when an FR is covered by ≥3 stories** — likely an over-fragmented requirement; flag for user review (split? merge? rename?).
3. **Immediately when ≥30% of FRs remain uncovered after 50% of estimated stories have been drafted** — sequencing risk; likely a missed epic. Pause the listing and surface to the user.

The end-of-skill `## FR Coverage Map` is the **final** coverage report (step 06); this running matrix is what the user sees during the design loop.

Surfacing coverage early prevents the *"Story 14 is the only place FR-7 lands"* surprise that is painful to fix late in the pipeline.

## DO NOT CREATE STORY FILES

The user will run `aped-story` to create each one individually before implementing it. Step 04 produces a STORY LIST, not story files.

## SUCCESS METRICS

✅ Every PRD FR appears in at least one story's `Covered FRs` list.
✅ All story keys are unique and follow `{epic#}-{story#}-{slug}` convention.
✅ Running matrix surfaced after each epic.
✅ No story files written.

## FAILURE MODES

❌ Vague *"auth-related FRs"* citations — breaks coverage validation downstream.
❌ Forward dependencies (story 1 in epic 1 depending on a story in epic 3) — restructure or merge.
❌ Creating `docs/stories/*.md` — that's `aped-story`'s job, not this skill's.

## NEXT STEP

Load `.aped/aped-epics/steps/step-05-discussion-apc.md` for the user A/P/C gate.
