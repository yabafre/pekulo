---
name: aped-status
description: 'Shows sprint status dashboard with progress, blockers, and next actions. Use when user says "sprint status", "show progress", "aped status", or invokes /aped-status.'
allowed-tools: "Read Grep Glob Bash"
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Status — Sprint Dashboard

Live dashboard for the pipeline and parallel sprint. Read-only — never writes, never changes status.

## Setup

1. Read `.aped/config.yaml` — extract `communication_language`, `ticket_system`, `git_provider`
2. Read `docs/state.yaml` — pipeline + sprint state (active_epic, parallel_limit, review_limit, stories with their `status`, `worktree`, `depends_on`, `ticket`)
3. Read `.aped/aped-status/references/status-format.md` for display conventions
4. Probe optional tooling once: `command -v workmux >/dev/null` — if available, surface a "Live agents: `workmux dashboard`" hint in the header so the user knows where the fuller TUI view is.

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
- If a `package.json` with a `test` script is present and the last test log is fresh (< 10 min old), report cached test status; otherwise mark `tests: unknown` (don't re-run tests from /aped-status)
- Ticket status via `gh`/`glab`/linear as per `ticket_system`

For stories in `review`, also show:
```
  Review: 5 findings (HIGH×2, MEDIUM×2, LOW×1) · specialists: Eva, Marcus, Rex, Diego
```

Read these from the story file's Review Record (no live specialist spawning here).

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

If non-empty, add a hint: "Run `/aped-lead` to batch-process these."

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

For each story with a ticket, compare local status to remote:

| Local | Remote expected |
|-------|-----------------|
| pending / ready-for-dev | Backlog / Todo |
| in-progress | In Progress |
| review-queued / review | In Review |
| done | Done |

If divergent, surface: `⚠ 1-2 local=in-progress, ticket=Done — investigate`. Do not fix automatically.

## 8. Suggested Next Actions

Pick the most useful next step:

- If `parallel < parallel_limit` AND `ready_to_dispatch` non-empty → "Run `/aped-sprint` to dispatch `{N}` more stories."
- If stories in `review` AND `reviews < review_limit` → "Run `/aped-review {key}` in its worktree."
- If stories queued AND capacity available → "A slot is free. Re-run `/aped-review` on the queued story."
- If everything done in active epic → "Epic `{N}` complete. Set `sprint.active_epic` to the next epic and re-run `/aped-sprint`."
- If pipeline not yet at sprint phase → show the phase-appropriate suggestion (`/aped-analyze`, `/aped-prd`, ...).

## Output

Display only — no writes, no state changes. Suggest commands but never run them.

## Classic Mode (no parallel sprint)

If `sprint.active_epic` is `null` or no story has a `worktree` field set, fall back to the simpler pre-parallel display:

```
Epic 1: User Auth        [████████░░] 80% (4/5)
Next: /aped-dev (story 1-5-session-mgmt is ready-for-dev)
```

## Common Issues

- **State file not found**: Ensure `docs/state.yaml` exists — run /aped-analyze first
- **Stories show wrong status**: State.yaml may be stale — re-run the last phase to update it
