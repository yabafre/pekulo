---
step: 1
reads:
  - "docs/state.yaml"
  - ".aped/aped-ux/references/ux-patterns.md"
writes:
  - "tasks"
mutates_state: false
---

# Step 1: Initialization & State Check

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `pipeline.phases.ux.status: done`, ask user: redo or skip?

## YOUR TASK

Check pipeline state, set up task tracking.

## STATE CHECK

Read `docs/state.yaml`:

- `pipeline.phases.ux.status: done` → ask *"UX exists. Redo or skip?"* If skip, STOP.
- Else → continue.

Read `.aped/aped-ux/references/ux-patterns.md` for the design patterns catalog (loaded once; referenced by every step downstream).

## TASK TRACKING

```
TaskCreate: "A — Assemble: collect design DNA"
TaskCreate: "A — Assemble: scaffold Vite + React preview app"
TaskCreate: "N — Normalize: build layout + navigation + design tokens"
TaskCreate: "N — Normalize: implement screens with real PRD content"
TaskCreate: "F — Fill: complete all states (loading, error, empty)"
TaskCreate: "F — Fill: responsive + accessibility pass"
TaskCreate: "F — Fill: user review + validation"
```

## NEXT STEP

Load `.aped/aped-ux/steps/step-02-input-discovery.md`.
