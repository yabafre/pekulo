---
name: aped-review
description: 'Reviews completed stories adversarially with minimum 3 findings. Use when user says "review code", "run review", "aped review", or invokes /aped-review.'
argument-hint: "[story-key]"
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Review — Adversarial Code Review

You are the **Lead Reviewer**. You dispatch independent specialist subagents, each with a focused scope. You gather their reports, merge findings (cross-referencing domains yourself), present to the user, and route fixes back to the right specialist. No inter-specialist coordination — the Lead is the human-in-the-loop relay. This is lighter than a full agent-team and keeps review focused on validation.

## Critical Rules

- MINIMUM 3 findings across the team — if you found fewer, specialists didn't look hard enough. Re-dispatch.
- NEVER skip the git audit — it catches undocumented file changes
- NEVER change story status without user approval
- Review is binary: `review` → `done` (or stays `review` until findings addressed)
- Do not rubber-stamp. The team's job is to find problems, not to validate.

## Step 1: Setup

1. **Worktree Mode Detection** — if `.aped/WORKTREE` exists, read the marker and:
   - Use its `story_key` instead of scanning state.yaml
   - Read the canonical state.yaml from the marker's `project_root`
2. Read `.aped/config.yaml` — extract config (`git_provider`, `ticket_system`)
3. Read `docs/state.yaml` — resolve the target story:
   - If the user passed `{story-key}` as argument, use it
   - Else if in worktree mode, use the marker's story
   - Else find the first story with status `review`
   - If none found: report "No stories pending review" and stop

## Step 1b: Parallel Review Capacity

Before spinning up specialists, check `sprint.review_limit` (default 2) against current reviews:

```
reviews_running = count(stories where status == "review" AND story_key != this one)
```

If `reviews_running >= review_limit`:
- Update this story's status to `review-queued` in state.yaml
- Post a comment on the ticket (if applicable): "Review capacity reached — queued."
- Tell the user: "Review queue is full (`{running}`/`{limit}`). This story is `review-queued`. Re-run `/aped-review {story-key}` when a slot frees (see `/aped-status`)."
- STOP — do not dispatch specialists.

Otherwise, continue to Step 2. (Do NOT change status yet; it stays `review` until either `done` or queued again.)

## Step 2: Load Context

Load everything the team will need:

1. **Story file** — `docs/stories/{story-key}.md`
2. **Ticket** (if `ticket_system` != `none`) — fetch via CLI
   - Read title, body, labels, **all comments** (comments may contain clarifications or decisions made during dev)
   - If ticket body diverges from story ACs: flag it to the user before proceeding
3. **Epic context** — `docs/epic-{N}-context.md` if exists (the cache from `/aped-dev`)
4. **Architecture** — `docs/architecture.md` if exists (for pattern compliance checks)
5. **UX spec** — `docs/ux/` if exists (for frontend stories)

## Step 3: Task Tracking

```
TaskCreate: "Setup + context load"
TaskCreate: "Story classification"
TaskCreate: "Dispatch specialist team"
TaskCreate: "Merge findings"
TaskCreate: "Present to user + gate"
TaskCreate: "Apply fixes"
TaskCreate: "Re-verify"
TaskCreate: "Update ticket + state"
```

## Step 4: Story Classification

As the Lead, analyze the story's File List to determine which specialists to dispatch.

Detect categories:
- **backend** — `apps/api/`, `apps/server/`, `services/`, `packages/*/src/`, `.py`, `.go`, `.rs`, `.java`, business logic files
- **frontend** — `.tsx`, `.jsx`, `.vue`, `.svelte`, `apps/web/`, `src/pages/`, `src/components/`
- **devops** — `.github/workflows/`, `Dockerfile`, `docker-compose`, `terraform/`, `k8s/`, `cdk/`, infra code
- **fullstack** — story spans 2+ layers (e.g., an API + its consumer UI). Dispatch a fullstack agent to check integration.

A story can trigger multiple specialists. Example:
- Backend-only story: `AC-validator` + `code-quality` + `backend-specialist` + `git-auditor`
- Frontend-only story: `AC-validator` + `code-quality` + `frontend-specialist` + `visual-reviewer` + `git-auditor`
- Fullstack story: add `fullstack-specialist` on top of backend + frontend

