---
name: aped-checkpoint
keep-coding-instructions: true
description: 'Use when user says "checkpoint", "review changes", "walk me through this", "show me the diff", "walk the diff", "what just happened", "summarize the changes", or invokes aped-checkpoint. Not for sprint progress dashboards — see aped-status for that.'
allowed-tools: "Read Grep Glob Bash"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.0.0
---

# APED Checkpoint — Human-in-the-Loop Review

Pause, summarize recent changes, and wait for the user to confirm before proceeding. Use at any point in the pipeline when the user wants to review what's been done.

## When to Use

- After a complex implementation before moving to the next story
- After multiple quick-specs in a row
- When you are unsure a decision was correct
- When the user asks "what just happened?" or "walk me through this"
- Before any irreversible action (merge, deploy, major refactor)

## Step 1: Gather Changes

Analyze what has changed since the last checkpoint (or since session start):

1. **Git diff**: Run `git diff --stat` and `git diff --stat HEAD~N` to see files changed
2. **Recent commits**: Run `git log --oneline -10` for commit history
3. **State changes**: Read `docs/state.yaml` — what phase/story moved? **If state.yaml is absent** (greenfield mid-flight), report "no state.yaml — pre-pipeline checkpoint" and continue with git-only inputs; do not invent a phase.
4. **New artifacts**: Check for new files in `docs/` (specs, stories, reports)

## Step 1a: Token visibility (Pocock XS, 5.3.0)

Before summarising, note the session's approximate token usage. If the session has consumed >50% of the context window (visible via the model's self-reported usage or the CC status bar), flag it to the user: "Session at ~N% context — consider `/clear` + fresh invocation if the next phase is heavy." This is advisory, not a gate.

## Step 1b: Drift triggers — read your own last 5 turns

Before summarising, scan the recent assistant turns above this invocation for **any** of these drift triggers. Each one is a halt-and-re-anchor signal, not an "interesting observation". Pocock's discipline (workshop L1180-1198, L1338-1347): correction happens inline, not by clearing — quote the trigger, name what should have happened, ask the user to confirm before continuing.

| Trigger | What it looks like | Re-anchor to |
|---|---|---|
| **Wrong artefact location** | New file landed under a path the story / arch did not declare (e.g. `src/services/foo.ts` when story said `src/api/foo/handler.ts`) | Story File List + Architecture component map |
| **Horizontal slice** | Implementation mentions only one layer (db / api / ui) when the story is a vertical slice (db + api + ui together) | Story AC list — does each AC require all three layers? |
| **Wrong-backend invocation** | A `gh issue create`, `linear issues create`, `glab issue create`, `jira create` ran without first reading `ticket_system` from `config.yaml` | `.aped/config.yaml` `ticket_system` value |
| **Test-pass without RED witness** | Last test run reported "passing" but the assistant did not emit a `Confirmed RED:` token before the GREEN cycle | `aped-dev` § RED — was a witness emitted? |
| **Schema/identifier invention** | A migration / table name / enum value appears in the diff that does not match the literal text of any PRD / story | PRD + story — does the identifier appear verbatim? |

If any single trigger fires, **HALT before producing the summary**, surface the trigger to the user with file:line evidence, and ask: "Re-anchor to {source}?". The summary that follows must reflect the re-anchored decision, not the drifted state.

## Step 2: Concern-Ordered Summary

Present changes to the user ordered by **concern level** (highest first):

### Concern Types (priority order)
1. **RISK** — Security, data loss, breaking change potential
2. **ASSUMPTION** — Decision made without explicit user input
3. **DEVIATION** — Diverged from spec, story, or established pattern
4. **INFO** — Notable but not concerning

### Format

**Needs Attention** (if any):
- [RISK] Description [file:line]
- [ASSUMPTION] Description [file:line]

**Changes Made:**
- [type] Description [files affected]

**Artifacts Created/Updated:**
- Path and what it contains

**Decisions Made:**
- What was decided and why

### Rules
- Lead with concerns, not with a changelog
- If there are no concerns, say so explicitly — do not manufacture them
- Be specific: "Added user input to SQL query without parameterization" not "potential security issue"
- Include file:line references for every concern
- Keep it scannable — bullet points, not paragraphs

## Step 3: HALT

After presenting the summary, **stop and wait**.

Do NOT:
- Suggest next steps unprompted
- Continue to the next story/phase
- Ask "shall I proceed?" — just present and stop

The user will respond with one of:
- **Approve**: "looks good" / "proceed" / "ok"
- **Request changes**: "fix the SQL injection" / "revert that file"
- **Ask questions**: "why did you choose X over Y?"
- **Abort**: "undo everything since last commit"

If you make further changes based on user feedback, present a new mini-checkpoint and halt again.

## No State Change

Checkpoint is read-only — it does not modify state.yaml or advance the pipeline. It is purely an observation and communication tool.
