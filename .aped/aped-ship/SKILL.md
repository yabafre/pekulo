---
name: aped-ship
description: 'End-of-sprint orchestrator. Batch-merges all `status: done` feature branches in conflict-minimizing order, then runs a composite pre-push review on main (secret scan, typecheck, lint, db:generate, state.yaml consistency, leftover worktrees). HALTs before push — user decides. Use when user says "ship", "merge sprint", "pre-push", "aped ship", or invokes /aped-ship. Only runs from the main project on the main branch.'
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Ship — Sprint Merge + Pre-push Review

The end-of-sprint counterpart to `/aped-sprint`. Where `/aped-sprint` fans out into parallel worktrees, `/aped-ship` folds them back into main and verifies the composite is push-ready.

## Critical Rules

- Only run from the **main project root** on the **main branch**. Refuse if `.aped/WORKTREE` exists in CWD, or if current branch != main.
- Working tree must be clean before starting. Stash or commit first.
- NEVER push to origin automatically. Always HALT. `git push origin main` is printed, not executed.
- NEVER merge a story whose `sprint.stories.{key}.status` != `done`. If the Lead hasn't approved, it's not shippable.
- NEVER auto-resolve conflicts on non-state.yaml files. state.yaml conflicts use `--ours` (main is authoritative because `/aped-lead` already flipped the statuses there); everything else pauses for user resolution.
- NEVER silently skip the composite review, even if the user says "just merge and push". The review IS the ship gate.

## Setup

1. Verify you are in the main project root: `ls .aped/WORKTREE` must fail.
2. Verify branch: `git symbolic-ref --short HEAD` must return `main` (or the configured base branch if the project uses a different name — read `.aped/config.yaml` for `base_branch` if present).
3. Verify clean tree: `git status --porcelain` must be empty. If not, HALT and tell the user to commit/stash first.
4. Read `docs/state.yaml`, `.aped/config.yaml`.
5. Detect workmux + WezTerm PATH like `/aped-sprint` Setup step 6 (reuse the same rules; export PATH if needed).
6. Fetch remote to compute accurate "ahead" count: `git fetch origin --quiet`.

## Discovery

Find merge candidates. A candidate is a story where:
- `status` == `done` in state.yaml
- Its feature branch exists locally AND is not already merged into main

For each candidate, compute metadata:

```bash
BRANCH="feature/{ticket}-{story-key}"
if git branch --merged main | grep -q "^[[:space:]]*$BRANCH$"; then
  # already merged — skip
  continue
fi
SIZE_LINES=$(git diff --shortstat "main...$BRANCH" | awk '{print $4 + $6}')
FILE_COUNT=$(git diff --name-only "main...$BRANCH" | wc -l)
```

Present the dashboard:

```
Merge candidates (3):
  1-3-orpc-nest-adapter     [L]  feature/KON-84-1-3-orpc-nest-adapter     52 files, +3200/-180   fanout: 4 stories
  1-4-prisma-schema         [S]  feature/KON-85-1-4-prisma-schema          8 files,  +320/-90    fanout: 0
  1-5-logging               [S]  feature/KON-86-1-5-logging               12 files,  +680/-40    fanout: 0

Already merged (git says so): none
Excluded (status != done): 1-6 (pending), 1-7 (pending), …
```

If no candidates: "Nothing to ship. Run `/aped-sprint` to start a new batch, or `/aped-status` to see what's in flight." STOP.

## Merge Order Heuristic

Default: **smaller diff first** (ascending by SIZE_LINES). Rationale: merging the smallest change first reduces the chance of carrying conflicts into the next merge. If two branches touch disjoint files, order doesn't matter; if they both touch state.yaml (they will — /aped-story edits it on each branch), smaller-first keeps each conflict resolution small.

Tiebreak: fewer files first.

User can override the proposed order (e.g., "merge 1-3 last because I want to verify 1-4 and 1-5 on main first").

## GATE — Merge Batch

Present the plan:

