---
name: aped-discuss-epic
keep-coding-instructions: true
description: 'Use when user says "discuss epic", "discuss epic N", "lock decisions for epic", "epic implementation decisions", "SPIDR for epic", "what should we decide for this epic", or invokes aped-discuss-epic. Locks per-epic implementation decisions BEFORE aped-story spawns story files — fills the gap between aped-arch (system-level) and aped-story (per-story). Not for system-wide design (use aped-arch) or per-story plan (use aped-story).'
allowed-tools: "Read Write Bash Grep Glob Agent"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.14.0
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# aped-discuss-epic — Lock per-epic implementation decisions

## Purpose

Between `aped-arch` (system-level: framework, DB, auth, infra) and `aped-story` (per-story: files, tasks, AC quoting) lies the **epic level** — decisions that cut across the 3–8 stories of one epic and would otherwise be re-derived (and drift) at each story start. Examples: how errors propagate across the stories of Epic 3; what data shape the frontend stories of Epic 4 consume; which layouts the onboarding stories of Epic 2 share.

This skill is optional. The pipeline runs without it. Invoke it when an epic has cross-cutting decisions worth locking before any of its stories begin.

## Iron Laws

See [`ETHOS.md` § aped-discuss-epic](../ETHOS.md#aped-discuss-epic) — three laws: decisions are concrete; SPIDR walks all five axes (even when empty); the skill runs BEFORE `aped-story` for the targeted epic.

## Pipeline

### Step 1: Identify the epic and read upstream artefacts

1. Parse the user's invocation for an epic number (`discuss epic 3`, `lock decisions for epic 2`). If absent, ask once.
2. Read in this order:
   - `docs/prd.md` — FRs covered by this epic.
   - `docs/architecture.md` — system-level decisions already locked.
   - `docs/epics.md` — the epic's stated scope, the stories it lists, the FR coverage map.
   - `docs/epics-context/epic-{N}-context.md` — REQUIRED. If missing, HALT and tell the user to invoke `aped-story` once first (it produces this cache) before running `aped-discuss-epic`.
   - Any sibling epics' `epic-{M}-context.md` with a `## Implementation decisions` section — borrow precedents, do not contradict without explicit override.

### Step 2: Walk the SPIDR checklist

For each axis, produce ONE decision (or `N/A — <reason>`). Empty axes are explicit, never skipped.

- **Spike:** what is unknown enough about this epic to warrant a 30-minute experiment before committing the stories? (Spike outputs land in `docs/aped/spikes/`, not in production code.)
- **Paths:** which UI routes, API endpoints, or CLI verbs does this epic touch? Lock the canonical paths so stories don't drift on naming.
- **Interfaces:** what contracts cross story boundaries inside this epic? Function signatures, data shapes, event names, error types.
- **Data:** what data is read or written? Schemas, persistence (optimistic vs pessimistic), cache keys, invalidation rules.
- **Rules:** what invariants must hold across every story of this epic? Error propagation policy, retry semantics, idempotency, permissions, audit trail.

### Step 3: Rank decisions by cross-cutting weight

For each decision, ask: "if a story re-derives this from scratch, does it have a >20% chance of picking a different answer?" If yes, lock it explicitly. If no, drop it — the epic plan already covers it.

Aim for 3–7 decision bullets total. More than 7 means the epic should probably be split (see `aped-iterate`).

### Step 4: Spec-reviewer dispatch

After self-review, dispatch a fresh subagent to verify the decisions are concrete (not aspirational) and consistent with the architecture.

Use the `Agent` tool (`subagent_type: "general-purpose"`) with this verbatim prompt (substitute `[DECISIONS_BLOCK]` with the drafted markdown):

```
You are a spec document reviewer. Verify these epic-level implementation decisions are ready to bind every story of the epic.

**Decisions block to review:**
[DECISIONS_BLOCK]

**Architecture context (for consistency check):** [paste relevant arch sections]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Concrete | Each decision names a path, type, or shape — not a goal ("we will be consistent"). |
| Consistent | No contradictions with `architecture.md` decisions. |
| Cross-cutting | Each decision actually affects >=2 stories in the epic. |
| Bounded | 3–7 total. Anything beyond is either over-locking or signals the epic needs splitting. |
| SPIDR | Each of Spike / Paths / Interfaces / Data / Rules has either a decision or an explicit `N/A — reason`. |

## Output Format

## Spec Review

**Status:** Approved | Issues Found

**Issues (if any):**
- [Axis X]: [specific issue] — [why it matters for the stories of this epic]

**Recommendations (advisory):**
- [suggestions]
```

When the reviewer returns:
- **Approved** — proceed to step 5. Surface recommendations (advisory) but do not block.
- **Issues Found** — fix flagged issues inline (or `[O]verride` with a recorded reason), then re-dispatch ONCE. If the second pass still flags issues, HALT and present them to the user for adjudication.

### Step 5: Append to the epic-context cache

Open `docs/epics-context/epic-{N}-context.md`.

If `## Implementation decisions` already exists, confirm with the user: `[A] Append a second dated block` / `[R] Replace the existing block` / `[C] Cancel`.

Append (or replace) the section after `## Lessons applicable` and before `## Previous stories — outcomes`:

```markdown
## Implementation decisions

**Date:** YYYY-MM-DD
**Decided across stories:** {story-key-1}, {story-key-2}, ...

- **Spike:** {decision or "N/A — <reason>"}
- **Paths:** {decision}
- **Interfaces:** {decision}
- **Data:** {decision}
- **Rules:** {decision}

- {additional cross-cutting bullets, max 2-3}
```

Run `bash .aped/scripts/validate-epic-context.sh docs/epics-context/epic-{N}-context.md`. WARN-only — surface but do not block.

## Stop Conditions

- All 5 SPIDR axes addressed → spec-reviewer Approved → block appended → DONE.
- User says "enough" → write what you have → DONE.
- Epic-context cache missing → HALT, tell the user to invoke `aped-story` once first → STOP.
