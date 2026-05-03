
# APED Sprint — Parallel Story Dispatch

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

- Only run from the **main project root**. If `.aped/WORKTREE` exists in the current dir, HALT (you're inside a worktree, not the Lead).
- Support `--plan-only`: if the user passes the flag, run Setup → DAG → Capacity Check → Story Proposal → present, then **STOP before any mutation** (no umbrella creation, no ticket sync, no dispatch, no state.yaml writes). Print every command that would have run, with its exact arguments. Use this when reviewing a sprint plan before committing to it, or for audit/replay purposes.
- Exactly **one active epic** at a time. Refuse if `sprint.active_epic` is set to a different epic and that epic still has stories not `done`.
- Respect `sprint.parallel_limit` and `sprint.review_limit` in state.yaml.
- NEVER dispatch a story whose `depends_on` list contains a story not yet `done`.
- NEVER auto-launch `aped-dev`. The Story Leader's first action in its worktree is always `aped-story <story-key>` — story files belong to the feature branch, never to main.
- NEVER post the `story-ready` check-in from this skill. That is `aped-story`'s responsibility once the file is committed on the feature branch.
- NEVER flip `sprint.stories.{key}.status` to `in-progress` from this skill. Record the worktree path only; status changes are owned by `aped-story` (→ `ready-for-dev`) and `aped-dev` (→ `in-progress`).

> **Setup pointer.** Operates on the parallel-sprint machinery — requires `state.yaml.sprint.stories` populated by `aped-epics` and reads `git_provider` from `.aped/config.yaml` for worktree branch routing. Without an epics phase output, there's nothing to dispatch. Hard-dep matrix: `docs/skills-classification.md`.

## Setup

1. Verify you are in the main project root: `ls .aped/WORKTREE` must fail. If it exists, tell the user "You're inside a worktree. Switch to the main project to dispatch."
2. **Validate state integrity:** run `bash .aped/scripts/validate-state.sh`. Exit code 0 = proceed; non-zero = HALT and show the user the reported error (missing file, bad YAML, or invalid status value). Do NOT attempt to repair state.yaml automatically — tell the user to inspect and fix, or restore from `.aped/state.yaml.backup` if present.
3. Read `docs/state.yaml` — must have `current_phase: "sprint"` and `sprint.stories` populated by `aped-epics`.
4. Read `docs/epics.md` — for the DAG and story metadata.
5. If `sprint.active_epic` is `null`: ask the user which epic to start. Write it to state.yaml.
6. **Detect workmux + multiplexer** (preferred path):
   - `command -v workmux >/dev/null` → workmux binary present.
   - `command -v tmux >/dev/null || command -v wezterm >/dev/null` → a multiplexer exists.
   - **Apply the WezTerm PATH fix automatically** — workmux shells out to the `wezterm` CLI. If `command -v wezterm` fails but `$WEZTERM_EXECUTABLE_DIR` is set, run `export PATH="$WEZTERM_EXECUTABLE_DIR:$PATH"` in the skill's shell **before any workmux invocation**, and tell the user once: "Add `[[ -n \"\$WEZTERM_EXECUTABLE_DIR\" ]] && export PATH=\"\$WEZTERM_EXECUTABLE_DIR:\$PATH\"` to your `~/.zshrc` so workmux finds the CLI in every new shell." Don't just mention it — export it here so dispatch works in this session.
   - **Check tmux session state.** Workmux auto-picks its backend: if `$TMUX` is set you get tmux windows (sidebar/dashboard work); if empty it falls back to WezTerm native tabs (sidebar/dashboard do NOT work). If `$TMUX` is empty, warn the user ONCE before proceeding: "You're not inside a tmux session. workmux will dispatch to WezTerm native tabs — `workmux sidebar` and the tmux-based `workmux dashboard` pane will be blind to these agents. If you want live status tracking, exit and re-enter via: `tmux new-session -As aped` → `claude --permission-mode bypassPermissions` → `aped-sprint`. Otherwise proceed — dispatch still works, you just won't get the live bar."
   - **Verify `workmux setup` has been run.** Status tracking hooks (the `AGENT` column icons, agent-waiting detection) and the companion skills (`/merge`, `/rebase`, `/coordinator`, `/worktree`, `/open-pr`, `/workmux`) are installed by `workmux setup --skills`. Detect absence: if `~/.claude/skills/workmux` is missing, say once: "Run `workmux setup` (one-time, user-level) to enable agent-status icons and install the `/merge` skill the Lead delegates to." Don't block on it — APED falls back to `worktree-cleanup.sh` if `/merge` is absent.
   - If workmux + a multiplexer present → use Path A. Else fall back to Path B.
   - Do NOT reject Path A for cosmetic reasons (flag renames, missing `.workmux.yaml`). If syntax differs from what you expect, run `workmux add --help` to adapt. The current 0.1.x signature is `workmux add [OPTIONS] [BRANCH_NAME]` (positional, no `--branch`).

## Sprint Umbrella Branch

Every parallel sprint runs under a **sprint umbrella branch** that is the parent of every story feature branch and the only thing that ever PRs into the base branch. The umbrella is the unit of review for prod: stories PR into it (reviewed individually), and `aped-ship` opens one final PR from umbrella to the base branch.

After `sprint.active_epic` is set:

```bash
EPIC_N=$(yq '.sprint.active_epic' docs/state.yaml)
UMBRELLA="sprint/epic-${EPIC_N}"
BASE_BRANCH=$(yq '.base_branch // "main"' .aped/config.yaml)

# Create the umbrella from the latest base if it doesn't exist locally
if ! git rev-parse --verify "$UMBRELLA" >/dev/null 2>&1; then
  git fetch origin --quiet
  git branch "$UMBRELLA" "origin/${BASE_BRANCH}"
  git push -u origin "$UMBRELLA"
fi

# Record it in state.yaml so every other skill (review, lead, ship) reads
# the same value — never re-derive from the epic number elsewhere.
bash .aped/scripts/sync-state.sh <<< "set-sprint-field umbrella_branch \"$UMBRELLA\""
```

If the umbrella already exists in `state.yaml` and matches `sprint/epic-${EPIC_N}`, skip creation — we're resuming a sprint already in flight. If `sprint.umbrella_branch` is set but to a different name, HALT and ask the user (a previous aped-sprint run named it differently, or someone changed the active epic mid-sprint).

**Naming**: `sprint/epic-{N}` is fixed. The epic slug (e.g. "Foundation & Validators") goes in PR titles and commit prefixes, not in the branch name — so renaming an epic mid-sprint doesn't require renaming the branch.

## DAG Resolution

For the active epic, compute the three buckets:

- **done** — status `done`
- **running** — status in {`in-progress`, `review-queued`, `review`}
- **ready** — status `pending` or `ready-for-dev` AND every key in `depends_on` is in **done**
- **blocked** — not in the above; surface why (which dep is missing)

Sanity check the graph: no cycles, no references to unknown story keys. If broken, tell the user exactly which edge is the problem and HALT.

## Capacity Check

Before computing capacity, reconcile state.yaml against the disk:

```bash
bash .aped/scripts/check-active-worktrees.sh
```

Exit 0 → state matches reality, proceed. Exit 1 → one or more registered worktrees are gone (user did `rm -rf`, or a previous aped-ship cleanup didn't fully clear state). Surface the missing entries to the user with two choices:
- **Reset the orphan rows** (recommended if the work was abandoned): for each missing story, run `bash .aped/scripts/sync-state.sh <<< "set-story-status {key} ready-for-dev"` and `bash .aped/scripts/sync-state.sh <<< "clear-story-worktree {key}"`. This frees the slot.
- **Skip and respect the registered count** (if the user expects to recreate the worktree): proceed without resetting; capacity stays tight.

Then compute:

```
slots_available = parallel_limit - len(running)   # uses the post-reset count
reviews_running = count(status == "review")
reviews_available = review_limit - reviews_running
```

If `slots_available == 0`: tell the user "At parallel capacity. Wait for a story to finish review or merge, then re-run `aped-sprint`."

## Story Proposal

Take up to `slots_available` stories from **ready**, preferring:
1. Smaller complexity first (S before M before L) — unlocks deps faster
2. Stories that unblock the most other stories (reverse-topological tiebreaker)
3. User override: if the user asked for specific keys, dispatch those (still respecting deps)

Present the proposal:

```
Epic: 1 — Foundation & Validators
Active worktrees: 1/3 — will dispatch 2 more.

Proposed dispatch:
  1-2-contract         [S]  no deps          -> new worktree
  1-3-rpc-package      [M]  deps: 1-1 ✓     -> new worktree

Blocked (waiting):
  1-4-handlers         deps: 1-2 (pending)
  1-5-client-hooks     deps: 1-2 (pending)
```

⏸ **GATE: User validates the proposal.** If the user wants to swap, reduce, or reorder, adjust and re-present.

After the user confirms, emit one audit event before mutating anything:

```bash
bash .aped/scripts/log.sh dispatch_started \\
  epic="$(yq '.sprint.active_epic' docs/state.yaml)" \\
  stories="$(echo $approved_keys | tr ' ' ',')"
```

`worktree_created` and ticket-side events are emitted automatically by `sprint-dispatch.sh` and `checkin.sh`; you don't need to mirror them.

## Pre-dispatch ticket validation (read-only, if ticket_system != none)

Read `.aped/aped-dev/references/ticket-git-workflow.md` for provider syntax.

**Read-only check** for each story to dispatch — no mutations yet:
1. Fetch the ticket — verify it exists and is in a state that allows being picked up (no one else actively assigned, status is in the "ready" lane).
2. If a ticket fails this check, drop the story from the dispatch list and surface why to the user. Do not silently proceed.

**Why read-only at this stage:** the previous flow assigned and transitioned tickets *before* creating worktrees. If `git worktree add` then failed, the ticket was left assigned-and-in-progress with no corresponding work — manual cleanup territory. Mutations now happen in "Post-dispatch ticket sync" below, after the worktree exists and is recoverable.

## Dispatch

Two paths, picked by the Setup detection. **Neither path posts `story-ready` nor flips story `status` to `in-progress`** — aped-story (running inside the worktree on the feature branch) owns both transitions.

### Path A — workmux available (preferred)

`workmux` creates the worktree, opens a tmux/wezterm window, launches Claude Code per the configured pane command, **and auto-injects the first prompt via `-p`**. There is no manual step per window — `aped-story` runs as soon as claude is up.

If `.workmux.yaml` is missing at the repo root, bootstrap from `.aped/templates/workmux.yaml.example` before dispatching. The template copies everything the worktree needs to run Claude Code + APED end-to-end: `.env*`, `.mcp.json` (project-scoped MCPs — Linear/Stripe/etc., critical for aped-story ticket fetches), **the full `.claude/` directory** (commands, skills, settings.local.json — permissions shared across worktrees), and **the full `.aped/` directory** (APED skills, hooks, scripts, templates, config.yaml — without this the UserPromptSubmit hook fails immediately because `.aped/hooks/guardrail.sh` is missing). It symlinks `node_modules`, runs `pnpm install --frozen-lockfile` post_create, and uses `claude --permission-mode bypassPermissions` as the pane command so parallel Story Leaders don't block on approval prompts (the copied `settings.local.json` is the source of truth for permissions). Many APED users gitignore `.claude/` and `.aped/` as user-local tooling, so the copy is not redundant — it's what makes the worktree functional at all.

For each approved story (fresh worktree):

```bash
BRANCH="feature/{ticket-id}-{story-key}"
UMBRELLA=$(yq '.sprint.umbrella_branch' docs/state.yaml)

# Cut the branch from the umbrella FIRST so it has the right parent. workmux
# then attaches its worktree to the existing branch (no base-ref logic in
# workmux itself). Without this pre-cut, workmux would default to HEAD —
# which in the main checkout is the base branch, breaking the convention.
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git branch "$BRANCH" "$UMBRELLA"
fi
workmux add "$BRANCH" -p "aped-story {story-key}"
```

No `-a` flag — the pane config (`command: claude --permission-mode bypassPermissions`) already defines how claude launches. Workmux auto-detects the built-in `claude` agent in the pane command and injects `-p` via the supported prompt-injection path (writes a prompt file, claude reads it on startup).

Workmux slugifies the branch into a **handle** (`feature/KON-84-1-3-foo` → `feature-kon-84-1-3-foo`) and places the worktree at `<project>__worktrees/<handle>`. Recover the handle and path via:

```bash
HANDLE=$(workmux list --format name | grep -F "$BRANCH" | awk '{print $1}')   # or compute from slug
WORKTREE=$(workmux path "$HANDLE")
```

**If a git worktree already exists for the story** (user ran `sprint-dispatch.sh` earlier, or aped-sprint was interrupted), use the recovery path:

```bash
# 1. Ensure the worktree exists (idempotent)
WORKTREE=$(bash .aped/scripts/sprint-dispatch.sh <story-key> <ticket-id>)
HANDLE=$(basename "$WORKTREE")

# 2. Force a clean window re-open so the pane command re-executes.
#    `workmux open` runs pane commands only when CREATING the window; if
#    the window already exists it just switches to it (claude won't
#    auto-launch). Close first to guarantee re-creation.
workmux close "$HANDLE" 2>/dev/null || true
workmux open "$HANDLE" --run-hooks --force-files

# 3. Push the initial prompt. `workmux send` requires a running agent —
#    claude is up from step 2's pane command, so this works. (It wouldn't
#    work as a launcher — that's what step 2 is for.)
workmux send "$HANDLE" "aped-story <story-key>"
```

**Why not `workmux run "$HANDLE" -- claude`?** `run` captures output as artifacts and blocks by default — it's for scripted commands, not for launching an interactive agent in the existing pane. The close+open cycle is the clean way to (re)start the configured agent pane.

Verify the windows exist and the agent is running before moving on:

```bash
workmux list   # MUX column must be ✓; AGENT column shows claude status if hooks are installed
```

**About the `AGENT` column.** Workmux tracks agent status via plugin hooks injected into Claude Code's settings. `workmux setup` installs them and also adds useful companion skills (`/merge`, `/rebase`, `/worktree`, `/coordinator`, `/open-pr`, `/workmux` reference). If `workmux setup` has never been run, the AGENT column stays `-` even when claude is actually running. Tell the user once: "Run `workmux setup` in the main project once — it installs status tracking hooks and the `/merge`, `/rebase`, `/coordinator` companion skills APED's Lead later delegates to."

If after the recovery path claude did not launch (verify with `workmux capture "$HANDLE" | tail -5` — the pane should show claude's banner, not a bare shell prompt), tell the user: "Switch to the window and type `claude --permission-mode bypassPermissions` — your `.workmux.yaml` may not declare an agent pane, or the pane command didn't take."

Capture the worktree path for the state.yaml write (below): `workmux path "$HANDLE"` or `git worktree list --porcelain` filtered by the branch we just created.

### Path B — fallback without workmux

For each approved story, call the built-in helper, **passing the sprint umbrella as the base ref** so the new feature branch is parented under it:

```bash
UMBRELLA=$(yq '.sprint.umbrella_branch' docs/state.yaml)
WORKTREE=$(bash .aped/scripts/sprint-dispatch.sh <story-key> <ticket-id> "$UMBRELLA")
```

The helper creates the worktree, the branch (cut from `$UMBRELLA`), and the `.aped/WORKTREE` marker. The user will open a terminal per worktree manually.

If you omit the umbrella arg, sprint-dispatch.sh falls back to HEAD — only acceptable in solo/non-sprint mode where there is no umbrella.

### Shared post-dispatch

If any command exits non-zero, halt the whole dispatch — do not create a half-populated state. Report the error.

After success, update state.yaml **atomically** (one write at the end, not per story) with the **worktree path only**:
- story `worktree` → the captured path

Do NOT set `status: in-progress` and do NOT set `started_at` here. `aped-story` will flip the story to `ready-for-dev` when the story file is committed on the feature branch; `aped-dev` will flip it to `in-progress` when it starts the TDD loop.

## Post-dispatch ticket sync (if ticket_system != none)

Now that the worktrees exist on disk and `state.yaml` records them, mutate the tickets. The order matters: worktree first (reversible — `git worktree remove`), ticket mutation last.

For each successfully dispatched story:
1. Assign the ticket to the current user.
2. Move status to "In Progress" (adapt label/status to provider).
3. Post a comment: `APED parallel sprint started — worktree: <captured path>.`

**On ticket-sync failure** (network blip, provider 5xx, permission denied), do NOT roll back the worktree. Instead:
- Mark the story in state.yaml: set `ticket_sync_status: failed` and `ticket_sync_error: "<short reason>"` (use `sync-state.sh set-story-field` if available, or write directly).
- Tell the user once: "Ticket sync failed for {N} stories: {keys}. Worktrees are healthy — re-run `aped-lead` to retry the ticket-side mutation, or fix manually in {provider}."

`aped-lead` watches for `ticket_sync_status: failed` and offers a retry on its dashboard. `aped-status` surfaces the same as a ⚠ on the worktree row. The worktree itself stays usable — Story Leader can keep working; only ticket-system reflection is deferred.

## User Instructions

**Path A (workmux)** — claude is running in each window AND `aped-story` was auto-injected via `-p`. Tell the user:

```
▶ Dispatched 2 stories via workmux. Each Story Leader is already running
  aped-story on its own feature branch — no manual step needed.

    1-2-contract   handle: feature-kon-83-1-2-contract   <project>__worktrees/feature-kon-83-1-2-contract
    1-3-rpc        handle: feature-kon-84-1-3-rpc        <project>__worktrees/feature-kon-84-1-3-rpc

  Each aped-story will: draft the story file on the feature branch, commit it,
  post the story-ready check-in, then HALT. Come back here and run aped-lead
  to approve — the Lead will push aped-dev into each window via workmux send.

  Monitor:
    workmux list                       status of every worktree
    workmux dashboard                  TUI with live agent output
    workmux capture <handle> -n 50     last 50 lines of a window
    workmux send <handle> "<prompt>"   send a prompt to a running agent
```

**If the recovery path was used** (`close` + `open` + `send` instead of `workmux add -p`), add this line to the user instructions:

```
  NOTE: worktrees existed, so windows were re-created via workmux close+open
  and aped-story was pushed via workmux send. If you see a bare shell in any
  window (no claude banner), type:
    claude --permission-mode bypassPermissions
  then aped-story <story-key> yourself. The .workmux.yaml may be missing a
  `command: claude …` pane.

  AGENT column in `workmux list` shows `-`? Run `workmux setup` once in
  the main project to install the agent-tracking hooks AND the /merge,
  /rebase, /coordinator companion skills APED leverages later.
```

**Path B (fallback)** — print one block per worktree:

```
▶ Story 1-2-contract — KON-83
  Worktree: ../cloudvault-KON-83
  Branch:   feature/KON-83-1-2-contract

  In a new terminal:
    cd ../cloudvault-KON-83
    claude
    aped-story 1-2-contract      # NOT aped-dev — story file must live on
                                  # the feature branch, not main
```

**In both paths, never suggest running `aped-story` in main.** Branch-per-story is non-negotiable — the story file is committed on the feature branch.

## Edge Cases

- **No active epic**: ask which epic to start; set `sprint.active_epic`.
- **All stories blocked by one foundation story**: propose only that foundation story (fan-in).
- **User wants multi-epic**: refuse politely — "APED parallel sprint runs one epic at a time. Finish the current one first, or mark its leftover stories as skipped."
- **A worktree already exists for a proposed story**: skip it (don't overwrite), surface it as "already dispatched".
- **State.yaml lock**: if `.aped/.state.lock` exists and is newer than 30s, another skill is writing — wait or warn the user.

## Next Step

After dispatch, tell the user:
> "Worktrees created and `aped-story` auto-injected into each window via workmux. Each Story Leader will draft its story file on the feature branch, commit it, post `story-ready`, and HALT. **Come back to this main session and run `aped-lead`** to approve the batch — the Lead will push `aped-dev` into each worktree via `workmux send`. As stories progress, each Story Leader will post `dev-done` and `review-done` check-ins; re-run `aped-lead` when `aped-status` shows new pending ones. Come back to `aped-sprint` to dispatch more when capacity frees up."

**Do NOT auto-chain beyond `aped-story`.** Auto-injecting `aped-story` is fine because it IS the Story Leader's legitimate first act on its own branch (nothing is approved yet, nothing merges). The user controls `aped-dev` and `aped-review` via `aped-lead`, and `aped-ship` handles the end-of-sprint batch merge.

## Completion Gate

BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-sprint.md` and verify every item. Do NOT skip this step. If any item is unchecked, you are NOT done.
