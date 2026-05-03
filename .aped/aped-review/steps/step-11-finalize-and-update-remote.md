---
step: 11
reads:
  - "docs/stories/{story-key}.md"
writes:
  - "docs/stories/{story-key}.md"
  - "ticket/{provider}"
  - "pr/{provider}"
  - ".aped/checkins/{story-key}.jsonl"
  - "state.yaml#sprint.stories[story-key].status"
mutates_state: true
---

# Step 11: Finalize — Update Remote, Write Review Record into Story File, Update State

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The Review Record goes INSIDE the story file. NO separate review file is ever created.
- 🛑 Update the remote (ticket + PR) BEFORE local state — remote failures are recoverable, state.yaml getting ahead of reality is not
- 🚫 NEVER merge the PR here — that's `aped-lead`'s job (au-fil-de-l'eau)
- 🚫 NEVER target the base branch in PR creation — target the sprint umbrella

## CONTEXT BOUNDARIES

- All fixes landed and re-verified (step 10).
- Story status still `review` (do NOT have flipped it yet).
- The merged finding list, dismissed-finding rationales, and test-run outputs are all in your working state.

## YOUR TASK

Update remote (ticket comment + PR), then update the story file with a Review Record section, then update state.yaml.

## SEQUENCE — REMOTE FIRST, LOCAL STATE LAST

### 1. Ticket comment (if `ticket_system` ≠ `none`)

Post the review report (the same content shown to the user in step 09) as a comment on the ticket:

- **Prefer MCP** — `mcp__aped_ticket__add_comment(ticket_id, body)`.
- **Fallback** — provider CLI (`gh issue comment`, `glab issue note create`, linear CLI, jira API).

### 2. PR / MR — STORY → SPRINT UMBRELLA

If story → `done`:

1. **Open (or update) the story PR — target = sprint umbrella, NOT base.** Read `sprint.umbrella_branch` from state.yaml; that's the PR base. The PR's job is to be the unit of review against the umbrella; the umbrella aggregates the sprint and PRs once into base via `aped-ship`.

   ```bash
   UMBRELLA=$(yq '.sprint.umbrella_branch' ${project_root}/docs/state.yaml)
   # github
   gh pr create --base "$UMBRELLA" --head "$(git symbolic-ref --short HEAD)" \\
     --title "feat({ticket}): {story-key} — {short-title}" \\
     --body "Closes {ticket}. Review Record in docs/stories/{story-key}.md."
   # gitlab
   glab mr create --target-branch "$UMBRELLA" --source-branch "$(git symbolic-ref --short HEAD)" \\
     --title "feat({ticket}): {story-key} — {short-title}"
   ```

   If the PR already exists (re-review of a story), update its body/comments instead.

2. **Do NOT merge here.** The merge into umbrella is owned by `aped-lead` after it approves the `review-done` check-in (au-fil-de-l'eau policy: each story PR is merged into umbrella the moment the lead approves, not batched at `aped-ship`).

3. Move ticket to **In Review** (or **Done** depending on your workflow's convention — read `aped-lead`'s expectations from `config.yaml` if specified).

4. Worktree cleanup is **deferred to `aped-lead`'s approval handler**, which knows the merge succeeded. Don't remove the worktree from `aped-review` — if the merge ends up failing, the worktree is the only way to recover the local state.

If story stays `review`:

1. Post each finding as a PR comment with line anchor (if PR exists).
2. Ticket stays **In Review**.

### 3. Write the Review Record INTO the story file

**This is the canonical home of the review.** No separate file. No persisted artefact.

Open `docs/stories/{story-key}.md` and APPEND a `## Review Record` section AFTER the existing `## Dev Agent Record`. Format:

```markdown
## Review Record

**Date:** {YYYY-MM-DD}
**Reviewer:** APED Lead Reviewer (Eva, Marcus, Rex{, conditionals}{, Hannah/Eli/Aaron if Stage 1.5})
**Verdict:** done | stays-review
{- **Override:** AC gap accepted — reason: "{OVERRIDE_REASON}" (only if Eva NACK + [O]verride was chosen)}

### Specialists dispatched
- Eva (ac-validator) — verdict: APPROVED | CHANGES_REQUESTED
- Marcus (code-quality) — verdict
- Rex (git-auditor) — verdict
- {Diego / Lucas / Aria / Kai / Sam} — verdict
- {Hannah / Eli / Aaron if Stage 1.5} — verdict

### Findings (consolidated)

#### Resolved
- [SEVERITY] {description} [file:line]
  - Source: {specialist}
  - Resolution: {fix commit SHA + 1-line summary}

#### Dismissed
- [SEVERITY] {description} [file:line]
  - Source: {specialist}
  - Rationale: {why dismissed}

### Verification
- Test command: `{command}`
- Test output (final pass): {paste pass line + key counts, e.g. `Tests: 12 passed, 0 failed`}
- Visual verification: {Aria's note — validated, re-inspected because {reason}, or deferred + ISO timestamp}

### Ticket sync
- Ticket comment posted: {URL or YES}
- PR opened/updated: {URL}
```

If `ticket_system` is `none` and there's no PR (some classic-mode flows skip PRs), drop the empty fields.

### 4. Update local state

Run, in order:

1. **Prefer MCP** — `aped_state.advance(phase: "review", status: "done")` (or `"review"` if findings remain).
2. **Fallback** — edit `docs/state.yaml` directly:
   - Story → `done` (all findings resolved or dismissed).
   - Story stays `review` (unresolved findings remain).

In worktree mode, this writes the worktree-local copy of `state.yaml`. The merge resolution at `aped-ship` time will apply `--ours` (main wins).

## SUCCESS METRICS

✅ Ticket comment posted (or `none`).
✅ PR opened/updated targeting `sprint.umbrella_branch`.
✅ Story file appended with a fully populated Review Record section.
✅ State updated (MCP-first, file fallback).
✅ NO separate file created at `docs/reviews/...` or anywhere else.

## FAILURE MODES

❌ Writing a separate review file — re-introduces the bug v6.0.0 fixed.
❌ Targeting the base branch in PR creation — bypasses the sprint umbrella.
❌ Merging the PR here — that's `aped-lead`'s job.
❌ Updating state.yaml before the remote — leaves remote behind on failure.
❌ Forgetting to record dismissed-finding rationales — Review Record audit trail incomplete.

## NEXT STEP

Load `.aped/aped-review/steps/step-12-completion.md` to post the parallel-sprint check-in (if applicable) and walk the completion gate.
