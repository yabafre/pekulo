---
step: 7
reads: 
  - ".aped/templates/epics.md"
writes: 
  - "docs/epics.md"
  - "state.yaml#pipeline.phases.epics"
mutates_state: true
---

# Step 7: Write Output (epics.md + state.yaml)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 ONLY write after validation + self-review + spec-reviewer pass
- 🚫 Do NOT create `docs/stories/` files — that's `aped-story`'s job

## CONTEXT BOUNDARIES

- Validation passed.
- Spec-reviewer Approved.
- User confirmed the structure with `[C]`.

## YOUR TASK

Write `epics.md` and update state.yaml. Do NOT seed tickets here — that's step 08.

## WRITE epics.md

Write the final `docs/epics.md` with:

- Epic header per epic.
- Story list per epic with all the fields from step 04 (key, title, summary, FRs covered, ACs, complexity, depends_on).
- Final FR Coverage Map.
- File structure design summary from step 03.

Every story entry MUST include a `**Depends on:**` line (with `none` if no deps). Required for `aped-sprint`.

## SCHEMA VALIDATION (WARN-only in 6.3.0)

Immediately after the write, run `bash .aped/scripts/validate-epics.sh docs/epics.md`. On non-zero, present the validator's stderr verbatim, advise the user to re-run aped-epics (or hand-edit the missing structural pieces — typically `## FR Coverage Map`), and **do NOT advance state.yaml below**. If the validator script is absent (non-scaffolded scaffold), warn-once and proceed — same graceful pattern as ajv-cli skip in `validate-state.sh`. Escalates to ERROR in 7.0.0.

## STATE.YAML UPDATE

**Prefer MCP**: `aped_state.advance(phase: "epics", status: "complete")`.

**Fallback** (MCP unavailable): edit `docs/state.yaml` directly:

- Set `current_phase: "sprint"` — marks the transition from planning to execution.
- Set `sprint.active_epic` to the epic the user wants to start with (usually `1`).
- Add `phases.epics` with status `done` and output path.
- Add `sprint.stories` — one entry per story:

  ```yaml
  sprint:
    stories:
      1-1-project-setup:
        status: pending
        depends_on: []
        ticket: null   # filled by step 08 if ticket_system != none
        worktree: null
  ```

- `"sprint"` covers the entire story → dev → review cycle — no further phase changes needed until ship.

## SUCCESS METRICS

✅ `epics.md` written with all sections + final FR Coverage Map.
✅ Every story entry has `**Depends on:**` (even if `none`).
✅ `state.yaml` updated (MCP or fallback).
✅ NO files created under `docs/stories/`.

## FAILURE MODES

❌ Writing before validation passes — propagates broken epics.
❌ Forgetting `**Depends on:**` — `aped-sprint` can't compute the DAG.
❌ Creating story files here — duplicates `aped-story`'s mandate.

## NEXT STEP

Load `.aped/aped-epics/steps/step-08-ticket-sync.md` to seed the configured ticket system (if any) with sync-log auditability.
