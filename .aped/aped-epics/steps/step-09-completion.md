---
step: 9
reads:
  - ".aped/skills/aped-skills/checklist-epics.md"
writes: []
mutates_state: false
---

# Step 9: Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-epics.md` and verify every item
- 🚫 Do NOT auto-chain `aped-story` — the user decides

## CONTEXT BOUNDARIES

- `epics.md` written.
- `state.yaml` updated (with or without ticket_sync block).
- Sync log closed (or skipped path recorded).

## YOUR TASK

Walk the completion-gate checklist, then surface the next-step message to the user.

## NEXT-STEP MESSAGE

> Epics structure is ready. Run `aped-story` to create the first story file, then `aped-dev` to implement it.

**Do NOT auto-chain.** The user decides when to proceed.

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-epics.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, you are NOT done — return to the relevant step.

## ITEMS THE GATE TYPICALLY CATCHES

- An FR not appearing in any story's `Covered FRs` list (validation should have caught it, but the gate re-checks).
- A story without a `**Depends on:**` line (breaks `aped-sprint`).
- `state.yaml.ticket_sync` block written but with `synced_at` missing (audit trail incomplete).
- `phases.epics.fr_coverage` shows e.g. `76/77` without a descope note explaining the missing one.

## SUCCESS METRICS

✅ Next-step message surfaced.
✅ Checklist Read fresh; every item `[x]`.

## FAILURE MODES

❌ Auto-chaining `aped-story` — the user decides.
❌ Skipping the fresh Read — relying on memory defeats the purpose.

## DONE

Once every checklist item is `[x]`, the skill is complete.
