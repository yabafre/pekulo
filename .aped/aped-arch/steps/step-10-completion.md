---
step: 10
reads: 
  - ".aped/skills/aped-skills/checklist-arch.md"
writes: 
  - "state.yaml#pipeline.phases.arch"
mutates_state: true
---

# Step 10: Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring complete, Read `.aped/skills/aped-skills/checklist-arch.md` fresh and verify every item
- 🚫 Do NOT auto-chain `aped-epics` — the user decides

## CONTEXT BOUNDARIES

- Architecture finalised; state advanced to `done`.

## YOUR TASK

Walk the completion-gate checklist, surface the next-step message.

## NEXT-STEP MESSAGE

> Architecture is ready. Run `aped-epics` to create the epic structure.

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-arch.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## ITEMS THE GATE TYPICALLY CATCHES

- An ADR path that points at a file that wasn't actually written.
- `councils_dispatched: [{ verdict: null }]` — Council ran but verdict wasn't recorded.
- A FR/NFR mentioned in Phase 1 that doesn't appear anywhere in Phase 2/3/4.

## SUCCESS METRICS

✅ Next-step message surfaced.
✅ Checklist Read fresh; every item `[x]`.

## FAILURE MODES

❌ Auto-chaining `aped-epics` — user decides.
❌ Skipping the fresh Read — defeats the purpose.

## DONE

Once every checklist item is `[x]`, the skill is complete.
