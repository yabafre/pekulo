---
step: 5
reads:
  - ".aped/templates/story.md"
writes:
  - "docs/stories/{story-key}.md"
mutates_state: false
---

# Step 5: Write Story File

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The branch must already be checked out (step 03)
- 🛑 The user must have validated scope (step 04 GATE)
- ❌ FORBIDDEN to skip any required section of the template
- ❌ FORBIDDEN to use placeholders (`TODO:`, `TBD`, `<replace-me>`) — lint catches these in step 06

## CONTEXT BOUNDARIES

- Story key, ticket id, file structure, draft tasks all known.
- Branch checked out (solo + `[A]`) or pre-existing (worktree).

## YOUR TASK

Write the story file at `docs/stories/{story-key}.md` from the validated draft.

## TEMPLATE

Use template `.aped/templates/story.md`. Fill every section.

### Required sections

- **Header**: story key, epic, title, status (`ready-for-dev`)
- **User Story**: As a / I want / So that
- **Acceptance Criteria**: numbered, Given/When/Then format
- **Tasks**: checkboxes with AC references `- [ ] task description [AC: AC#]`
- **Dev Notes**: architecture guidance, file paths, dependencies, patterns to follow
- **File List**: expected files to create/modify

### Embed from earlier steps

- The **Step-0 quote** for every modified file (verbatim, no paraphrase) — drop into Dev Notes.
- The **3-bullet file decision template** for every file in File List — drop into Dev Notes.
- Each **Execution task** with all 5 granularity must-haves (path, full code, test command, expected output, commit step).

### Ticket integration

If `ticket_system` ≠ `none`:

- Read `.aped/aped-dev/references/ticket-git-workflow.md` for the canonical commit prefix and PR template.
- Add `**Ticket:** {{ticket_id}}`.
- Add `**Branch:** feature/{{ticket_id}}-{{story-slug}}` (matches the branch checked out in step 03).
- Add commit prefix in Dev Notes: `feat({{ticket_id}}): ...`.

If `ticket_system` is `none`:

- Add `**Branch:** feature/none-{{story-slug}}` (matches step 03's deterministic name).
- Commit prefix: `feat: ...`.

## STATE.YAML UPDATE

After writing the file:

1. Run `aped_state.advance(phase: "stories", status: "ready-for-dev")` (MCP tool).
2. **Fallback** (MCP unavailable): edit `docs/state.yaml` directly — set `sprint.stories.{key}.status: ready-for-dev`.

In **worktree mode**, this writes the worktree-local copy of `state.yaml`. Do NOT reach across to main's. The merge resolution at `aped-ship` time will apply `--ours` (main wins). See workflow.md § "State.yaml authority".

## SUCCESS METRICS

✅ Story file at `docs/stories/{story-key}.md`.
✅ Every required section present and non-trivial.
✅ Step-0 quote present for every modified file.
✅ Every task has all 5 granularity must-haves.
✅ `state.yaml` updated (MCP first, file fallback).

## FAILURE MODES

❌ Skipping Step-0 quote → dev burns RED cycles on stale mental models.
❌ Snippet (`...`) in any code block → junior invents the gaps.
❌ Updating `state.yaml` BEFORE the file exists → status flipped without artefact.
❌ Editing main's `state.yaml` from a worktree → contradicts the authority model.

## NEXT STEP

Load `.aped/aped-story/steps/step-06-self-review.md` to walk the self-review checklist before the user gate.
