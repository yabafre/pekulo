---
step: 1
reads:
  - "docs/state.yaml"
writes:
  - "tasks"
mutates_state: false
---

# Step 1: Initialization

## YOUR TASK

Check pipeline state. Set up task tracking.

## STATE CHECK

Read `docs/state.yaml` (the file may not exist yet — `aped-analyze` is the first phase that creates it):

- If file exists and `pipeline.phases.analyze.status: done` → ask user *"Redo analysis or skip to next phase?"* If skip, STOP.
- Else → continue.

## NEXT STEP

Load `.aped/aped-analyze/steps/step-02-input-discovery.md`.
