---
name: aped-status
keep-coding-instructions: true
description: 'Use when user says "sprint status", "show progress", "aped status", or invokes aped-status. Not for walking through a diff or summarising recent changes — see aped-checkpoint for that.'
allowed-tools: "Read Grep Glob Bash"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.12.4
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Status — Sprint Dashboard

Live dashboard for the pipeline and parallel sprint. Read-only — never writes, never changes status.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Setup

1. Read `docs/state.yaml` — pipeline + sprint state (active_epic, umbrella_branch, stories with their `status`, `worktree`, `depends_on`, `ticket`). **If state.yaml is absent**, the project is pre-pipeline (greenfield, never ran `aped-prd`/`aped-epics`). Surface "no state.yaml — pipeline not started yet" and stop here; do NOT invent a phase or fabricate a dashboard from git alone.

   `parallel_limit` and `review_limit` come from `.aped/config.yaml.sprint.*` on schema v3 (6.1.0+); fall back to `state.yaml.sprint.*` for v2 scaffolds, then to hardcoded `3`/`2` if both are absent. Use the shared resolution snippet:

   ```bash
   PARALLEL_LIMIT=$(yq '.sprint.parallel_limit // ""' .aped/config.yaml)
   if [[ -z "$PARALLEL_LIMIT" || "$PARALLEL_LIMIT" == "null" ]]; then
     PARALLEL_LIMIT=$(yq '.sprint.parallel_limit // 3' docs/state.yaml)
   fi
   REVIEW_LIMIT=$(yq '.sprint.review_limit // ""' .aped/config.yaml)
   if [[ -z "$REVIEW_LIMIT" || "$REVIEW_LIMIT" == "null" ]]; then
     REVIEW_LIMIT=$(yq '.sprint.review_limit // 2' docs/state.yaml)
   fi
   ```
2. Read `.aped/aped-status/references/status-format.md` for display conventions
3. Probe optional tooling once: `command -v workmux >/dev/null` — if available, surface a "Live agents: `workmux dashboard`" hint in the header so the user knows where the fuller TUI view is.

## 1. Pipeline Overview

```
Pipeline: A[✓] → P[✓] → UX[✓] → Arch[✓] → E[✓] → Sprint[▶]
```

Show the output path of each completed phase.

## 2. Sprint Header

```
Active epic:  1 — Foundation & Validators
Parallel:     2/3 in-progress      (limit: parallel_limit)
Reviews:      1/2 running          (limit: review_limit)
Queued:       1 story in review-queued
Scope change: locked | active      (scope_change_active flag)
Live agents:  workmux dashboard    (only shown if workmux is installed)
```

## 3. Active Worktrees

Before listing, run `bash .aped/scripts/check-active-worktrees.sh --format json` to surface state-vs-disk drift. Any row with `"reality":"missing"` should appear in the dashboard with a `✗ MISSING` marker and a hint:

```
✗ 1-2-bar  in-progress  /path/to/gone   MISSING — run aped-lead to reset
```

Then proceed with the normal listing below.

For each story with `status in {in-progress, review-queued, review}` AND a non-null `worktree`:

```
../cloudvault-KON-82  [1-1-zod-validators]   in-progress
  Branch: feature/KON-82-zod-validators
  Ticket: KON-82 · In Progress
  Last commit: 18m ago — "feat(zod): add user schema"
  Tests: ✓ 24/24 passing
  Started: 2h 12m ago
```

Gather this by:
- `git -C {worktree} log -1 --format='%ar — %s'` for last commit
- `git -C {worktree} status --porcelain | wc -l` for dirty count
- Read **`<worktree>/.aped/.last-test-exit`** (canonical path; written by `.aped/aped-dev/scripts/run-tests.sh` after every run). If absent or older than 10 min: mark `tests: unknown` (do not re-run from aped-status). If present and fresh: parse the file's first line as `<exit-code>` and report `tests: ✓ passing` for `0`, `tests: ✗ failing` for any non-zero. Never invent a different cache file (legacy paths like `coverage/lcov.info` or `tap-output.txt` are not the source of truth — `.aped/.last-test-exit` is).
- Ticket status via `gh`/`glab`/linear as per `ticket_system`

For stories in `review`, also show:
```
  Review: 5 findings (HIGH×2, MEDIUM×2, LOW×1) · auditors: Spec, Code, Edge
```

Read these from the story file's Review Record (no live auditor spawning here).

For any story with `ticket_sync_status: failed` set on it (deferred ticket mutation from `aped-sprint`), append a warning line under that worktree row:

