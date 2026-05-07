---
step: 5
reads:
  - "docs/stories/{story-key}.md"
  - "docs/epics-context/epic-{N}-context.md"
writes:
  - "docs/stories/{story-key}.md"
  - "docs/epics-context/epic-{N}-context.md"
  - "ticket/{provider}"
  - "pr/{provider}"
  - ".aped/checkins/{story-key}.jsonl"
  - "state.yaml#sprint.stories[story-key].status"
mutates_state: true
---

# Step 5: Finalize — Remote, Story File, Cache, State, Check-in

**Iron Laws:**
- Update remote (ticket + PR) BEFORE local state. Remote failures are recoverable; state.yaml getting ahead of reality is not.
- Review Record lives INSIDE the story file. Never write a separate `docs/reviews/...` file.
- NEVER merge the PR here — that's `aped-lead`'s job.
- NEVER target the base branch in PR creation — target the sprint umbrella.

## Verdict

- All findings `RESOLVED` or `DISMISSED-with-rationale` → story flips to `done`.
- Any unresolved finding remains → story stays `review`.

## 1. Ticket sync

If `ticket_system` ≠ `none`, post a comment summarising the verdict + open finding count + Review Record location:

- **Prefer MCP** — `mcp__aped_ticket__add_comment(ticket_id, body)`.
- **Fallback** — provider CLI (`gh issue comment`, `glab issue note create`, linear, jira).

> **Writing discipline.** Short, sharp. Status + Review Record location + open finding count if `review`. Don't re-narrate the work in the ticket — the story file has the trail.

## 2. PR / MR — story → sprint umbrella

If story → `done`:

- Read `sprint.umbrella_branch` from state.yaml; that's the PR base.
- Title: `feat({ticket}): {story-key} — {short-title}` (writing discipline applies).
- Body: short, links to the Review Record at `docs/stories/{story-key}.md`. Closes `{ticket}`.

The block must be **idempotent** — probe before create, edit if the PR already exists:

```bash
UMBRELLA=$(yq '.sprint.umbrella_branch' ${project_root}/docs/state.yaml)
HEAD_BRANCH=$(git symbolic-ref --short HEAD)
TITLE="feat({ticket}): {story-key} — {short-title}"
BODY="Closes {ticket}. Review Record in docs/stories/{story-key}.md."

if EXISTING=$(gh pr view "$HEAD_BRANCH" --json number,baseRefName -q '.number' 2>/dev/null) && [[ -n "$EXISTING" ]]; then
  EXISTING_BASE=$(gh pr view "$HEAD_BRANCH" --json baseRefName -q '.baseRefName' 2>/dev/null || echo "")
  [[ -n "$EXISTING_BASE" && "$EXISTING_BASE" != "$UMBRELLA" ]] && gh pr edit "$EXISTING" --base "$UMBRELLA"
  gh pr edit "$EXISTING" --title "$TITLE" --body "$BODY"
else
  gh pr create --base "$UMBRELLA" --head "$HEAD_BRANCH" --title "$TITLE" --body "$BODY"
fi
```

GitLab equivalent uses `glab mr view / update / create` with the same probe shape.

The probe path also fixes the legacy case where a previous `aped-review` opened the PR against the wrong base (e.g. project base branch instead of umbrella).

If story stays `review`:

- Post each open finding as a PR comment with line anchor (if PR exists). Reply in the comment thread for inline reviewer comments — top-level PR comments get missed.
- Ticket stays "In Review".

## 3. Review Record into the story file

Open `docs/stories/{story-key}.md`, append after the existing `## Dev Agent Record`:

```markdown
## Review Record

**Date:** {YYYY-MM-DD}
**Auditors:** Spec, Code, Edge & Hallucination{, Aria}
**Verdict:** done | stays-review
{- **Override:** AC gap accepted — reason: "{OVERRIDE_REASON}"  (only if [O] was chosen)}

### Findings

#### Resolved
- [SEVERITY] {description} [file:line]
  - Source: {auditor}
  - Resolution: {fix commit SHA + 1-line summary}

#### Dismissed
- [SEVERITY] {description} [file:line]
  - Source: {auditor}
  - Rationale: {why dismissed — required, captured at decision time}

#### Unresolved (story stays in `review`)
- [SEVERITY] {description} [file:line]
  - Source: {auditor}
  - Next: {what dev needs to do}

### Verification
- Test command: `{command}`
- Test output (final pass): {pass line + key counts}
- Visual verification: {Aria's note — validated, re-inspected because {reason}, or deferred + ISO}

### Ticket sync
- Ticket comment posted: {URL or YES}
- PR opened/updated: {URL}
```

If `ticket_system` is `none` and there's no PR, drop the empty fields.

## 4. Local state update

1. **Prefer MCP** — `aped_state.advance(phase: "review", status: "done")` (or `"review"` if findings remain).
2. **Fallback** — edit `docs/state.yaml`: story → `done` (all closed) or stays `review`.

In worktree mode this writes the worktree-local copy. The merge resolution at `aped-ship` time applies `--ours` (main wins).

## 5. Append story outcome to `epic-{N}-context.md` (only if story → `done`)

Skip if story stays `review` — the cache only records terminal outcomes.

Append a strict-template entry to the cache's `## Previous stories — outcomes` section so the next story's `aped-dev` and `aped-review` invocations inherit the decisions made here.

```markdown
### Story {story-key} — done {YYYY-MM-DD}T{HH:MM:SS}Z

- **Decisions:** {1–3 short bullets, technical decisions the next story should not re-litigate. Empty list = no notable cross-cutting decisions.}
- **Files:** {paths created or modified, mirroring the story's File List}
- **Contracts:** {types / endpoints / schemas introduced or changed that other stories may depend on. Empty if none.}
- **Deviations from plan:** {short bullets where implementation diverged from Dev Notes, with the reason. "none" if implementation matched.}
```

Read the cache, locate `## Previous stories — outcomes`, append the new `### Story {story-key} …` block immediately after the heading (or after the previous outcome entry, preserving chronological order). Do not rewrite other sections. If the heading is missing (cache hand-edited), HALT and surface — don't append blindly.

The fields are 1–2 short sentences each. The cache is consumed by every future `aped-dev` cycle; padding here costs context every story for the rest of the epic.

## 6. Sprint check-in (worktree mode only)

If `.aped/WORKTREE` exists AND the story flipped to `done`:

```bash
bash .aped/scripts/checkin.sh post {story-key} review-done
```

Then in the worktree session:

> `review-done` posted. The Lead will verify and merge the story PR into the umbrella. This worktree stays open until then.

**Do NOT auto-chain.** The Lead approves the merge; this skill exits.

## Output messages

- Story → `done`, solo mode: *"Review done. Story `{key}` flipped to `done`. PR opened/updated at `{url}`. Run `aped-ship` when the sprint is ready, or queue another story via `aped-story`."*
- Story → `done`, worktree mode: *"Review done. `review-done` check-in posted. Lead will merge."*
- Story stays `review`: *"Review unresolved. {N} findings open. Run `aped-receive-review` to address them, then re-run `aped-review`."*
