---
step: 8
reads:
  - ".aped/skills/aped-skills/checklist-dev.md"
  - "docs/stories/{story-key}.md"
writes:
  - "docs/stories/{story-key}.md"
  - "ticket/{provider}"
  - ".aped/checkins/{story-key}.jsonl"
  - "state.yaml#sprint.stories[story-key].status"
mutates_state: true
---

# Step 8: Completion (story update, state, ticket, check-in)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-dev.md` and verify every item
- 🚫 Do NOT auto-chain `aped-review` — the user / Lead decides when to proceed
- ❌ FORBIDDEN to advance state to `review` if the verification gate (step 07) was bypassed

## CONTEXT BOUNDARIES

- Verification gate passed (step 07 captured fresh evidence).
- All commits land on the feature branch.

## YOUR TASK

Update the story file with the Dev Agent Record, advance state, sync to the ticket, post `dev-done` check-in (worktree mode), then walk the completion gate.

## STORY UPDATE

1. Update story file: mark all tasks `[x]`, fill **Dev Agent Record** with:
   - Brief implementation summary.
   - Files changed (paste from `git diff --name-only ^{base-branch}`).
   - Any deviations from the original plan (and why).
   - Test command output (the captured verification from step 07).

2. Do NOT add a `Review Record` section — that's `aped-review`'s job.

## STATE UPDATE

1. **Prefer MCP**: `aped_state.advance(phase: "dev", status: "review")`.
2. **Fallback** (MCP unavailable): edit `docs/state.yaml` directly — story status `review`.

In worktree mode, this writes the worktree-local copy of `state.yaml`.

## TICKET SYNC

If `ticket_system` ≠ `none`:

1. **Prefer MCP** — `mcp__aped_ticket__add_comment(ticket_id, body)` with the Dev Agent Record summary.
2. **Fallback** — provider CLI (`gh issue comment`, `glab issue note create`, linear CLI, jira API).
3. Move the ticket to **In Review**:
   - github-issues: project board column or label flip.
   - gitlab-issues: similar.
   - linear: state update.
   - jira: transition.

## PR / MR (classic mode that does NOT use sprint umbrella)

If solo mode AND not in a sprint umbrella context, push the branch and create a PR/MR:

- `github`: `gh pr create --title "feat({ticket}): {story-key}" --body "Fixes {ticket}"`.
- `gitlab`: `glab mr create --title "feat({ticket}): {story-key}" --description "Closes {ticket}"`.

If sprint mode (worktree present), the PR is created during `aped-review` (step 11) targeting the sprint umbrella, NOT base.

## CHECK-IN — parallel-sprint mode

If this session is a Story Leader (i.e. `.aped/WORKTREE` exists OR this worktree's path appears in `sprint.stories.{key}.worktree`), post a `dev-done` check-in and HALT awaiting Lead approval:

```bash
bash ${project_root}/.aped/scripts/checkin.sh post {story-key} dev-done
```

Then tell the user in the worktree session:

> `dev-done check-in posted. Waiting for the Lead Dev to approve in the main project (`aped-lead`). This session will receive `aped-review {story-key}` automatically via tmux send-keys once approved (or the user can run it manually).`

**STOP. Do not continue to `aped-review` yourself.**

## NEXT STEP — classic mode

If this is NOT a parallel-sprint worktree session, tell the user:

> Story implementation complete. Run `aped-review` to review, or `aped-dev` to start the next story.

**Do NOT auto-chain.** The user (or the Lead in parallel mode) decides when to proceed.

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-dev.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, you are NOT done — return to the relevant step.

The completion gate is the anti-rationalization check — it exists exactly to catch what the rest of the skill normalised away (e.g. *"the story has 2 ACs and only 1 has a citing test, but it was a small AC"* — no, return to step 06).

## SUCCESS METRICS

✅ Story file updated (tasks `[x]`, Dev Agent Record filled, NO Review Record added).
✅ State advanced to `review`.
✅ Ticket synced (or `none`).
✅ Worktree mode: `dev-done` posted; HALT message shown.
✅ Classic mode: PR/MR opened (when applicable); user told to run `aped-review`.
✅ Completion-gate checklist read fresh; every item `[x]`.

## FAILURE MODES

❌ Adding a Review Record to the story file — that's `aped-review`'s territory; the dev only fills Dev Agent Record.
❌ Auto-chaining `aped-review` — the user decides.
❌ Skipping the completion gate's fresh Read — relying on memory defeats the purpose.
❌ Advancing state to `review` on a worktree without posting `dev-done` — the Lead won't see it.
