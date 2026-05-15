<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.


# APED Ship — Sprint Umbrella → Base PR

The end-of-sprint counterpart to `aped-sprint`. The umbrella branch (`sprint/epic-{N}`, created by aped-sprint at sprint start) has been accumulating story merges from aped-lead's au-fil-de-l'eau approvals. `aped-ship`'s job is the **final PR**: verify the umbrella is integration-complete, run the composite pre-push review on it, push, and print the `gh pr create --base <base> --head sprint/epic-N` command for the user.

`aped-ship` does NOT merge stories. Per-story merges into the umbrella are owned by `aped-lead` (au-fil-de-l'eau, see aped-lead.md). If a story isn't merged into the umbrella by ship time, that's a workflow gap the user fixes (re-run aped-lead, or merge manually) — not something aped-ship works around.

**Sprint mode is transparent here.** The umbrella → base topology is identical whether the sprint ran in parallel (N worktrees) or sequential (one shared worktree, branches stacked via git-spice): every story is its own branch merged into `sprint/epic-{N}` before ship. The Integration Check, Composite Review, and final PR command all operate on git refs only — they do not care which mode produced them. If `sprint.mode: sequential` is set, no special handling is needed in this skill.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Critical Rules

- Only run from the **main project root** on the **base branch** (default `main`; configurable via `base_branch` in `.aped/config.yaml`). Refuse if `.aped/WORKTREE` exists in CWD, or if current branch != base.
- Working tree must be clean before starting. Stash or commit first.
- NEVER push the umbrella to origin automatically. Print the push + `gh pr create` commands; the user runs them.
- NEVER push directly to base from this skill. Base only ever sees commits via the umbrella PR — that's the umbrella convention.
- NEVER skip the composite review, even if the user says "just open the PR". The review IS the ship gate; its summary becomes the PR body.
- NEVER mutate the umbrella content here (no extra commits, no auto-fixes). The umbrella reflects aped-lead's merges; aped-ship is read-only on it apart from the push.
- Support `--plan-only`: if the user passes the flag, run Setup → Integration Check → Composite Review → Findings Report, then **STOP before the GATE**. Do not push, do not print `gh pr create` as a recommendation, do not archive inboxes. Show what *would* be done. Useful for pre-flight inspection on a sensitive sprint.

> **Setup pointer.** Reads `git_provider` and `ticket_system` from `.aped/config.yaml`. Opens the umbrella PR via `git_provider` (github / gitlab / bitbucket) and closes the matching tickets via `ticket_system` when configured. With both `none`, prints the manual commands and exits without push. Hard-dep matrix: `docs/skills-classification.md`.

## Setup

1. Verify you are in the main project root: `ls .aped/WORKTREE` must fail.
2. Verify branch: `git symbolic-ref --short HEAD` must return the base branch (read `base_branch` from `.aped/config.yaml`; default `main`).
3. Verify clean tree: `git status --porcelain` must be empty. If not, HALT and tell the user to commit/stash first.
4. **Validate state integrity:** run `bash .aped/scripts/validate-state.sh`. Non-zero → HALT with the reported error. The umbrella PR is the single thing that lands in prod for this sprint — it must not be opened from a state file of unknown structure.
5. Read `docs/state.yaml`.
6. **Load the umbrella branch:**
   ```bash
   UMBRELLA=$(yq '.sprint.umbrella_branch' docs/state.yaml)
   ```
   If empty/null → HALT: "No sprint umbrella recorded. aped-sprint creates it at the start of the sprint — did you skip aped-sprint?"
   If the local branch doesn't exist → HALT: "Umbrella `$UMBRELLA` recorded in state.yaml but not in local git. Fetch and re-create with `git branch $UMBRELLA origin/$UMBRELLA` (if remote exists) before re-running."
7. Fetch remote to compute accurate "ahead" counts: `git fetch origin --quiet`.

## Integration Check

Verify every `done` story of the active epic is actually merged into the umbrella. Both signals must agree:

```bash
EPIC_N=$(yq '.sprint.active_epic' docs/state.yaml)
DONE_KEYS=$(yq ".sprint.stories | to_entries | map(select(.value.status == \"done\" and (.key | startswith(\"${EPIC_N}-\")))) | .[].key" docs/state.yaml)

unmerged=()
for key in $DONE_KEYS; do
  ticket=$(yq ".sprint.stories.\"$key\".ticket" docs/state.yaml)
  branch="feature/${ticket}-${key}"
  merged_flag=$(yq ".sprint.stories.\"$key\".merged_into_umbrella // false" docs/state.yaml)
  if ! git branch --merged "$UMBRELLA" | grep -q "^[[:space:]]*$branch$"; then
    unmerged+=("$key|state=$merged_flag|git=NO")
  elif [[ "$merged_flag" != "true" ]]; then
    # Git says merged but state.yaml says no — usually a manual merge by the
    # user that bypassed aped-lead. Surface as a soft inconsistency.
    unmerged+=("$key|state=$merged_flag|git=YES")
  fi
done
```

Surface the result:

- **All done stories merged into umbrella, both signals agree** → proceed to Composite Review.
- **Stories `done` in state.yaml but NOT in umbrella git history** → HALT with the list. Tell the user: "These stories are marked done but their feature branches haven't been merged into `$UMBRELLA`. Either re-run `aped-lead` (it will retry the merge during the review-done approval handler) or merge them manually before re-running `aped-ship`."
- **Stories merged in git but `merged_into_umbrella: false` in state.yaml** → WARN, offer to reconcile by setting the flag. Do not auto-reconcile silently — surface the inconsistency.
- **Stories with status != done but branch exists and is unmerged** → INFO ("In flight: 1-6 review, 1-7 in-progress — not part of this ship.")
- **No done stories at all** → HALT: "No done stories to ship. Nothing to do."

## Composite Review (umbrella vs origin/<base>)

Run on the **umbrella branch** without checking it out (avoid mutating cwd). Use `git diff` with the explicit refs.

```bash
git fetch origin --quiet
RANGE="origin/${BASE_BRANCH}..${UMBRELLA}"
AHEAD=$(git rev-list --count "$RANGE")
```

Run each check, collect findings, keep going even if some fail (want the full picture before the user decides).

### 1. Secret / credential scan

```bash
git diff "$RANGE" -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.py' '*.go' '*.rs' '*.java' '*.rb' '*.php' '*.json' '*.yaml' '*.yml' '*.toml' '*.env*' \\
  | grep -E '^\\+' \\
  | grep -iE 'password|secret|api[_-]?key|token|bearer|access[_-]?key|private[_-]?key|credentials'
```

Filter noise: TypeScript/Go/Rust type declarations, interface fields, schema names, regex test fixtures, redact list literals (patterns like `'password'`, `'token'` used as keys in a redact array), `.env.example` lines with placeholder values (`user:password@`, `xxx`, `<redacted>`). Report only real-looking values (high-entropy strings, explicit `KEY=abc123real` assignments).

### 2. Debug / TODO scan

```bash
git diff "$RANGE" -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.py' '*.go' '*.rs' \\
  | grep -E '^\\+' | grep -E 'console\\.(log|warn|error|debug)|debugger;|print\\(|println!?|fmt\\.Println|TODO|FIXME|XXX|HACK'
```

Filter: test files often have `console.log` for intentional diagnostics; tag those as INFO not WARNING.

### 3. Typecheck

The umbrella has been collecting story merges; run typecheck against its tip. **Trap-protect the checkout** so a failure in the runner (or an interrupted skill run) cannot leave the user stranded on the umbrella branch:

```bash
PKG=$(bash .aped/scripts/detect-package-runner.sh)   # bun|pnpm|yarn|npm — deterministic
ORIGINAL_BRANCH="$BASE_BRANCH"                              # captured at Setup, verified clean
trap 'git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true' EXIT INT TERM
git checkout "$UMBRELLA"                                    # safe: working tree verified clean at Setup
TYPECHECK_RC=0
"$PKG" run typecheck || TYPECHECK_RC=$?                     # capture; do not abort the section
git checkout "$ORIGINAL_BRANCH"                             # explicit return; trap is the safety net
trap - EXIT INT TERM                                        # clear trap once the explicit checkout succeeded
```

If `TYPECHECK_RC != 0`, classify findings as BLOCKERs and continue to Lint (we want the full picture). The trap guarantees that even if the agent crashes mid-section, the working tree returns to the base branch on exit.

Detect project type from root `package.json` and workspaces:
- If root `package.json` has `scripts.typecheck` → `$PKG run typecheck`. **Never invent the runner** — `detect-package-runner.sh` is the single source of truth (the four "or equivalent" hallucinations from pre-4.9.0 are exactly this footgun).
- Else, detect a TS monorepo (look for `turbo.json` with typecheck task, or workspaces with `tsc`).
- Else, if `tsconfig.json` exists at root → `"$PKG" exec tsc --noEmit`.
- Else, skip (not a TS project).

Capture errors. Group by file.

### 4. Lint

If root `package.json` has `scripts.lint` → run it on the umbrella tip using the **same trap-protected checkout pattern as typecheck above**:

```bash
trap 'git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true' EXIT INT TERM
git checkout "$UMBRELLA"
LINT_RC=0
"$PKG" run lint || LINT_RC=$?
git checkout "$ORIGINAL_BRANCH"
trap - EXIT INT TERM
```

Capture errors vs warnings.

### 5. Database regen

Detect Prisma:
- `apps/*/prisma/` or `prisma/` dir at root → Prisma project.
- Root `scripts.db:generate` exists → run `pnpm db:generate` on the umbrella tip.
- Else `pnpm exec prisma generate` in the relevant workspace.

Apply the **same trap-protected checkout pattern**:

```bash
trap 'git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true' EXIT INT TERM
git checkout "$UMBRELLA"
DB_RC=0
"$PKG" run db:generate || DB_RC=$?
git checkout "$ORIGINAL_BRANCH"
trap - EXIT INT TERM
```

If regen fails on a missing env var (common: `DIRECT_URL` coalesce bugs), report the exact error as a BLOCKER. Do NOT silently fix `.env` — the user needs to know.

Other ORMs (Drizzle, TypeORM with sync, etc.): surface the relevant regen/migration command as a WARNING for the user to run.

### 6. state.yaml consistency on umbrella

Read `$docs/state.yaml` from the umbrella tip and verify:
- Every `done` story has `merged_into_umbrella: true`.
- No story with `status: in-progress` or `review-queued` remains in the active epic (those should block the ship — they're active work).
- `sprint.umbrella_branch` matches the umbrella we're shipping.

```bash
git show "${UMBRELLA}:$docs/state.yaml" | yq '...'
```

### 7. Leftover worktrees / branches

```bash
git worktree list --porcelain                  # only the main worktree should remain
git branch --no-merged "$UMBRELLA"             # any feature/* not yet merged into the umbrella?
```

Surface anything unexpected. Note: stories in flight (status != done) will appear as `--no-merged` against the umbrella — INFO not WARNING. The umbrella itself appears as `--no-merged` against the base — that's expected, it's about to become the PR.

## Findings Report

Triage into three severities:

- 🔴 **BLOCKER** — PR MUST NOT be opened. Examples: typecheck errors, real secret leak, `db:generate` fails, done story not in umbrella git history, in-progress story still live.
- ⚠️ **WARNING** — PR CAN be opened but user should acknowledge in the PR body. Examples: lint warnings, TODO/FIXME added, `merged_into_umbrella` flag inconsistency, unusual file count.
- ℹ️ **INFO** — metadata. Examples: file count, line count, list of merged stories, regen succeeded.

Present:

```
Sprint umbrella ship — `sprint/epic-1` is {AHEAD} commits ahead of origin/main.

🔴 BLOCKERS (2)
  apps/api/src/prisma/prisma.service.ts:8
    TS2307: Cannot find module '@/prisma/generated/client'
    Fix: add .js extension (NodeNext).
  apps/api/prisma.config.ts:14
    Prisma env('DIRECT_URL') throws on missing var — ?? fallback never triggers.
    Fix: use process.env.DIRECT_URL ?? process.env.DATABASE_URL.

⚠️ WARNINGS (1)
  apps/api/test/logging.e2e-spec.ts:18
    Relative import missing .js extension under NodeNext.

ℹ️ INFO
  Merged stories: 1-3-orpc-nest-adapter (KON-84), 1-4-prisma-schema (KON-85), 1-5-logging (KON-86)
  Diff: 85 files changed, +4479/-493
  Prisma client regenerated: ✓
  Leftover worktrees: none
  Umbrella state.yaml: consistent
```

## GATE — PR Decision

Present three options:

1. **Fix blockers first** (recommended when BLOCKERS > 0) — the user applies fixes on the umbrella branch directly (or on a story branch + rerun `aped-lead` to merge), then re-runs `aped-ship`. The composite review re-runs on the new tip.
2. **Open the PR anyway** — only sensible when findings are all WARNINGS or INFO.

   > **Writing discipline (PR title + body).** Before drafting either, read `.aped/aped-skills/writing-discipline.md`. Title: short, recognizable, ≤ 70 chars (epic slug + the *one* lever the sprint pulled, not the kitchen sink). Body: 3–6 short bullets — what the sprint changed for the reader, the WARNING items the reviewer should ack, link to the merged stories. Drop file lists, test counts, "boundaries respected" checkboxes. The diff proves the work; prose adds the *why*.

   Print the exact commands:

   ```
   git push -u origin "$UMBRELLA"
   gh pr create --base "$BASE_BRANCH" --head "$UMBRELLA" \\
     --title "Sprint epic-${EPIC_N} — <epic slug>" \\
     --body "$(composite review summary; list of merged stories with tickets)"
   ```

   Tell the user to run the commands themselves. Never execute them from the skill. Before printing, emit:

   ```bash
   bash .aped/scripts/log.sh pr_recommended \\
     umbrella="$UMBRELLA" base="$BASE_BRANCH" commits_ahead="$AHEAD" \\
     warnings="$WARN_COUNT" blockers="$BLOCKER_COUNT" stories="$DONE_KEYS_COMMA_LIST"
   ```

   For GitLab: substitute `glab mr create --target-branch "$BASE_BRANCH" --source-branch "$UMBRELLA" ...`.

3. **Abandon** — exit without pushing. The umbrella stays local with the merged stories; user can re-run later or reset.

⏸ **GATE: User picks.**

## Edge Cases

- **Umbrella missing from local git but recorded in state.yaml**: HALT (see Setup step 6). The user fetches and re-creates it from origin or restarts the sprint.
- **Stories `done` in state.yaml but unmerged in umbrella**: HALT with the list (see Integration Check). Re-run `aped-lead` or merge manually.
- **`merged_into_umbrella: true` but git disagrees**: WARN, surface the inconsistency. Likely the user manually unmerged or rebased the umbrella.
- **Base branch name differs from `main`**: read `base_branch` from `.aped/config.yaml` (or `.workmux.yaml`) if present; default to `main`. Used everywhere as `$BASE_BRANCH`.
- **Multiple `done` epics**: `aped-ship` only ships the active epic (`sprint.active_epic`). Stories from other epics are excluded with an INFO line.
- **User has unpushed non-sprint commits on the umbrella**: surface as INFO (`N non-sprint commits also on the umbrella`) — they'll go to base via the same PR.

## Inbox archive (post-PR)

After the user confirms the PR is opened (option 2 was chosen and they ran the printed commands), archive the checkin inboxes so the next sprint starts clean:

```bash
bash .aped/scripts/checkin.sh archive
```

This moves `.aped/checkins/*.jsonl` to `.aped/checkins/archive/{date}/`. Do NOT run if the user picked "Fix blockers" or "Abandon" — they may re-run aped-lead and need the live inboxes.

## Ticket close on merge (audit trail)

Once the umbrella PR is merged, every ticket associated with a `done` story of the active epic should be closed in the configured ticket system (read `ticket_system` from `.aped/config.yaml`). Wrap the close operations with a sync log so the audit trail records every provider call.

Before any provider call:

```bash
LOG=$(bash .aped/scripts/sync-log.sh start <provider>)
```

Then, for each story branch closed at merge time (one provider call per branch — typical merge cleanup):

```bash
bash .aped/scripts/sync-log.sh phase $LOG branch_close complete '{"calls":B,"branches":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total B
```

Then, for the ticket-close batch (one provider call per ticket — e.g. `gh issue close`, `glab issue close`, Linear MCP state transition, Jira MCP transition):

```bash
bash .aped/scripts/sync-log.sh phase $LOG tickets_closed complete '{"calls":T,"tickets":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total T
```

If you also post a "shipped in PR #N" comment on each ticket — keep it one short line + the PR link, per `.aped/aped-skills/writing-discipline.md`:

```bash
bash .aped/scripts/sync-log.sh phase $LOG comments_posted complete '{"calls":C,"tickets":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total C
```

Close the log:

```bash
bash .aped/scripts/sync-log.sh end $LOG
```

Surface the log path to the user. If `ticket_system: none` or `sync_logs.enabled: false`, the helper exits silently and these calls are no-ops.

## Self-review (run before push gate)

- [ ] **Sync log emitted** at `docs/sync-logs/<provider>-sync-<ISO>.json` covering every ticket-close call (or skipped silently if no ticket system / `sync_logs.enabled: false`).

## Next Step

After the user opens the PR:

> "Umbrella PR opened: <PR URL>. The composite review summary is in the body. The PR is the prod gate now — base will not move until it's merged. Once merged, run `aped-sprint` (or `aped-epics` if you need a new epic) to start the next sprint; the umbrella branch can be deleted then."

If the user chose "Fix blockers first" or "Abandon":

> "Nothing pushed. The umbrella still has all the merged stories locally — re-run `aped-ship` after fixing the blockers."

**Do NOT auto-chain to `aped-sprint`.** The user decides when to start the next sprint.

## Completion Gate

BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-ship.md` and verify every item. Do NOT skip this step. If any item is unchecked, you are NOT done.