```
Merge order:
  1. 1-4-prisma-schema        (smallest, deps ✓)
  2. 1-5-logging               (small, no deps)
  3. 1-3-orpc-nest-adapter    (largest, downstream fanout — last)

Conflict strategy:
  - state.yaml       → resolve with --ours (main is authoritative; Lead flipped statuses)
  - anything else    → HALT and ask the user to resolve

Worktree teardown:
  - workmux rm -f --keep-branch <handle>   (removes worktree + window, keeps branch for merge)
  - After merge: the branch is deleted by workmux merge, OR keep it and delete post-push
```

⏸ **GATE: User confirms order and strategy.**

## Merge Phase

For each branch in the confirmed order:

```bash
HANDLE="{slugified-branch-name}"
BRANCH="feature/{ticket}-{story-key}"

# 1. Remove the worktree (keep the branch — we still need to merge it)
if command -v workmux >/dev/null && workmux list | grep -q "$HANDLE"; then
  workmux rm -f --keep-branch "$HANDLE"
else
  # fallback: git worktree remove
  WORKTREE_PATH=$(git worktree list --porcelain | awk -v b="$BRANCH" '$1=="worktree"{p=$2} $1=="branch" && $2 ~ b{print p}')
  [ -n "$WORKTREE_PATH" ] && git worktree remove --force "$WORKTREE_PATH"
fi

# 2. Merge with explicit merge commit (no fast-forward — we want the history node)
git merge --no-ff "$BRANCH" -m "Merge story {story-key} ({ticket})"

# 3. If merge stopped on conflicts, handle them
if git status --porcelain | grep -q '^UU'; then
  # Inspect conflicts
  CONFLICTED=$(git diff --name-only --diff-filter=U)

  # Auto-resolve state.yaml with --ours (main wins)
  if echo "$CONFLICTED" | grep -qx "docs/state.yaml"; then
    git checkout --ours "docs/state.yaml"
    git add "docs/state.yaml"
    CONFLICTED=$(echo "$CONFLICTED" | grep -vx "docs/state.yaml")
  fi

  # Anything else → HALT
  if [ -n "$CONFLICTED" ]; then
    echo "HALT: conflicts on non-state files. Resolve manually then re-run /aped-ship."
    echo "$CONFLICTED"
    exit 1
  fi

  git commit --no-edit
fi
```

After ALL branches are merged, do one cleanup pass:
- Set `worktree: null` in state.yaml for every story we just merged (their worktrees no longer exist).
- Single commit: `chore(ship): clear worktree paths for merged stories {keys}`.

Report intermediate progress so the user can follow: after each merge, print `✓ merged {story-key} ({ticket})`.

## Review Phase — Composite Checks on main vs origin/main

Run each check, collect findings, keep going even if some fail (want the full picture before the user decides).

### 1. Secret / credential scan

```bash
git diff origin/main..main -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.py' '*.go' '*.rs' '*.java' '*.rb' '*.php' '*.json' '*.yaml' '*.yml' '*.toml' '*.env*' \\
  | grep -E '^\\+' \\
  | grep -iE 'password|secret|api[_-]?key|token|bearer|access[_-]?key|private[_-]?key|credentials'
```

Filter noise: TypeScript/Go/Rust type declarations, interface fields, schema names, regex test fixtures, redact list literals (patterns like `'password'`, `'token'` used as keys in a redact array), `.env.example` lines with placeholder values (`user:password@`, `xxx`, `<redacted>`). Report only real-looking values (high-entropy strings, explicit `KEY=abc123real` assignments).

### 2. Debug / TODO scan

```bash
git diff origin/main..main -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.py' '*.go' '*.rs' \\
  | grep -E '^\\+' | grep -E 'console\\.(log|warn|error|debug)|debugger;|print\\(|println!?|fmt\\.Println|TODO|FIXME|XXX|HACK'
```

Filter: test files often have `console.log` for intentional diagnostics; tag those as INFO not WARNING.

### 3. Typecheck

Detect project type from root `package.json` and workspaces:
- If root `package.json` has `scripts.typecheck` → `pnpm typecheck` (or npm/yarn equivalent).
- Else, detect a TS monorepo (look for `turbo.json` with typecheck task, or workspaces with `tsc`).
- Else, if `tsconfig.json` exists at root → `pnpm exec tsc --noEmit`.
- Else, skip (not a TS project).

