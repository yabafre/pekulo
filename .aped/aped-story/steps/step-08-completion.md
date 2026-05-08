---
step: 8
reads:
  - ".aped/skills/aped-skills/checklist-story.md"
writes: []
mutates_state: false
---

# Step 8: Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-story.md` and verify every item
- 🚫 Do NOT skip this step
- ❌ FORBIDDEN to declare DONE if any checklist item is unchecked

## CONTEXT BOUNDARIES

- Story file written, linted, branch confirmed.
- Solo mode: user told to run `aped-dev`. Worktree mode: `story-ready` posted.
- All earlier steps' success metrics passed.

## YOUR TASK

Walk the completion-gate checklist file. The checklist is the anti-rationalization gate: every gate criterion is re-injected into context at the moment attention is lowest — right before declaring DONE.

## SEQUENCE

1. **Read the checklist file fresh**:

   ```
   Read(.aped/skills/aped-skills/checklist-story.md)
   ```

   Don't trust your memory of it from earlier in the session.

2. **Walk every item**. For each `- [ ]`:
   - If satisfied: flip to `- [x]` mentally and move on.
   - If unsatisfied: STOP and fix. The gate exists exactly to catch the items the rest of the skill normalised away.

3. **If any item is unchecked**, you are NOT done. Return to the relevant step and complete the missing work. Then re-walk this gate.

## EXAMPLES OF ITEMS THE GATE TYPICALLY CATCHES

- Step-0 quote silently skipped because "the file looked simple".
- A task with "..." inside the code block that lint missed.
- `state.yaml` flipped to `ready-for-dev` while the story file is still on disk but uncommitted in worktree mode.
- The branch check passed but the story file's `**Branch:**` field shows a different name (e.g. user previously had a typo).

## SUCCESS METRICS

✅ Checklist file read fresh in this step.
✅ Every item flipped to `[x]` (no silent passes).
✅ Output message from step 07 already shown to the user.

## FAILURE MODES

❌ Treating the gate as redundant ("I already checked these in step 06").
❌ Declaring DONE while the worktree-mode commit hasn't landed.
❌ Skipping the fresh Read — relying on cached memory of the checklist defeats the purpose.

## DONE

Once every item is `[x]`, the skill is complete. Do NOT auto-chain `aped-dev` — the user / Lead controls the handoff. Update the top-level task to `completed`.
