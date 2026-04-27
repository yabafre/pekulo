---
name: aped-quick
description: 'Implements quick fixes and small features bypassing the full pipeline. Use when user says "quick fix", "quick feature", "hotfix", "aped quick", or invokes /aped-quick.'
argument-hint: "<title> [fix|feature|refactor]"
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Quick — Fast Track for Small Changes

Use this for isolated fixes, small features, or refactors that don't warrant the full A→P→E→D→R pipeline.

## Setup

1. Read `.aped/config.yaml` — extract config
2. Read `docs/state.yaml` — note current phase for context
3. Scan `docs/quick-specs/` for any specs with `**Status:** in-progress`
   - If found: ask user — "Resume spec `{slug}` or start a new one?"
   - If resume: load that spec and skip to Implementation

## Spec Isolation

Each quick spec is an independent file: `docs/quick-specs/{date}-{slug}.md`
- Multiple specs can exist in parallel (different sessions, different developers)
- Status field tracks lifecycle: `draft` → `in-progress` → `done` or `abandoned`
- Never overwrite an existing spec — always create a new file with a unique slug

## Scope Check

This mode is for changes that:
- Touch **5 files or fewer**
- Can be completed in **1 session**
- Don't introduce **new architectural patterns**
- Don't require **new dependencies**

If any of these are violated, recommend the full pipeline instead.

## Quick Spec (2 minutes)

Ask the user:
1. **What?** — What needs to change (1-2 sentences)
2. **Why?** — Why now, what breaks without it
3. **Type?** — fix | feature | refactor

Generate a quick spec using `.aped/templates/quick-spec.md`:
- Fill: title, type, what, why, acceptance criteria, files to change, test plan
- Set `**Status:** draft`
- Write to `docs/quick-specs/{date}-{slug}.md`
- Present spec to user for validation before implementing

⏸ **GATE: User must approve the spec before implementation starts.**

Once approved, update `**Status:** in-progress`

## Implementation (TDD)

Same TDD cycle as aped-dev but compressed:

1. **RED** — Write test for the expected behavior
2. **GREEN** — Minimal implementation to pass
3. **REFACTOR** — Clean up while green

Run tests: `bash .aped/aped-dev/scripts/run-tests.sh`

## Self-Review (30 seconds)

Quick checklist — no full adversarial review:
- [ ] Tests pass
- [ ] No security issues introduced
- [ ] No regressions in existing tests
- [ ] AC from quick spec satisfied

## Git & Ticket Workflow

Read `ticket_system` and `git_provider` from config.
Read `.aped/aped-dev/references/ticket-git-workflow.md` for full guide.

1. **Branch**: create `fix/{ticket-id}-{slug}` or `feature/{ticket-id}-{slug}`
2. **Commits**: `type({ticket-id}): description` — include magic words per ticket provider
3. **PR/MR**:
   - `github`: `gh pr create --title "fix({ticket-id}): description" --body "Fixes {ticket-id}"`
   - `gitlab`: `glab mr create --title "fix({ticket-id}): description" --description "Closes {ticket-id}"`
   - `bitbucket`: push branch, create PR via web
4. **Ticket**: move to Done after merge

## Output

1. Update spec: set `**Status:** done`, fill the `## Result` section
2. No state.yaml update — quick specs don't affect pipeline phase
3. Report: files changed, tests added, quick spec path

## Example

User: "quick fix the login button not submitting"
1. Quick spec: fix, "login form submit handler not wired"
2. RED: test that clicking submit calls auth API
3. GREEN: wire onClick → submitForm()
4. Self-review: tests pass, no security issues
5. Commit: `fix(auth): wire login form submit handler`

## Common Issues

- **Change touches >5 files**: This is too big for quick — recommend full pipeline
- **New dependency needed**: HALT — ask user, this may need architectural discussion
