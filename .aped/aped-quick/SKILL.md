---
name: aped-quick
keep-coding-instructions: true
description: 'Use when user says "quick fix", "quick feature", "hotfix", "small change", "just fix this", "aped quick", or invokes aped-quick. Bypasses the full A→P→E→D→R pipeline — use only for isolated fixes.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "<title> [fix|feature|refactor]"
license: MIT
metadata:
  author: yabafre
  version: 6.8.0
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Quick — Fast Track for Small Changes

Use this for isolated fixes, small features, or refactors that don't warrant the full A→P→E→D→R pipeline.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

> **Setup pointer.** Integrates with `ticket_system` in `.aped/config.yaml` to label the hotfix on the source ticket so the team sees the bypass. With `ticket_system: none`, the skill writes its quick-spec under `docs/quick-specs/` only. Hard-dep matrix: `docs/skills-classification.md`.

## Setup

1. Read `docs/state.yaml` — note current phase for context
2. Scan `docs/quick-specs/` for any specs with `**Status:** in-progress`
   - If found: ask user — "Resume spec `{slug}` or start a new one?"
   - If resume: load that spec and skip to Implementation

### Fresh-read discipline

Read every source-of-truth file fresh in this skill — `config.yaml`, `state.yaml`, the resumed quick-spec if any, and any PRD / story / architecture file the title argument touches. Never trust a cached or compacted summary; cached summaries drop the scope-boundary text and FR/NFR IDs the quick spec must respect. If your context shows you a "summary of the PRD" instead of the file content, Read the file from disk.

## Out-of-Scope KB Scan

Before any new quick-spec is drafted, check `.aped/.out-of-scope/` for a persistent rejection that matches the user's title argument. The directory may not exist on pre-4.2 scaffolds — treat the missing directory as an empty KB and skip this section silently.

1. **List entries.** `ls .aped/.out-of-scope/*.md 2>/dev/null` excluding `README.md`. If empty (or directory missing), skip.

2. **Tokenize the title argument** (the `<title>` passed to the skill). Lowercase, strip punctuation, split on whitespace, `-`, and `_`. Drop ≤2-character tokens and stop-words (`add`, `fix`, `update`, `the`, `a`, `an`, `to`, `for`, `with`).

3. **Match entries.** For each entry file, tokenize its filename the same way (drop the `.md` extension; strip `-resolved-YYYY-MM-DD` suffix so old decisions still match). Match if any title token equals any filename token (exact word equality).

4. **No match → continue silently** to Spec Isolation.

5. **Match → surface to user.** Show the entry's frontmatter + `## Why this is out of scope` body, then present the menu:

   ```
   ⚠️ Out-of-scope KB match: .aped/.out-of-scope/{matched-file}

   {entry summary}

   [K] Keep refusal — abort this quick-spec, the rejection still holds
   [O] Override — append this request to "Prior requests", then continue drafting
   [U] Update — the rejection is stale; rename to {concept}-resolved-{today}.md and continue
   ```

   ⏸ **HALT — wait for user choice per match.**

6. **Behaviour by choice:**
   - `[K]` → abort with: `"Concept '{concept}' was declared out of scope on {rejected_at} (reason: {one-line rationale}). Refusing to draft this quick-spec. To revisit, re-invoke and pick `[U]`."` Exit cleanly without creating any spec file.
   - `[O]` → prepend `- {today} — quick-spec ({user_name}): {title}` to the entry's `## Prior requests` list. Continue to Spec Isolation.
   - `[U]` → rename the file to `{concept}-resolved-{YYYY-MM-DD}.md` and append `## Resolved on {YYYY-MM-DD}\n\n{one-line note from user}`. Continue to Spec Isolation.

7. **Multi-match.** Adjudicate per match, in order. Any `[K]` aborts the whole skill.

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

Quick checklist — no full adversarial review. Each `[x]` requires fresh evidence pasted in this message (Iron Law from `aped-review.md` applied to the quick path):

- [ ] **Tests pass** — `cat .aped/.last-test-exit` returned `0` AND the most recent run shown above this message included the test files you touched. If `.aped/.last-test-exit` is absent or stale (>10 min), re-run via `bash .aped/aped-dev/scripts/run-tests.sh` and paste output before checking.
- [ ] No security issues introduced — quick scan of the diff for hardcoded secrets / SQL string-concat / un-validated user input / shell command injection. If any present, halt and treat as a real story (run `aped-dev` instead).
- [ ] No regressions in existing tests — same `.aped/.last-test-exit == 0` check; if the test count *dropped* from the prior run, that's a regression-by-deletion.
- [ ] AC from quick spec satisfied — paste the AC text and the file:line where each is implemented.

## Git & Ticket Workflow

Read `ticket_system` and `git_provider` from config.
Read `.aped/aped-dev/references/ticket-git-workflow.md` for full guide.
Read `.aped/aped-skills/writing-discipline.md` before drafting commit / PR / ticket comment text — short, sharp, slightly human; the diff proves the work, prose adds the *why*.

1. **Branch**: create `fix/{ticket-id}-{slug}` or `feature/{ticket-id}-{slug}`
2. **Commits**: `type({ticket-id}): description` — include magic words per ticket provider
3. **PR/MR**:
   - `github`: `gh pr create --title "fix({ticket-id}): description" --body "Fixes {ticket-id}"`
   - `gitlab`: `glab mr create --title "fix({ticket-id}): description" --description "Closes {ticket-id}"`
   - `bitbucket`: push branch, create PR via web
4. **Ticket**: move to Done after merge — short comment + link to the merged PR, don't re-narrate the work in the ticket

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