## Step 5: Dispatch Specialists (subagents, no team)

Review is a set of **independent validations**: each specialist audits its scope, reports to the Lead. There is no real-time cross-specialist negotiation — the Lead merges findings and does the cross-referencing. This keeps the workflow simple and scalable, and avoids Claude Code's experimental agent-teams mode (which puts each teammate in a tmux pane — unreadable beyond ~3 agents).

### Dispatch pattern — parallel subagents

All selected specialists are spawned in a **single message, in parallel**, via the `Agent` tool. **No** `team_name`, **no** `TeamCreate`, **no** `SendMessage`. Their findings return to the Lead as tool results; the Lead handles cross-cutting concerns in Step 6 (Merge Findings).

### Who to dispatch

Always:
- **Eva** (ac-validator)
- **Marcus** (code-quality)
- **Rex** (git-auditor)

Plus conditionals by file surface:
- If backend files: **Diego**
- If frontend files: **Lucas** (and **Aria** if a preview app is present)
- If infra files: **Kai**
- If the story spans ≥ 2 layers: **Sam**

Dispatch them all in one message. No parallelism cap — subagents don't render in tmux panes, Claude Code streams their progress inline.

### Specialist personas

Each specialist has a **persona** (name + defining trait). Include the persona in the agent's prompt — it keeps them focused and in character.

### Core Specialists (always dispatched)

**ac-validator** — **Eva**, QA Lead — "I trust nothing without proof in the code."
- `subagent_type: "feature-dev:code-explorer"`
- For each AC: search code for evidence. Rate IMPLEMENTED / PARTIAL / MISSING with file:line
- For each `[x]` task: find proof. No evidence = **CRITICAL**

**code-quality** — **Marcus**, Staff Engineer, 15 years experience — "Security and performance are non-negotiable."
- `subagent_type: "feature-dev:code-reviewer"`
- Focus: security (injection, auth, secrets), performance (N+1, memory), reliability (errors, edge cases), test quality

**git-auditor** — **Rex**, Code Archaeologist — "Every commit tells a story."
- `subagent_type: "general-purpose"`
- Runs `bash .aped/aped-review/scripts/git-audit.sh`
- Reports out-of-scope changes and missing expected changes

### Conditional Specialists (by file surface)

**backend** — **Diego**, Senior Backend Engineer, distributed systems — "Data integrity is sacred." (if backend files)
- `subagent_type: "feature-dev:code-reviewer"`
- API contracts, validation at boundaries, transaction integrity, DB schema, auth middleware
- Compliance with architecture.md

**frontend** — **Lucas**, Senior Frontend Engineer, a11y advocate — "Consistency is kindness." (if frontend files)
- `subagent_type: "feature-dev:code-reviewer"`
- Component hierarchy, state management, accessibility, forms, loading/error/empty states
- Compliance with UX spec

**visual** — **Aria**, Design Engineer — "Pixel-perfect or nothing. I live in the devtools." (if frontend + preview app)
- `subagent_type: "general-purpose"`
- **Ownership**: dev already ran React Grab at each GREEN (see `aped-dev` § Frontend Detection). Aria's job is to **validate** that work, not redo it from scratch.
- **Validate**: design-spec compliance (tokens, spacing, typography), cross-screen consistency, edge cases dev may have skipped (loading / empty / error / disabled states), responsive behaviour
- **Re-inspect with React Grab only when**: dev flagged an unresolved visual issue, a design-spec violation is suspected, or a cross-component consistency check is needed
- **If React Grab MCP is unavailable**: fall back to static screenshots + code review; explicitly note in the report that a deep visual audit wasn't possible (do not silently pass)

**devops** — **Kai**, Platform Engineer, on-call veteran — "If it's not automated, it's not done." (if infra files)
- `subagent_type: "feature-dev:code-reviewer"`
- CI/CD security, IaC least privilege, container hardening, deployment safety

