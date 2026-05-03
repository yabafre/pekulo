---
step: 7
reads:
  - ".aped/skills/aped-skills/checklist-brainstorm.md"
writes: []
mutates_state: false
---

# Step 7: Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring complete, Read `.aped/skills/aped-skills/checklist-brainstorm.md` fresh
- 🚫 Do NOT auto-chain — user decides

## YOUR TASK

Walk completion gate. Surface next-step message.

## STATE NOTE

Brainstorm is NOT a formal pipeline phase — it does NOT update `docs/state.yaml`. It's a creative tool usable at any time.

## NEXT-STEP MESSAGE

If brainstorm was a precursor to `aped-analyze`:

> Brainstorm saved at `docs/brainstorm/session-{date}.md`. When you're ready, run `aped-analyze` to turn one of these survivors into a validated product brief.

Otherwise:

> Brainstorm saved. The user decides what to do with the survivors — keep brainstorming, go to `aped-analyze`, or park for later.

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-brainstorm.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## DONE

Once every checklist item is `[x]`, the skill is complete.
