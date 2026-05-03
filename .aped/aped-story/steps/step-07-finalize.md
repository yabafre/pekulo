---
step: 7
reads:
  - "docs/stories/{story-key}.md"
writes:
  - "git/commits"
  - "ticket/{provider}"
  - ".aped/checkins/{story-key}.jsonl"
  - "state.yaml#sprint.stories[story-key].status"
mutates_state: true
---

# Step 7: Finalize (commit, ticket sync, check-in)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Worktree mode: the story file MUST be committed on the feature branch before posting `story-ready`
- 🚫 NEVER use `git add .` — stage specific files only
- ❌ FORBIDDEN to overwrite the ticket body — use comments

## CONTEXT BOUNDARIES

- Story file written + linted (step 05–06).
- Feature branch checked out (step 03 — solo) or pre-existing (worktree).
- `state.yaml` flipped to `ready-for-dev`.

## YOUR TASK

Commit (worktree mode), sync refined ACs back to the ticket, post `story-ready` check-in, and report the next step to the user.

## SOLO MODE

In solo mode (`.aped/WORKTREE` does not exist), the user runs commits at their own pace. Do NOT auto-commit the story file — the user may want to bundle it with related changes. Just report the path:

> Story file ready at `docs/stories/{story-key}.md` on branch `{branch-name}`. Run `aped-dev {story-key}` to implement.

Skip the commit + check-in below — they are worktree-mode-only.

## WORKTREE MODE — COMMIT ON FEATURE BRANCH

### 1. Verify the branch

```bash
git symbolic-ref --short HEAD
```

Must match the marker's `branch`. If not, HALT.

### 2. Stage and commit the story file + state.yaml

```bash
git add docs/stories/{story-key}.md docs/state.yaml
git commit -m "docs({ticket}): draft story file for {story-key}"
```

If `ticket_system` is `none`, drop the `({ticket})` parenthetical: `git commit -m "docs: draft story file for {story-key}"`.

## TICKET SYNC (both modes)

If `ticket_system` ≠ `none`:

1. **Prefer MCP** — `mcp__aped_ticket__add_comment(ticket_id, body)`.
2. **Fallback** — provider CLI:
   - `github-issues`: `gh issue comment {id} --body "..."`
   - `gitlab-issues`: `glab issue note create {id} --message "..."`
   - `linear`: linear CLI
   - `jira`: jira API curl

The comment summarises refined ACs (the diff between `epics.md` high-level ACs and the story file's detailed ones). Do NOT overwrite the ticket body — the team may have edited it.

## CHECK-IN (worktree mode only)

After the commit lands:

```bash
bash .aped/scripts/checkin.sh post {story-key} story-ready
```

Then tell the user in the worktree session:

> `story-ready` posted. Back in the main project, run `aped-lead` to approve. Once approved, the Lead will `tmux send-keys` `aped-dev {story-key}` into this window (or print the command to run here manually).

## OUTPUT MESSAGES

### Solo mode

> Story file ready at `docs/stories/{story-key}.md` on branch `{branch-name}`. Run `aped-dev {story-key}` to implement.

### Worktree mode

> Story file committed on `{branch}`. `story-ready` check-in posted. Go to the main project and run `aped-lead` — the Lead will approve and push `aped-dev {story-key}` back into this window.

**Do NOT auto-chain.** The user / Lead decides when to proceed.

## SUCCESS METRICS

✅ Worktree mode: file + state.yaml committed on the feature branch.
✅ Ticket synced via MCP or CLI fallback.
✅ Worktree mode: `story-ready` check-in posted.
✅ Output message matches the mode (solo / worktree).

## FAILURE MODES

❌ Posting `story-ready` before the commit lands — the Lead will not see the artefact when it pulls.
❌ Overwriting the ticket body — clobbers the team's edits.
❌ Using `git add .` — stages unintended files.
❌ Auto-chaining `aped-dev` — the user / Lead controls the handoff.

## NEXT STEP

Load `.aped/aped-story/steps/step-08-completion.md` to verify the completion gate before declaring the skill done.