```
  ⚠ Ticket sync deferred — reason: "<ticket_sync_error>". Retry via aped-lead.
```

## 4. Review Queue

```
Queue (waiting for a slot):
  1-3-rpc-package    queued 8m  · KON-84
```

Sorted by time in queue.

## 4b. Lead Check-ins Pending

Run `bash .aped/scripts/checkin.sh poll --format json` and show any pending entries:

```
Check-ins awaiting Lead Dev approval (2):
  1-2-contract      dev-done     posted 4m
  1-4-handlers      story-ready  posted 1m
```

If non-empty, add a hint: "Run `aped-lead` to batch-process these."

## 5. Ready to Dispatch

Stories with `status == pending | ready-for-dev` whose `depends_on` are all `done`:

```
Ready to dispatch (DAG resolved):
  1-4-handlers        [M]  no deps remaining
  1-5-client-hooks    [S]  no deps remaining

Blocked:
  1-6-e2e-tests       waiting on 1-4, 1-5
```

## 6. Done This Sprint

```
Done (epic 1):
  ✓ 1-1-zod-validators  · merged 1d ago
```

## 7. Ticket Sync Check (if ticket_system != none)

For each story with a ticket, compare local status to remote. **Cache remote fetches** in `.aped/.cache/tickets.json` for 60 seconds — Linear/Jira/GitHub all rate-limit, and a 20-story sprint runs 20 API calls per aped-status invocation otherwise.

```bash
CACHE_FILE=".aped/.cache/tickets.json"
CACHE_TTL=60   # seconds

cache_age() {
  [[ -f "$CACHE_FILE" ]] || { echo 999999; return; }
  local now mtime
  now=$(date +%s)
  # Both `stat -c %Y` (GNU) and `stat -f %m` (BSD/macOS) are tried. If both
  # fail (extremely rare — locked-down container without a real `stat`), force
  # cache-stale by emitting 999999 instead of `now`. Defaulting to `now` makes
  # the cache look fresh forever and silently swallows a real environment bug.
  mtime=$(stat -c %Y "$CACHE_FILE" 2>/dev/null || stat -f %m "$CACHE_FILE" 2>/dev/null || echo "")
  if [[ -z "$mtime" ]]; then
    echo "⚠ stat unavailable on this host — forcing ticket-cache refresh." >&2
    echo 999999
    return
  fi
  echo $((now - mtime))
}

if (( $(cache_age) < CACHE_TTL )); then
  # Reuse — read all ticket statuses from the cache JSON.
  jq -r '.[] | "\(.ticket) \(.status)"' "$CACHE_FILE"
else
  # Refresh — fetch each ticket and rewrite the cache atomically.
  mkdir -p "$(dirname "$CACHE_FILE")"
  fresh="$CACHE_FILE.tmp"
  # ... loop over tickets, fetch via gh/glab/linear/jira CLI, build JSON ...
  mv -f "$fresh" "$CACHE_FILE"
fi
```

| Local | Remote expected |
|-------|-----------------|
| pending / ready-for-dev | Backlog / Todo |
| in-progress | In Progress |
| review-queued / review | In Review |
| done | Done |

If divergent, surface: `⚠ 1-2 local=in-progress, ticket=Done — investigate`. Do not fix automatically.

## 8. Suggested Next Actions

Pick the most useful next step:

- If `parallel < parallel_limit` AND `ready_to_dispatch` non-empty → "Run `aped-sprint` to dispatch `{N}` more stories."
- If stories in `review` AND `reviews < review_limit` → "Run `aped-review {key}` in its worktree."
- If stories queued AND capacity available → "A slot is free. Re-run `aped-review` on the queued story."
- If everything done in active epic → "Epic `{N}` complete. Set `sprint.active_epic` to the next epic and re-run `aped-sprint`."
- If pipeline not yet at sprint phase → show the phase-appropriate suggestion (`aped-analyze`, `aped-prd`, ...).

## Output

Display only — no writes, no state changes. Suggest commands but never run them.

## Classic Mode (no parallel sprint)

If `sprint.active_epic` is `null` or no story has a `worktree` field set, fall back to the simpler pre-parallel display:

```
Epic 1: User Auth        [████████░░] 80% (4/5)
Next: aped-dev (story 1-5-session-mgmt is ready-for-dev)
```

## Common Issues

- **State file not found**: Ensure `docs/state.yaml` exists — run aped-analyze first
- **Stories show wrong status**: State.yaml may be stale — re-run the last phase to update it
