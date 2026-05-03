---
step: 1
reads:
  - "docs/state.yaml"
writes:
  - "tasks"
mutates_state: false
---

# Step 1: Initialization & State Check

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `pipeline.phases.epics.status` is `done`, ask user: redo or skip?
- 📖 ALWAYS read the complete step file before acting

## CONTEXT BOUNDARIES

- This is the first step of `aped-epics`.
- The PRD already exists (verified in step 02).

## YOUR TASK

Check pipeline state, set up task tracking, decide whether to proceed.

## STATE CHECK

Read `docs/state.yaml`:

- If `pipeline.phases.epics.status` is `done` → ask the user: *"Epics already exist. Redo (rewrite epics.md and re-sync tickets) or skip (continue with current epics.md)?"* If skip, STOP.
- Else → continue.

## TASK TRACKING

Create one task per major phase:

- "Extract FRs and NFRs from PRD"
- "Design epics (user-value grouping)"
- "Define story list per epic"
- "FR coverage validation"
- "Spec-reviewer dispatch"
- "User A/P/C gate"
- "Write epics.md + state.yaml"
- "Ticket System Setup (if ticket_system != none)"

## SUCCESS METRICS

✅ State checked; redo/skip decision recorded.
✅ Task tracking initialized.

## FAILURE MODES

❌ Silently overwriting existing epics.md without asking the user.
❌ Skipping the state check — produces duplicate epics for already-done planning.

## NEXT STEP

Load `.aped/aped-epics/steps/step-02-input-discovery.md`.