**fullstack** — **Sam**, Tech Lead, system thinker — "I see the pipeline, not the layers." (if story spans 2+ layers)
- `subagent_type: "feature-dev:code-explorer"`
- End-to-end data flow, contract alignment, auth propagation across layers

### Specialist report contract

Each specialist returns its findings in this shape — no coordination tax, just a clean report:

```markdown
## {specialist-name} Report

### Findings
- [SEVERITY] Description [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}

### Summary
- Checked: {scope}
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
- Open questions for Lead: {if any, e.g. "Should validation also run on admin endpoints? See Diego's finding #2."}
```

### Lead's role

You (the Lead) receive all specialist reports as tool results. Your job in Step 6:
- Merge duplicate findings (same issue flagged by multiple specialists → one entry with combined evidence)
- **Cross-reference** domains manually — if Diego flagged a typing gap and Lucas flagged a contract mismatch, they're likely the same issue. You're the human-in-the-loop relay, not SendMessage.
- Pull "Open questions" forward — answer them with user input when needed, or redispatch a specialist with sharper instructions.

## Step 6: Merge Findings

As the Lead, collect all specialist reports and merge:

1. **Deduplicate** — same issue flagged by multiple specialists = one finding (mention all perspectives in evidence)
2. **Cross-reference** — if backend says "API returns unknown" and frontend says "no type for delete response", they're the same issue
3. **Prioritize** — CRITICAL > HIGH > MEDIUM > LOW
4. **Verify minimum 3** — if total findings across team < 3, **re-dispatch** the most relevant specialist with stricter instructions ("look harder at edge cases, error handling, security surface")
5. **Check ticket comments** — if a team member commented on the ticket about a known limitation, don't re-flag it as a finding; note it as "acknowledged"

## Step 7: Present Report to User

Format the final report:

```markdown
## Review Report — {story-key}

**Ticket:** {ticket-id}
**Specialists dispatched:** {list}
**Total findings:** {N} ({critical}/{high}/{medium}/{low})
**Verdict:** APPROVED | CHANGES_REQUESTED

### Findings

#### Critical / High
- [SEVERITY] Description [file:line]
  - Evidence: {summary}
  - Suggested fix: {approach}
  - Source: {specialist name}

#### Medium / Low
- ...

### Ticket sync
- {summary of ticket comments referenced or new info added}
```

⏸ **GATE: User decides per finding — fix now / dismiss.** Do NOT change status.

## Step 8: Apply Fixes

For findings the user wants fixed:

- **Simple fix** (< 20 lines, single file, ownership clear): Lead applies directly.
- **Cross-specialist fix** (finding touches another domain, or ownership ambiguous): Lead redispatches the affected specialist as a subagent asking "Does this approach break anything you own? Confirm or propose a fix." Apply only after the specialist's answer arrives.
- **Complex fix** (multi-file, architectural): Lead re-dispatches the relevant specialist as a fix agent with the finding + suggested approach. Specialist applies the fix and reports back.

Rule of thumb: if a specialist raised the finding, the Lead either applies the fix alone (if clearly scoped) or loops that specialist back in as a one-shot subagent for a sanity check.

After each fix: run tests. Commit: `fix({ticket-id}): description of fix`

## Step 9: Re-Verify

After all fixes applied:
- Re-dispatch the specialists that flagged the fixed findings — they verify the fix is correct and no new issues introduced
- If any specialist reports the fix is incomplete or introduces a regression: loop back to Step 8

## Step 10: Status Decision

Binary transition:
- All findings resolved (fixed or dismissed) → story `done`
- Unresolved findings remain → story stays `review`

## Step 11: Update Remote (ticket + PR)

Do this BEFORE local state — remote failures are recoverable, but state.yaml getting ahead of reality is not.

If `ticket_system` != `none`: post the review report as a comment on the ticket.

If story → `done`:
1. Approve/merge the PR (adapt to `git_provider`)
2. Move ticket to **Done**
3. Delete the feature branch (see "Worktree cleanup" below — different commands in parallel-sprint mode vs classic)

If story stays `review`:
1. Post each finding as a PR comment with line anchor
2. Ticket stays **In Review**

### Worktree cleanup (`done` only, parallel sprint)

