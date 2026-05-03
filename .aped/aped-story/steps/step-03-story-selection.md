---
step: 3
reads:
  - "state.yaml#sprint.stories"
  - "ticket/{provider}"
  - "git/HEAD"
writes:
  - "git/branches/feature-{ticket}-{slug}"
mutates_state: false
---

# Step 3: Story Selection, Ticket Fetch, Feature Branch Creation

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The ticket is the source of truth — fetch fresh, never trust cached comments
- 🚫 Solo mode + `[A]` deferred from step 01 → branch is created HERE, before any file is written
- ❌ FORBIDDEN to write the story file before the feature branch exists and is checked out
- ❌ FORBIDDEN to skip ticket-fetch when `ticket_system` ≠ `none` — it's how the team's edits reach you

## CONTEXT BOUNDARIES

- Mode is known.
- `state.yaml`, `epics.md`, optional upstream artefacts loaded.
- In worktree mode, story_key is pinned by the marker.
- In solo mode with `[A]` chosen in step 01, branch creation is deferred to this step.

## YOUR TASK

Pick the story to draft, fetch its ticket, and (in solo mode) create + checkout the feature branch before any file is written.

## STORY SELECTION

### Worktree mode

The story key is the marker's. Skip selection. Read the story's row in `sprint.stories` to recover the ticket id.

### Solo mode

Scan `sprint.stories` in `state.yaml` for the first story with status `pending` (no story file yet).

- If the user passed `[story-key]` as argument: use that one.
- If all stories have files: report *"All stories are prepared. Run `aped-dev` to implement."* and STOP.
- Show the selected story's summary from `epics.md`.

## TICKET FETCH (source of truth)

If `ticket_system` ≠ `none` and the story has a ticket id in `sprint.stories.{key}.ticket`:

1. **Prefer the MCP `aped_ticket` adapter** — `mcp__aped_ticket__get_status(ticket_id)` returns the ticket's title, body, labels, comments, and assignees. Falls back to provider CLI when MCP is unavailable:

   - `github-issues`: `gh issue view {id} --json title,body,labels,comments,assignees,state`
   - `gitlab-issues`: `glab issue view {id}`
   - `linear`: linear CLI or API
   - `jira`: curl to jira API

2. **The ticket is the source of truth.** If the team edited the description, ACs, or added comments:
   - Use the ticket's current body as the baseline.
   - Review any new comments — they often contain clarifications or new requirements.
   - If there are conflicts with `epics.md`, flag them to the user and ask which wins.

3. Optional assignee update:
   - `github-issues`: `gh issue edit {id} --add-assignee @me`
   - `gitlab-issues`: `glab issue assign {id} --assignee @me`

If `ticket_system` is `none`, this section is a no-op.

## FEATURE BRANCH CREATION (solo mode only)

Run only if **step 01 marked `[A]` (deferred branch creation)**. In worktree mode this section is a no-op.

### 1. Compute the branch name

The branch name follows the APED/workmux convention `feature/{ticket}-{slug}`:

- `{ticket}` = the ticket id (e.g. `BON-284`); use `none` only when `ticket_system: none`.
- `{slug}` = the story key from `epics.md` (e.g. `1-2-jwt-validation`).
- Examples: `feature/BON-284-1-2-jwt-validation`, `feature/none-1-2-jwt-validation`.

### 2. Verify clean working tree

```bash
git status --porcelain | grep -v '^??' && echo DIRTY || echo CLEAN
```

If `DIRTY`, HALT: *"Working tree has uncommitted changes. Stash or commit them before starting a new story."*

### 3. Create + checkout

```bash
BRANCH="feature/{ticket}-{slug}"
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"
```

(`||` pattern handles the case where the user already created the branch but is still on `main` — we just check it out.)

### 4. Verify checkout succeeded

```bash
git symbolic-ref --short HEAD
```

Must equal the computed branch name. If not, HALT and surface the actual branch.

### 5. Confirm to user

> ✅ Created and switched to `{BRANCH}`. The story file will be committed on this branch.

## SUCCESS METRICS

✅ Story key resolved (from marker, user argument, or first-pending in `state.yaml`).
✅ Ticket fetched fresh (or skipped because `ticket_system: none`).
✅ Conflicts between ticket body and `epics.md` surfaced to user.
✅ In solo mode with deferred branch: feature branch created, working tree was clean, current branch matches the computed name.

## FAILURE MODES

❌ Drafting on `main` because step 01's deferral was skipped.
❌ Checking out a branch with a dirty working tree (state.yaml from a prior story can leak).
❌ Trusting `epics.md` over a fresher ticket — the ticket wins.
❌ Inventing a slug — the slug must match `epics.md` exactly so `aped-dev` and `aped-review` find the story.

## NEXT STEP

Load `.aped/aped-story/steps/step-04-collaborative-design.md` to draft the story collaboratively before writing the file.