Capture errors. Group by file.

### 4. Lint

If root `package.json` has `scripts.lint` → run it. Capture errors vs warnings.

### 5. Database regen

Detect Prisma:
- `apps/*/prisma/` or `prisma/` dir at root → Prisma project.
- Root `scripts.db:generate` exists → run `pnpm db:generate`.
- Else `pnpm exec prisma generate` in the relevant workspace.

If regen fails on a missing env var (common: `DIRECT_URL` coalesce bugs), report the exact error as a BLOCKER. Do NOT silently fix `.env` — the user needs to know.

Other ORMs (Drizzle, TypeORM with sync, etc.): surface the relevant regen/migration command as a WARNING for the user to run.

### 6. state.yaml consistency

Verify:
- Every story whose branch was just merged has `status: done` AND `worktree: null`.
- No story with `status: in-progress` or `review-queued` remains (those should block the ship — they're active work).
- `sprint.stories` exists and parses.

### 7. Leftover worktrees / branches

```bash
git worktree list --porcelain    # main should be the only worktree
git branch --no-merged main       # any non-merged feature/* left behind?
```

Surface anything unexpected.

## Findings Report

Triage into three severities:

- 🔴 **BLOCKER** — push MUST NOT happen. Examples: typecheck errors, real secret leak, `db:generate` fails, unresolved merge conflict, in-progress story still live.
- ⚠️ **WARNING** — push CAN happen but user should acknowledge. Examples: lint warnings, TODO/FIXME added, unusual file count, new dependencies without lockfile bump mentioned.
- ℹ️ **INFO** — metadata. Examples: file count, line count, list of merged tickets, regen succeeded.

Present:

```
Pre-push review — main is {N} commits ahead of origin/main.

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
  Merged: 1-3-orpc-nest-adapter (KON-84), 1-4-prisma-schema (KON-85), 1-5-logging (KON-86)
  Diff: 85 files changed, +4479/-493
  Prisma client regenerated: ✓
  Leftover worktrees: none
  state.yaml: consistent
```

## GATE — Push Decision

Present three options:

1. **Fix blockers first** (recommended when BLOCKERS > 0) — user applies fixes, re-runs `/aped-ship`. The skill will detect already-merged branches and skip straight to the review phase.
2. **Push anyway** — only sensible when the findings are all WARNINGS or INFO. Print the exact command:
   ```
   git push origin main
   ```
   Tell the user to run it themselves. Never execute it from the skill.
3. **Abandon** — exit without pushing. The merged state stays local, user can re-run or reset.

⏸ **GATE: User picks.**

## Edge Cases

- **Conflicts on non-state files**: merge stops, skill reports the files, HALTs. User resolves, runs `git add` + `git commit`, then re-runs `/aped-ship` — skill resumes from where it stopped (already-merged branches are detected and skipped).
- **Branch already merged**: skip silently, mention in INFO section ("1-X already merged — not re-merging").
- **Story status != done but branch exists**: exclude from candidates. Warn the user once: "feature/KON-X exists but 1-X isn't marked done — /aped-lead didn't approve review-done, did you skip a step?"
- **No state.yaml entry for an existing feature branch**: orphan branch, warn the user.
- **Base branch is not `main`**: read `base_branch` from `.workmux.yaml` or `.aped/config.yaml` if present; default to `main`. Everywhere above, "main" = that configured branch.
- **User has unpushed non-sprint commits on main**: the review still runs on the whole `origin/main..main` range. Surface them as INFO ("N non-sprint commits also in this push").

## Next Step

After a successful push:

> "Pushed {N} merged stories — {ticket list}. main is now in sync with origin/main. Capacity freed: {M} stories ready for the next sprint. Run `/aped-sprint` to dispatch, or `/aped-status` to see the full dashboard."

If the user chose "Fix blockers first" or "Abandon":

> "Nothing pushed. {N} merges are already in main locally — they persist. Re-run `/aped-ship` to retry the review once blockers are resolved."

**Do NOT auto-chain to `/aped-sprint`.** The user decides when to start the next batch.
