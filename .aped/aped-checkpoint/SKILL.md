---
name: aped-checkpoint
description: 'Human-in-the-loop review of recent changes. Summarizes what changed, highlights concerns, and halts for user approval. Use when user says "checkpoint", "review changes", "walk me through this", or invokes /aped-check.'
allowed-tools: "Read Grep Glob Bash"
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
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
3. **State changes**: Read `docs/state.yaml` — what phase/story moved?
4. **New artifacts**: Check for new files in `docs/` (specs, stories, reports)

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