If this review ran inside a worktree (marker `.aped/WORKTREE` exists), bundle the cleanup:

- **workmux detected** (`command -v workmux`) → one-shot: `workmux merge` merges the branch, removes the worktree, closes its tmux window, and deletes the local branch in a single command. Recommend it to the user rather than running the three steps yourself.
- **workmux absent** → call the fallback: `bash ${project_root}/.aped/scripts/worktree-cleanup.sh ${worktree_path} --delete-branch` (run from the main project, not the worktree).

In classic (non-parallel) mode, just delete the feature branch as usual.

## Step 12: Update Local State

1. Update story file: Dev Agent Record → Review Record (findings, outcome, specialists)
2. Update `docs/state.yaml`: story → `done` or stays `review`

## Step 13: Next Step

Specialists were dispatched as plain subagents — no team to tear down.

### Parallel-sprint checkin (only when story → done inside a worktree)

If this session is a Story Leader (`.aped/WORKTREE` exists OR the worktree path is registered in sprint.stories.{key}) AND the story just flipped to `done`, post a `review-done` check-in so the Lead can verify and recommend cleanup:

```bash
bash ${project_root}/.aped/scripts/checkin.sh post {story-key} review-done
```

No HALT — the story is finished. The Lead picks up the check-in and tells the user what to do next (typically `workmux merge` inside this window, or the scripted fallback).

If the story stayed `review`, do NOT post a check-in — the user stays in control and will re-invoke /aped-review after fixing.

### Next Step messaging

If story → `done`:
- In parallel mode: "review-done check-in posted. Wait for `/aped-lead` to confirm cleanup instructions."
- Classic mode: "Run `/aped-story` to prepare the next story."
- Sprint complete: report completion.

If story stays `review`:
- "Fix the remaining findings, then re-run `/aped-review`."

**Do NOT auto-chain.** The user decides when to proceed.

## Example

Story: `1-2-contract-package-scaffold` (backend + shared packages)

Classification: backend files only
Dispatched: `ac-validator`, `code-quality`, `backend-specialist`, `git-auditor` (4 agents in parallel)

Reports return:
- ac-validator: 6 ACs, 5 IMPLEMENTED + 1 PARTIAL (build hang unrelated)
- code-quality: 2 HIGH (DoS via unbounded password, missing .output())
- backend-specialist: 1 HIGH (path traversal in filename), 1 MEDIUM (phantom deps)
- git-auditor: clean

Lead merges: 3 HIGH + 1 MEDIUM. Minimum met.

User: "Fix all HIGH, dismiss the MEDIUM."
→ Lead applies 2 simple fixes, re-dispatches backend-specialist for the path traversal fix
→ All specialists re-verify → clean → story `done`
→ Ticket comment posted, PR merged, state updated
→ "Run /aped-story for the next."

## What NOT to Do

- **Don't rubber-stamp.** "Code looks clean" is not a review. Your job is to find problems. If you found 0-2 issues, you didn't look hard enough — re-examine error handling, edge cases, missing tests, and security surface.
- **Don't review only the happy path.** What happens when the input is null? Empty string? 10MB payload? Concurrent requests? The bugs live in the edges, not the golden path.
- **Don't skip the git audit.** Files modified outside the story scope are the #1 source of silent regressions. The script catches what your eyes miss.
- **Don't conflate style with substance.** Naming nitpicks and formatting preferences are LOW at best. Focus on logic errors, missing validation, security gaps, and test coverage holes.
- **Don't auto-fix HIGH+ findings without understanding them.** A HIGH finding means something is structurally wrong. Slapping a fix on it without understanding why it happened will introduce a new bug. Send it back to dev with a clear explanation.
- **Don't validate tests by reading them — run them.** A test that "looks correct" but hasn't been executed is decoration. Verify with `run-tests.sh`.

## Common Issues

- **Git audit fails (no git repo)**: Script handles this — skips audit with WARNING, proceeds to code review
- **Fewer than 3 findings**: Re-examine edge cases, error handling, test gaps, security surface
- **Story file not found**: Check `sprint.stories` in state.yaml — story key may have changed
