---
name: aped-course
keep-coding-instructions: true
description: 'Use when user says "correct course", "change scope", "pivot", "aped correct", or invokes aped-course.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "[description of the change]"
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.14.0
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Correct Course — Managed Pivot

Use when requirements change, priorities shift, or the current approach needs rethinking mid-pipeline. During a parallel sprint this is the **only** way to modify upstream docs (PRD, architecture, UX) — the `upstream-lock` hook blocks all other attempts.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in EVERY message to the user — progress lines, tool preambles, summaries, and questions all included. This overrides your default; never narrate in English when `{communication_language}` is not English.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Setup

1. **Validate state integrity:** run `bash .aped/scripts/validate-state.sh`. Non-zero → HALT with the reported error. Corrupt state makes the "scope_change_active" toggle dangerous.
2. **Stuck-lock detection.** If `scope_change_active: true` is already set in `state.yaml` when this skill starts, a previous `aped-course` session crashed before clearing it — every subsequent scope-change attempt would then refuse to proceed. Check how old the flag is: compute `now - stat_mtime(docs/state.yaml)`. If the mtime is > 2 hours (7200s), auto-clear the stale flag with `bash .aped/scripts/sync-state.sh` (command: `set-scope-change false`) and warn the user: "Stale scope_change_active cleared from a previous crashed aped-course run (state.yaml was last touched {X}h ago). Verify no partial PRD/architecture/UX edits were left behind before starting the new scope change." If the mtime is < 2h, HALT and tell the user another scope-change session may still be active — they can either wait for it, or manually reset via `bash .aped/scripts/sync-state.sh` + the `set-scope-change false` stdin command.
3. Read `docs/state.yaml` — understand current pipeline state
4. Read existing artifacts: brief, PRD, epics, stories
5. Read `.aped/aped-course/references/scope-change-guide.md` for impact matrix and process

## Active-Worktree Check (parallel sprint awareness)

Before touching any artifact, identify stories whose `status` is in `{in-progress, review-queued, review}` AND that have a non-null `worktree` — these are the sessions that will be impacted.

