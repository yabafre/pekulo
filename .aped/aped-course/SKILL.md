---
name: aped-course
description: 'Manages scope changes and pivots during development with impact analysis. Use when user says "correct course", "change scope", "pivot", "aped correct", or invokes /aped-course.'
argument-hint: "[description of the change]"
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Correct Course — Managed Pivot

Use when requirements change, priorities shift, or the current approach needs rethinking mid-pipeline. During a parallel sprint this is the **only** way to modify upstream docs (PRD, architecture, UX) — the `upstream-lock` hook blocks all other attempts.

## Setup

1. Read `.aped/config.yaml` — extract config (incl. `ticket_system`, `git_provider`)
2. Read `docs/state.yaml` — understand current pipeline state
3. Read existing artifacts: brief, PRD, epics, stories
4. Read `.aped/aped-course/references/scope-change-guide.md` for impact matrix and process

## Active-Worktree Check (parallel sprint awareness)

Before touching any artifact, identify stories whose `status` is in `{in-progress, review-queued, review}` AND that have a non-null `worktree` — these are the sessions that will be impacted.

Source of truth: `state.yaml`. Cross-check: if `command -v workmux` succeeds, also run `workmux list --format json` (or the plain `workmux list` if json isn't supported) to confirm each state.yaml worktree is actually open. If a worktree is in state.yaml but workmux doesn't know about it, the session was likely closed without marking the story `done` — flag it to the user as a stale entry and ask whether to drop the `worktree` field.

If any exist:
1. List them to the user with their branches + tickets.
2. ⏸ **GATE:** "Continuing will invalidate epic context caches used by those worktrees. Proceed?"
3. On confirmation, post a notification comment on each active ticket (via `gh`/`glab`/linear per `ticket_system`):
   > "APED scope change in progress. Please pause your next commit until the update lands. A follow-up comment will confirm when it's safe to refresh your epic context and continue."
4. Write `sprint.scope_change_active: true` in state.yaml (atomic — use `.aped/scripts/sync-state.sh set-scope-change true` if present, else direct edit under flock).

If no active worktrees: skip this section entirely.

## Impact Assessment

Ask the user:
1. **What changed?** — New requirement, removed feature, architectural pivot, priority shift
2. **Why?** — User feedback, market shift, technical limitation, stakeholder decision

Then analyze impact:

### Scope Change Matrix

| What changed | Artifacts affected | Action required |
|---|---|---|
| New feature added | PRD, Epics | Add FRs → create new stories |
| Feature removed | PRD, Epics | Remove FRs → archive stories |
| Architecture change | PRD NFRs, All stories | Update NFRs → review all Dev Notes |
| Priority reorder | Epics, Sprint | Reorder stories → update sprint |
| Complete pivot | Everything | Reset to /aped-analyze |

## Change Execution

### Minor change (new/removed feature)
1. Update PRD: add/remove FRs, update scope
2. Re-run validation: `bash .aped/aped-prd/scripts/validate-prd.sh docs/prd.md`
3. Update epics: add/archive affected stories
4. Re-run coverage: `bash .aped/aped-epics/scripts/validate-coverage.sh docs/epics.md docs/prd.md`
5. Update `docs/state.yaml`: mark affected stories as `backlog`

### Major change (architecture/pivot)
1. Confirm with user: "This invalidates in-progress work. Proceed?"
2. Archive current artifacts to `docs/archive/{date}/`
3. Update PRD or restart from `/aped-analyze`
4. Regenerate affected downstream artifacts

## Story Impact Report

For each in-progress or completed story:
- **Safe**: story not affected by change
- **Needs update**: story Dev Notes or ACs need modification
- **Invalidated**: story no longer relevant — archive it

## State Update

Update `docs/state.yaml`:
- Reset affected stories to `backlog` or `ready-for-dev`
- If major change: reset `current_phase` to appropriate earlier phase
- Log the correction in pipeline phases:
```yaml
corrections:
  - date: "{date}"
    type: "{minor|major}"
    reason: "{user's reason}"
    affected_stories: [...]
```

## Release the Upstream Lock (parallel sprint only)

If you set `scope_change_active: true` at the start, you MUST clear it before handing control back:

1. Invalidate any now-stale epic-context caches — delete `docs/epic-*-context.md` for the affected epic(s) so `/aped-dev` recompiles on the next story.
2. Set `sprint.scope_change_active: false` in state.yaml (atomic).
3. Post a follow-up comment on each previously notified ticket:
   > "Scope change applied. If you're in an active worktree, pull the latest `docs/` artefacts and restart your story loop — the epic-context cache has been invalidated."

If you skip step 2, upstream writes remain unlocked — a real security issue, not a cosmetic one. Do not exit the skill with the lock still open.

## Guard Against Scope Creep

After applying changes, verify:
- Total FR count still within 10-80 range
- No epic became too large (>8 stories)
- No story became too large (>8 tasks)
- Changed stories still fit single-session size

## Example

User says "We need to add OAuth — the client changed requirements":
1. Impact: minor change — add FRs to PRD, create new stories
2. Update PRD: add FR26-FR28 for OAuth
3. Re-validate PRD
4. Add stories to Epic 1 for OAuth support
5. Re-validate coverage
6. Reset new stories to `ready-for-dev`

## Common Issues

- **User wants to change everything**: Confirm scope — "Is this a pivot or an addition?"
- **Invalidated stories have committed code**: Archive the code changes, don't delete — user may want to reference them
- **FR count exceeds 80 after change**: Some features may need to move to a Growth phase scope
