---
step: 3
reads:
  - "docs/prd.md"
  - "docs/architecture.md"
  - "docs/ux/**"
writes: []
mutates_state: false
---

# Step 3: FR Extraction + Epic-level File Structure Design

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Every FR ID extracted MUST exist in the loaded PRD — never invent
- 🛑 File design splits by responsibility, NOT by technical layer
- 🚫 Two stories of the same epic MUST NOT both create the same file from scratch

## CONTEXT BOUNDARIES

- PRD loaded; FR/NFR list known.
- Architecture / UX may inform the file map.

## YOUR TASK

Extract every FR/NFR ID from the PRD. Sketch the file boundaries the epic will touch across stories.

## FR / NFR EXTRACTION

For each FR / NFR in the PRD, capture:

- **ID** (verbatim from PRD — e.g. `FR-1`, `NFR-3`).
- **Title** (verbatim).
- **Source section** in the PRD.

Hold the list as a structured table for use in step 04 (story mapping).

If you encounter an identifier in the PRD that doesn't follow the expected `FR-N` / `NFR-N` format, surface it to the user — never normalize silently.

## EPIC-LEVEL FILE STRUCTURE DESIGN

Before breaking epics into stories, sketch the file boundaries the epic will touch **across stories**. Story-level file design (in `aped-story`) keeps each story's files coherent; epic-level file design ensures stories within the same epic don't fight over the same modules and that files-that-change-together stay in the same story.

**Split by responsibility, not by technical layer.** An epic delivering "user auth" is not "story 1 = backend, story 2 = frontend, story 3 = tests" — that's the layer trap. The right split is by user-value slice (registration, sessions, password reset), where each slice cuts vertically through layers and ships independently.

For each epic, write a 3-bullet decision per major file area:

- **File area + path prefix** — the directory or module each story owns (e.g. `src/auth/` for the auth epic, `apps/web/src/payments/` for payments).
- **Single responsibility** — one sentence stating what this area is for, in user-value terms.
- **Inputs + outputs** — what this area depends on and what it exposes.

## RACE CONDITIONS

Two stories of the same epic MUST NOT both create the same file from scratch (race in the parallel sprint). Two stories MAY both modify the same file, provided the second one's `depends_on:` lists the first.

## SUCCESS METRICS

✅ Every PRD FR / NFR captured with verbatim ID + title.
✅ Epic-level file map sketched (3-bullet template per major area).
✅ No two stories planning to create the same file from scratch.

## FAILURE MODES

❌ Inventing FR IDs — downstream skills (story, dev) cite them and fail when they don't exist.
❌ Splitting by technical layer (story 1 = backend, story 2 = frontend) — produces stories that all need each other to ship.

## NEXT STEP

Load `.aped/aped-epics/steps/step-04-epic-design-and-story-mapping.md`.