Source of truth: `state.yaml`. Cross-check: if `command -v workmux` succeeds, also run `workmux list --format json` (or the plain `workmux list` if json isn't supported) to confirm each state.yaml worktree is actually open. If a worktree is in state.yaml but workmux doesn't know about it, the session was likely closed without marking the story `done` — flag it to the user as a stale entry and ask whether to drop the `worktree` field.

If any exist:
1. List them to the user with their branches + tickets.
2. ⏸ **GATE:** "Continuing will invalidate epic context caches used by those worktrees. Proceed?"
3. On confirmation, post a notification comment on each active ticket (via `gh`/`glab`/linear per `ticket_system`). Read `.aped/aped-skills/writing-discipline.md` first — short, sharp, no padding:
   > "APED scope change in progress. Please pause your next commit until the update lands. A follow-up comment will confirm when it's safe to refresh your epic context and continue."
4. Write `sprint.scope_change_active: true` in state.yaml (atomic — use `.aped/scripts/sync-state.sh set-scope-change true` if present, else direct edit under flock).

If no active worktrees: skip this section entirely.

## Impact Assessment

Ask the user:
1. **What changed?** — New requirement, removed feature, architectural pivot, priority shift
2. **Why?** — User feedback, market shift, technical limitation, stakeholder decision

Then analyze impact:

### Scope Change Matrix

| What changed | Artifacts affected | Action required |
|---|---|---|
| New feature added | PRD, Epics | Add FRs → create new stories |
| Feature removed | PRD, Epics | Remove FRs → archive stories |
| Architecture change | PRD NFRs, All stories | Update NFRs → review all Dev Notes |
| Priority reorder | Epics, Sprint | Reorder stories → update sprint |
| Complete pivot | Everything | Reset to aped-analyze |

## Open the sync log (when scope change touches tickets)

If the impact assessment shows the scope change will modify, move, or descope tickets in the configured ticket system (read `ticket_system` from `.aped/config.yaml`), open a sync log before any provider call. Skip this step entirely when `ticket_system: none` or the change is purely doc-side (e.g. a typo fix in the PRD that doesn't touch tickets).

```bash
LOG=$(bash .aped/scripts/sync-log.sh start <provider>)
```

Reuse `$LOG` across all subsequent ticket operations. If `sync_logs.enabled: false`, calls are silent no-ops; that's expected.

### Record course-correction context (top-level meta)

Right after `start`, record the human-readable context of this scope change as top-level meta keys (peer to `phases`/`totals`). The `meta` subcommand is the helper-blessed way to add structured top-level extensions; it rejects reserved keys (`sync_id`, `provider`, `started_at`, `ended_at`, `operator`, `directive_version`, `phases`, `totals`) so the audit trail's spine stays intact.

```bash
bash .aped/scripts/sync-log.sh meta $LOG trigger '"<one-liner: why this change happened>"'
bash .aped/scripts/sync-log.sh meta $LOG scope '{"stories_descoped":["..."],"decisions_amended":["..."]}'
# Optional, when the change absorbs an external PR:
# bash .aped/scripts/sync-log.sh meta $LOG source_pr '"https://github.com/owner/repo/pull/123"'
# bash .aped/scripts/sync-log.sh meta $LOG merged_at '"2026-04-29T09:46:44Z"'
```

Values must be valid JSON — strings need outer double-quotes, objects use the literal JSON form. Keys must be snake_case identifiers.

## Change Execution

### Minor change (new/removed feature)
1. Update PRD: add/remove FRs, update scope
2. Re-run validation: `bash .aped/aped-prd/scripts/validate-prd.sh docs/prd.md`
3. Update epics: add/archive affected stories
4. Re-run coverage: `bash .aped/aped-epics/scripts/validate-coverage.sh docs/epics.md docs/prd.md`
5. Update `docs/state.yaml`: mark affected stories as `backlog`

After modifying ticket fields (titles, descriptions, labels, ACs):

```bash
bash .aped/scripts/sync-log.sh phase $LOG tickets_modified complete '{"calls":M,"modifications":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total M
```

After moving tickets between projects / milestones (e.g. mid-sprint reassignment):

```bash
bash .aped/scripts/sync-log.sh phase $LOG tickets_moved complete '{"calls":V,"moves":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total V
```

If any tickets are descoped to future-scope (M2):

```bash
bash .aped/scripts/sync-log.sh phase $LOG descope_recorded complete '{"calls":D,"tickets":[...]}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total D
```

Close the log when ticket operations are complete:

```bash
bash .aped/scripts/sync-log.sh end $LOG
```

### Major change (architecture/pivot)
1. Confirm with user: "This invalidates in-progress work. Proceed?"
2. Archive current artifacts to `docs/archive/{date}/`
3. Update PRD or restart from `aped-analyze`
4. Regenerate affected downstream artifacts

## Story Impact Report

For each in-progress or completed story:
- **Safe**: story not affected by change
- **Needs update**: story Dev Notes or ACs need modification
- **Invalidated**: story no longer relevant — archive it

## State Update

Update `docs/state.yaml`:
- Reset affected stories to `backlog` or `ready-for-dev`
- If major change: reset `current_phase` to appropriate earlier phase

### Append a `corrections` entry (always)

`corrections` is the append-only log of mid-sprint scope changes, distinct from `lessons.md` (post-epic retrospectives) and CHANGELOG (product-level). Every `aped-course` run that materially changes scope MUST append one entry.

Schema **v2** (4.1.0+) splits this log out of `state.yaml` into the file referenced by `corrections_pointer` (default tracks `output_path` from config.yaml — for the standard scaffold that's `docs/aped/state-corrections.yaml`; configurable via `state.corrections_path`). The state.yaml mirror `corrections_count` is bumped automatically. Use the helper — it validates the required keys, locks the file, and updates the count atomically:

```bash
bash .aped/scripts/sync-state.sh <<< 'append-correction {"date":"<YYYY-MM-DD>","type":"<major|minor|bug>","reason":"<one-liner>","artifacts_updated":["docs/prd.md","docs/epics.md"],"affected_stories":["<story-key>"]}'
```

Required keys per entry: `date`, `type`, `reason`, `artifacts_updated`, `affected_stories`. Project-specific extras are preserved as-is (forward-compat).

Schema **v1** scaffolds (3.x line, never run through `aped-method --update`) keep the old top-level `corrections:` array on `state.yaml`. `aped-method --update` triggers `migrate-state.sh` which moves the array into the new file and bumps the schema in lock-step. **`append-correction` refuses on v1** (since 4.1.2) — writing the v2 pointer/count alongside the legacy array would orphan the legacy entries and produce a wrong count. On v1, run `bash .aped/scripts/migrate-state.sh` to migrate first, or — if you genuinely cannot migrate yet — append the entry directly to the top-level `corrections:` array via the Edit tool.

### Append to `backlog_future_scope` (when descoping)

If any tickets were descoped to future-scope as part of this change, also append to the top-level `backlog_future_scope.tickets` list. Create the block if missing:

```yaml
backlog_future_scope:
  project_id: "<provider future-scope project id, or null>"
  tickets:
    - { id: "<ticket-id>", category: "<bucket-name>" }
```

Append to existing entries — never replace the whole list.

## Release the Upstream Lock (parallel sprint only)

If you set `scope_change_active: true` at the start, you MUST clear it before handing control back:

1. Invalidate any now-stale epic-context caches — delete `docs/epic-*-context.md` for the affected epic(s) so `aped-dev` recompiles on the next story.
2. Set `sprint.scope_change_active: false` in state.yaml (atomic).
3. Post a follow-up comment on each previously notified ticket:
   > "Scope change applied. If you're in an active worktree, pull the latest `docs/` artefacts and restart your story loop — the epic-context cache has been invalidated."

If you skip step 2, upstream writes remain unlocked — a real security issue, not a cosmetic one. Do not exit the skill with the lock still open.

## Guard Against Scope Creep

After applying changes, verify:
- Total FR count still within 10-80 range
- No epic became too large (>8 stories)
- No story became too large (>8 tasks)
- Changed stories still fit single-session size

## Example

User says "We need to add OAuth — the client changed requirements":
1. Impact: minor change — add FRs to PRD, create new stories
2. Update PRD: add FR-26 to FR-28 for OAuth
3. Re-validate PRD
4. Add stories to Epic 1 for OAuth support
5. Re-validate coverage
6. Reset new stories to `ready-for-dev`

## Self-review (run before exit)

Before clearing the upstream lock and handing control back, walk this checklist. Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Corrections logged** — a new entry was appended via `bash .aped/scripts/sync-state.sh <<< 'append-correction <json>'` (schema v2: writes to the file at `corrections_pointer`, bumps `corrections_count` in state.yaml). On unmigrated v1 scaffolds, the entry lives at top-level `corrections:` in state.yaml directly. Required fields: date, type, reason, artifacts_updated, affected_stories.
- [ ] **Sync log emitted** — if ticket-system operations ran, `docs/sync-logs/<provider>-sync-<ISO>.json` exists (or skipped silently if no ticket changes / `sync_logs.enabled: false`).
- [ ] **Backlog future-scope updated** — if any tickets were descoped, `backlog_future_scope.tickets` was appended (not replaced).
- [ ] **Upstream lock cleared** — `sprint.scope_change_active: false` set, follow-up notification posted on each previously-notified ticket.

## Common Issues

- **User wants to change everything**: Confirm scope — "Is this a pivot or an addition?"
- **Invalidated stories have committed code**: Archive the code changes, don't delete — user may want to reference them
- **FR count exceeds 80 after change**: Some features may need to move to a Growth phase scope
