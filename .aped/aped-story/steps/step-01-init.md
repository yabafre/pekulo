---
step: 1
reads: 
  - ".aped/WORKTREE"
  - "git/HEAD"
writes: 
  - "tasks"
mutates_state: false
---

# Step 1: Initialization, Mode Detection, Branch Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER write a story file before this step completes
- 📖 ALWAYS read the complete step file before acting
- ❌ FORBIDDEN to start a story on `main` / `master` / `prod` / `production` / `develop` / `release/*` — branch-per-story is inviolable
- 🔄 Branch creation happens HERE, before any input discovery
- 🚪 DETECT existing workflow state and handle continuation properly
- 💬 FOCUS on initialization only — do NOT look ahead to story design

## CONTEXT BOUNDARIES

- Variables from `workflow.md` are available (config values resolved at activation).
- Previous context = nothing — this is the first step.
- The story key may be passed as argument; otherwise it's selected later in step 03.

## YOUR TASK

Initialize this skill's workflow: detect mode (worktree vs solo), refuse to operate on a protected branch, create the feature branch when needed, set up task tracking.

## INITIALIZATION SEQUENCE

### 1. Mode detection

Run, in order:

1. `ls .aped/WORKTREE` — if it succeeds, **worktree mode**. Read the marker (story_key, ticket, branch, project_root). Skip step 2's branch creation entirely (the worktree was already cut from the umbrella by `aped-sprint`). Confirm the current branch matches the marker's `branch`; if not, HALT.
2. `ls .aped/WORKTREE` fails. Before concluding **solo mode**, run this guard so a real worktree with a missing marker doesn't silently fall through:

   ```bash
   GIT_DIR=$(git rev-parse --git-dir 2>/dev/null || echo "")
   COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || echo "")
   # In a linked worktree the per-worktree gitdir lives under <common-dir>/worktrees/<name>;
   # in the main checkout GIT_DIR == COMMON_DIR.
   if [[ -n "$GIT_DIR" && -n "$COMMON_DIR" && "$GIT_DIR" != "$COMMON_DIR" && "$GIT_DIR" == *"/worktrees/"* ]]; then
     IN_WORKTREE=true
   else
     IN_WORKTREE=false
   fi
   ```

   If `IN_WORKTREE=true`, **HALT** — this is a sprint-owned worktree with no marker, almost certainly a workmux Path A dispatch that ran on a pre-6.12.2 aped-method. Tell the user verbatim:

   > ❌ **This is a git worktree but `.aped/WORKTREE` is missing.** I refuse to fall through to solo mode — it would lose the sprint link and the Story Leader would lose track of which story/ticket/branch it owns.
   >
   > Recovery (run from this worktree, replacing the placeholders with the right values — read them from `docs/state.yaml` `sprint.stories` if you're unsure):
   >
   > ```bash
   > bash .aped/scripts/write-worktree-marker.sh \
   >   --worktree     "$PWD" \
   >   --story        "<story-key>" \
   >   --ticket       "<ticket-id>" \
   >   --branch       "$(git symbolic-ref --short HEAD)" \
   >   --mode         parallel \
   >   --project-root "$(git rev-parse --show-toplevel | sed 's|/\\.worktrees/.*||;s|__worktrees/.*||')"
   > ```
   >
   > Then re-invoke `aped-story`. (If you scaffolded before 6.12.2, also `npx aped-method` to install the helper — it lives at `.aped/scripts/write-worktree-marker.sh`.)

   STOP. Do not continue.

3. `IN_WORKTREE=false` → genuine **solo mode**. Continue to the branch gate below.

### 2. Branch gate (solo mode only)

Run:

```bash
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "DETACHED")
```

**Refuse to proceed if `CURRENT_BRANCH` matches any of these patterns:**

| Pattern | Why |
|---------|-----|
| `main` | Production trunk on most repos. |
| `master` | Legacy production trunk. |
| `prod`, `production` | Some teams use these names. |
| `develop` | Git-flow integration branch. |
| `release/*` | Release stabilisation branches. |
| `DETACHED` (no current branch) | Detached HEAD = nothing to commit story to. |

If a refusal pattern matches, HALT with this exact message:

> ❌ **Cannot create a story on `{CURRENT_BRANCH}`.** APED's branch-per-story rule is inviolable: every story lives on its own feature branch.
>
> Choose one:
> - `[A]` — I'll create the feature branch for you (after we know the story key + ticket — proceeds to step 02).
> - `[B]` — Stop. You'll create the branch yourself, then re-invoke `aped-story`.
>
> Enter `[A]` or `[B]`.

Wait for the user. If `[B]`, STOP.

If `[A]`, mark a flag in your working state: **branch creation deferred to step 03** (we don't know the ticket / story key yet — solo mode picks the story from `state.yaml` after input discovery).

### 3. Initialize task tracking

Create one task to track this skill invocation:

- Subject: "Prepare story (key TBD until step 03)"
- Status: `in_progress`

You will replace `key TBD` with the actual story key once selected in step 03, and create one sub-task per story task in step 06.

### 4. Read state.yaml

Read `docs/state.yaml` (worktree-local copy in worktree mode, main's in solo mode). You'll need it in step 03 to scan `sprint.stories`. If the file doesn't exist, HALT and tell the user to run `npx aped-method` first.

### 5. Worktree-mode shortcut

In worktree mode, the story_key is already pinned by the marker. Skip the story-selection step in 03 — the marker is authoritative. If the user passed a `[story-key]` argument that differs from the marker, HALT and ask which is correct.

## SUCCESS METRICS

✅ Mode detected (worktree vs solo) and recorded.
✅ In solo mode: `CURRENT_BRANCH` checked against the refusal list, user prompted if refused, deferred-creation flag set if `[A]`.
✅ Task tracking initialized.
✅ `state.yaml` read.
✅ In worktree mode: marker validated against current branch.

## FAILURE MODES

❌ Proceeding to step 02 while `CURRENT_BRANCH` is `main` / `master` / `prod` / `develop` / `release/*` / detached.
❌ Skipping mode detection — running branch creation in worktree mode would create a nested branch.
❌ Creating the feature branch *now*, before knowing the ticket / story key (the branch name embeds those).
❌ Treating the marker as advisory in worktree mode — it's authoritative.

## NEXT STEP

After mode detection, branch gate (or deferral), and `state.yaml` load: load `.aped/aped-story/steps/step-02-input-discovery.md` to discover upstream artefacts.
