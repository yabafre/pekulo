---
step: 1
reads:
  - "docs/state.yaml"
  - ".aped/aped-prd/references/domain-complexity.csv"
  - ".aped/aped-prd/references/project-types.csv"
writes:
  - "tasks"
mutates_state: false
---

# Step 1: Init, Mode Detection, Domain Detection, Task Tracking

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `pipeline.phases.prd.status: done`, ask user: redo or skip?
- 🛑 Detect `--headless` / `-H` flag — default is interactive

## YOUR TASK

State check, mode detection, domain detection, task tracking.

## STATE CHECK

Read `docs/state.yaml`:

- `pipeline.phases.prd.status: done` → ask *"PRD exists. Redo or skip?"* If skip, STOP.
- Else → continue.

## MODE DETECTION

Parse the user's invocation:

- `--headless` / `-H` flag present → **autonomous** generation, no menus, no HALTs.
- Default (no flag) → **interactive section-by-section** with A/P/C menu after each section.

Record the mode for `phases.prd.mode` in step 06.

## DOMAIN & PROJECT TYPE DETECTION

1. Read `.aped/aped-prd/references/domain-complexity.csv`.
   - Match brief content against `signals` column.
   - If match found: note `complexity`, `key_concerns`, `special_sections`.
   - High-complexity domains (healthcare, fintech, govtech, …) → mandatory Domain Requirements section in step 04.

2. Read `.aped/aped-prd/references/project-types.csv`.
   - Match against `detection_signals`.
   - Note `required_sections`, `skip_sections`, `key_questions`.

## TASK TRACKING

```
TaskCreate: "Section 1: Foundation — Executive Summary & Vision"
TaskCreate: "Section 2: Scope & Journeys"
TaskCreate: "Section 3: Domain Requirements (conditional)"
TaskCreate: "Section 4: Functional & Non-Functional Requirements"
TaskCreate: "Validate PRD"
```

Update each to `completed` as the user picks `[C]` Continue on its menu.

## NEXT STEP

Load `.aped/aped-prd/steps/step-02-input-discovery.md`.
