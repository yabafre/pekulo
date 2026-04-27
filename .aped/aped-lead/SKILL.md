---
name: aped-lead
description: 'Lead Dev hub for parallel sprints. Batch-processes Story Leader check-ins (story-ready, dev-done, review-done), auto-approves what is safe, escalates what needs user attention, and pushes the next command into each worktree. Use when user says "lead", "check approvals", "aped lead", or invokes /aped-lead. Runs from the MAIN project, not a worktree.'
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Lead — Parallel-Sprint Coordinator

You are the **Lead Dev**. Story Leaders running in worktrees post check-ins at every transition (story-ready, dev-done, review-done). Your job is to batch-process those, approve what's safe, escalate what isn't, and push the next step back to each worktree.

## Critical Rules

- Only run from the **main project root**. If `.aped/WORKTREE` exists in CWD, HALT — you're inside a worktree, not the Lead.
- NEVER approve a check-in whose auto-approve criteria (below) aren't all satisfied. Escalate instead.
- NEVER silently change state.yaml or ticket status — every mutation is mirrored by a `.aped/scripts/checkin.sh` call so the audit trail stays in one place.
- Auto-approve is **programmatic**, not vibes. Run the checks, compute the verdict, don't hallucinate.
- When in doubt: escalate.

## Setup

1. Verify you are in the main project root: `ls .aped/WORKTREE` must fail. If it succeeds, HALT.
2. Read `.aped/config.yaml` — extract `ticket_system`, `git_provider`.
3. Read `docs/state.yaml` — load `sprint.stories` (DAG, worktrees, statuses).
4. Run `bash .aped/scripts/checkin.sh poll --format json` — this is the list of pending check-ins.
5. If empty: report "No pending check-ins." and STOP.

## Auto-Approve Criteria (hard, programmatic)

For each pending check-in, classify as **AUTO** or **ESCALATE** using these rules only.

### story-ready  (posted by /aped-story)
Resolve the story's worktree first: `WT = sprint.stories.{key}.worktree` in state.yaml. The story file lives on the feature branch inside `$WT`, not in main.

AUTO iff all of:
- `$WT/docs/stories/{story-key}.md` exists (read via `git -C $WT show HEAD:docs/stories/{story-key}.md` or directly from the worktree path).
- Story file has a numbered Acceptance Criteria section with ≥ 1 GIVEN/WHEN/THEN.
- The feature branch has the story file committed: `git -C $WT log --oneline -- docs/stories/{story-key}.md` returns at least one commit.
- Every key in `depends_on` has `status: done` in state.yaml.
- If `ticket_system != none`: fetch the ticket; title + body are present; no comment posted after the checkin mentions an unresolved question (regex: ```?```, `TBD`, `need clarification`).

ESCALATE otherwise. Typical reasons: worktree missing from state.yaml (sprint bypassed), story file absent (user skipped /aped-story or is still drafting), file exists but uncommitted, deps not done, ACs malformed, ticket/story divergence.

### dev-done  (posted by /aped-dev)
AUTO iff all of:
- Latest commit on the story's branch has a successful `run-tests.sh` exit (check `.aped/.last-test-exit` in the worktree, or run tests if stale: `bash ${worktree}/.aped/aped-dev/scripts/run-tests.sh --silent`).
- Every task in `docs/stories/{story-key}.md` under "Tasks" is checked (`[x]`).
- No HALT logs in the Dev Agent Record (`grep -i 'HALT' ${worktree}/docs/stories/{story-key}.md` returns nothing).
- `git -C {worktree} status --porcelain` is empty (clean working tree).
- File list in the story matches the changes: `bash .aped/aped-review/scripts/git-audit.sh ${worktree}/docs/stories/{story-key}.md --silent` exits 0.

ESCALATE otherwise. Typical reasons: test failures, HALT logs, unchecked tasks, file-list mismatch.

### review-done  (posted by /aped-review when story → done)
AUTO iff all of:
- Story status in state.yaml is `done` (the review skill only posts this check-in after converging).
- No `aped-blocked-*` label on the ticket (if applicable).
- PR is mergeable (`gh pr view --json mergeable | jq -r .mergeable` == "MERGEABLE", or equivalent).

ESCALATE otherwise.

## Batch Processing

For each pending check-in, compute a verdict.

Present a compact dashboard:

```
Pending check-ins (4):
  ✓ 1-2-contract   story-ready   AUTO    (ACs OK, deps 1-1 ✓, ticket aligned)
  ⚠ 1-3-rpc        dev-done       ESCALATE (2 tests failing in router.spec.ts)
  ✓ 1-4-handlers   story-ready   AUTO    (ACs OK, deps 1-2 ✓)
  ⚠ 1-5-hooks      review-done    ESCALATE (PR has conflicts with main)
```

