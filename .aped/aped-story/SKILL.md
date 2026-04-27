---
name: aped-story
description: 'Creates a detailed story file for the next story to implement, commits it on the feature branch, and posts the story-ready check-in. Use when user says "create story", "prepare next story", "aped story", or invokes /aped-story.'
argument-hint: "[story-key]"
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Story — Detailed Story Preparation

Create a single, implementation-ready story file with all the context needed for `/aped-dev`.

## Critical Rules

- Create ONE story at a time — the next one to implement
- The story file must be self-contained — everything the dev agent needs to implement
- Discuss the story with the user before finalizing — this is a collaborative process
- Quality of story definition determines quality of implementation
- **Branch-per-story is inviolable.** In parallel-sprint mode (worktree present), /aped-story runs **inside the worktree on the feature branch** and commits the story file there — never in main. The `story-ready` check-in is posted by this skill, not by /aped-sprint.

## Mode Detection

Before anything else, decide whether we are in **solo mode** (main project, no parallel sprint) or **worktree mode** (dispatched by /aped-sprint):

- `ls .aped/WORKTREE` succeeds → **worktree mode** (expected when invoked from a /aped-sprint dispatch). Read the marker to recover `story_key`, `ticket`, `branch`.
- `ls .aped/WORKTREE` fails → **solo mode** (user running /aped-story directly to prep the next story in main).

In worktree mode, the story-key argument is optional — the marker tells us. If the user passed one and it mismatches, HALT and ask the user which is authoritative. If the current branch is `main` (not the feature branch), HALT: "Run `/aped-story` in the worktree's feature branch, not main. Branch-per-story rule."

## Setup

1. Read `.aped/config.yaml` — extract config including `ticket_system`
2. Read `docs/state.yaml` — find sprint stories
3. Read `docs/epics.md` — load epic structure and story list

## Story Selection

Scan `sprint.stories` for the first story with status `pending` (no story file yet).
- If user specifies a story key: use that one instead
- If all stories have files: "All stories are prepared. Run `/aped-dev` to implement."
- Show the selected story's summary from epics.md

## Ticket Fetch (source of truth)

If `ticket_system` is not `none` and the story has a ticket ID in `sprint.stories.{key}.ticket`:

1. Fetch the ticket from the system (it may have been edited by the team since `/aped-epics` ran):
   - `github-issues`: `gh issue view {id} --json title,body,labels,comments,assignees,state`
   - `gitlab-issues`: `glab issue view {id}`
   - `linear`: linear CLI or API
   - `jira`: curl to jira API

2. **The ticket is the source of truth.** If the team edited the description, ACs, or added comments:
   - Use the ticket's current body as the baseline
   - Review any new comments — they often contain clarifications or new requirements
   - If there are conflicts with `epics.md`, flag them to the user and ask which wins

3. Assign the ticket to the current user (optional, depends on provider):
   - `github-issues`: `gh issue edit {id} --add-assignee @me`
   - `gitlab-issues`: `glab issue assign {id} --assignee @me`

## Context Compilation

Before writing the story, gather context to make it rich and actionable:

1. **Ticket** — (above) the current state of the issue in the ticket system
2. **PRD** — read the relevant FRs for this story
3. **UX spec** — if exists, read relevant screens/components
4. **Previous stories** — read completed stories from the same epic for continuity
5. **Codebase** — if code exists, scan for relevant patterns, existing models, APIs

## Collaborative Story Design

Present a draft story to the user and discuss:

### Story Structure
- **Title** — user-facing outcome
- **As a** [role], **I want** [capability], **so that** [benefit]
- **Acceptance Criteria** — detailed Given/When/Then (refine from epics.md high-level ACs)

### Discussion Points (ask the user)
- "Does this scope feel right for one dev session?"
- "Any technical constraints I should know about?"
- "Should we split this differently?"
- "Any edge cases you're thinking about?"

⏸ **GATE: User must validate the story scope and ACs before the file is written.**

## Story File Creation

Use template `.aped/templates/story.md`. Fill every section:

### Required Sections
- **Header**: story key, epic, title, status (`ready-for-dev`)
- **User Story**: As a / I want / So that
- **Acceptance Criteria**: numbered, Given/When/Then format
- **Tasks**: checkboxes with AC references `- [ ] task description [AC: AC#]`
- **Dev Notes**: architecture guidance, file paths, dependencies, patterns to follow
- **File List**: expected files to create/modify

### Ticket Integration
If `ticket_system` is not `none`:
- Read `.aped/aped-dev/references/ticket-git-workflow.md`
- Add `**Ticket:** {{ticket_id}}`
- Add `**Branch:** feature/{{ticket_id}}-{{story-slug}}`
- Add commit prefix in Dev Notes

## Output

1. Write story file to `docs/stories/{story-key}.md`
2. Update `docs/state.yaml`: story status → `ready-for-dev`
3. **Sync back to ticket system** (if `ticket_system` != `none`):
   - If the refined ACs differ from the ticket body: post a comment on the ticket summarizing the refinements
   - Don't overwrite the ticket body (it may have user edits) — use comments instead
   - `github-issues`: `gh issue comment {id} --body "..."`
   - `gitlab-issues`: `glab issue note create {id} --message "..."`

### Worktree mode only — commit + story-ready

In worktree mode, the story file and state.yaml edit must land on the feature branch, then a `story-ready` check-in is posted so `/aped-lead` can approve.

1. Verify branch: `git symbolic-ref --short HEAD` must match the marker's `branch`. If not, HALT.
2. Stage and commit on the feature branch:
   ```bash
   git add docs/stories/{story-key}.md docs/state.yaml
   git commit -m "docs({ticket}): draft story file for {story-key}"
   ```
3. Post the check-in:
   ```bash
   bash .aped/scripts/checkin.sh post {story-key} story-ready
   ```
4. Report to the user: "`story-ready` posted. Back in the main project, run `/aped-lead` to approve. Once approved, the Lead will `tmux send-keys` `/aped-dev {story-key}` into this window (or print the command to run here manually)."

In solo mode, skip steps 1–3 and tell the user: "Story file ready. Run `/aped-dev {story-key}` to implement."

## Example

User runs `/aped-story`:
1. Next pending story: 1-2-inventory-crud
2. Reads FR2, FR3 from PRD + inventory screen from UX spec
3. Presents draft: "CRUD for inventory items — 4 ACs, 6 tasks"
4. User: "Add an AC for duplicate item names"
5. Updates draft, user validates
6. Writes `docs/stories/1-2-inventory-crud.md`
7. "Story ready. Run `/aped-dev` to implement."

## Common Issues

- **Story too large (>8 tasks)**: Split into two stories — discuss with user where to cut
- **Missing context from previous story**: Read the completed story file for decisions made
- **User wants to skip a story**: Mark as `skipped` in state.yaml, move to next
- **User wants to reorder stories**: Update state.yaml ordering, check for dependency issues

## Next Step

- **Solo mode**: "Story file is ready at `docs/stories/{story-key}.md`. Run `/aped-dev` to implement it."
- **Worktree mode**: "Story file committed on `{branch}`. `story-ready` check-in posted. Go to the main project and run `/aped-lead` — the Lead will approve and push `/aped-dev {story-key}` back into this window."

**Do NOT auto-chain.** The user decides when to proceed.