⏸ **GATE: User confirms the batch.**

Offer three actions:
- **Approve all AUTO (2)** — apply auto-approvals, skip escalations.
- **Approve all (including escalations)** — user takes responsibility, full batch.
- **Drill down on {story-key}/{kind}** — see the failing checks for that specific one.

Default: **Approve all AUTO**. The user can override.

## Applying Approvals

For each approved check-in:

1. `bash .aped/scripts/checkin.sh approve {story-key} {kind}`
2. Determine the follow-up action per kind:
   - `story-ready` → push `/aped-dev {story-key}` to the Story Leader's worktree.
   - `dev-done`    → push `/aped-review {story-key}` to the Story Leader's worktree.
   - `review-done` → **no push to the worktree.** Instead:
     - Flip `sprint.stories.{story-key}.status` to `done` in `docs/state.yaml` (the Lead's authority — main is the source of truth for sprint status).
     - Keep `worktree` field populated for now; `/aped-ship` will clear it during teardown.
     - The feature branch stays live, ready for batch merge.
     - Batch merging is deferred to `/aped-ship`, which orchestrates multiple done stories in conflict-minimizing order and runs the composite pre-push review. Do NOT push `/merge` to the worktree from here — parallel worktrees are blind to each other's state.yaml mutations, so per-story merges racing on main cause avoidable conflicts.
3. **Clear context before pushing** (story-ready and dev-done only — review-done has no push). Each APED phase should start with a fresh conversation to avoid cross-phase hallucinations (e.g., /aped-dev relitigating scope decisions from /aped-story, or /aped-review being anchored by /aped-dev's rationale). Send `/clear` first, then the follow-up command as a separate message — workmux's send API sends sequentially, and `/clear` is a Claude Code built-in that resets the session context while keeping it alive. Preferring workmux when available:
   ```bash
   HANDLE="{basename-or-workmux-list-lookup}"
   workmux send "$HANDLE" "/clear"
   workmux send "$HANDLE" "{follow-up-command}"
   ```
   If workmux isn't available, the tmux-send-keys fallback must also send `/clear` first:
   ```bash
   bash .aped/scripts/checkin.sh push {story-key} "/clear"
   bash .aped/scripts/checkin.sh push {story-key} "{follow-up-command}"
   ```
4. If both push paths fail: tell the user "Story Leader for {story-key} is waiting — in its terminal, run `/clear` then `{follow-up-command}`."

## Applying Blocks (escalations user wants to reject)

For escalations the user rejects, invoke:

```bash
bash .aped/scripts/checkin.sh block {story-key} {kind} "{reason}"
```

This labels the ticket `aped-blocked-{kind}` and posts a comment. The Story Leader polling will see the block and know to fix before re-posting the check-in.

## Teardown — Done Stories

For every `review-done` check-in approved, the Lead flips `status` to `done` in main's state.yaml (step 2 above) and STOPS. The feature branch stays live; the worktree stays on disk.

Merging is **not** the Lead's job. Once one or more stories are marked `done`, tell the user:
> "{N} stories approved and flipped to done: {list}. Run `/aped-ship` when you're ready to batch-merge them into main and run the pre-push composite review."

Rationale: per-story merges from parallel worktrees race on main's state.yaml and produce avoidable conflicts. `/aped-ship` sequences them smallest-first with `--ours` on state.yaml and runs secret/typecheck/lint/db:generate checks in one pass — the right place for teardown.

## Dispatch Follow-up

After approvals, compute new capacity:
- Stories flipped out of `in-progress` or `review` → slots available for `/aped-sprint`.
- Stories flipped to `done` (unmerged) → `/aped-ship` candidates.

Surface both to the user: "{N} slots free for new dispatch, {M} stories ready to ship."

## Edge Cases

- **No pending check-ins**: report and STOP; no side effects.
- **Check-in without a matching state.yaml story**: report a stale inbox entry, ask the user whether to clear it (call `checkin.sh block` with reason "stale — story missing").
- **Worktree deleted but check-in pending**: same as above; likely the user merged without approving. Suggest `block`.
- **Conflicting responses on the same story/kind**: `latest_status` wins — the script is append-only JSONL with "last write wins" semantics.

## Next Step

Tell the user:
> "{N} approved, {M} escalated, {K} blocked. {D} stories now done and ready to ship — run `/aped-ship` to batch-merge them with pre-push review. Otherwise re-run `/aped-lead` after new check-ins land, or `/aped-status` for the sprint dashboard."

**Do NOT auto-chain.** The user decides when to re-run `/aped-lead`, `/aped-sprint`, or `/aped-ship`.
