---
step: 12
reads:
  - ".aped/skills/aped-skills/checklist-review.md"
writes: []
mutates_state: false
---

# Step 12: Check-in & Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-review.md` and verify every item
- 🚫 Do NOT skip the completion gate
- ❌ Do NOT auto-chain `aped-story` — the user / Lead controls the handoff

## CONTEXT BOUNDARIES

- Remote updated, story file has Review Record, state advanced (step 11).
- All commits are on the feature branch.
- Story is either `done` or stays `review`.

## YOUR TASK

Post the parallel-sprint check-in if applicable, then walk the completion-gate checklist before declaring this skill done.

## CHECK-IN — PARALLEL SPRINT MODE

If this session is a Story Leader (`.aped/WORKTREE` exists OR the worktree path is registered in `sprint.stories.{key}`) AND the story just flipped to `done`, post a `review-done` check-in so the Lead can verify and recommend cleanup:

```bash
bash ${project_root}/.aped/scripts/checkin.sh post {story-key} review-done
```

No HALT — the story is finished. The Lead picks up the check-in and tells the user what to do next (typically `workmux merge` inside this window, or the scripted fallback).

If the story stayed `review`, do NOT post a check-in — the user stays in control and will re-invoke `aped-review` after fixing.

## NEXT-STEP MESSAGING

If story → `done`:

- **Parallel mode:** *"`review-done` check-in posted. Wait for `aped-lead` to confirm cleanup instructions."*
- **Classic mode:** *"Run `aped-story` to prepare the next story."*
- **Sprint complete:** report completion.

If story stays `review`:

- *"Fix the remaining findings, then re-run `aped-review`."*

**Do NOT auto-chain.** The user (or the Lead in parallel mode) decides when to proceed.

## COMPLETION GATE

1. **Read the checklist file fresh:**

   ```
   Read(.aped/skills/aped-skills/checklist-review.md)
   ```

   Don't trust your memory of it from earlier in the session.

2. **Walk every item.** For each `- [ ]`:
   - If satisfied: flip to `- [x]` mentally and move on.
   - If unsatisfied: STOP and fix. The gate exists exactly to catch the items the rest of the skill normalised away.

3. **If any item is unchecked**, you are NOT done. Return to the relevant step.

## ITEMS THE GATE TYPICALLY CATCHES (illustrative)

- A finding presented to the user without a captured test re-run for that specific change.
- The story file's Review Record missing a dismissed-finding rationale.
- State updated to `done` while the worktree still has uncommitted fix changes.
- The PR opened against `main` instead of the sprint umbrella branch.
- A separate review file silently created at `docs/reviews/...` (THE bug v6.0.0 fixed).

## SUCCESS METRICS

✅ Worktree mode + story → `done`: `review-done` check-in posted.
✅ Next-step message matches the mode + verdict.
✅ Completion-gate checklist Read fresh; every item `[x]`.
✅ NO auto-chain to `aped-story`.

## FAILURE MODES

❌ Auto-chaining `aped-story` — user / Lead controls handoff.
❌ Skipping the fresh Read of the checklist — relying on memory defeats the purpose.
❌ Posting `review-done` while findings remain unresolved.

## DONE

Once every checklist item is `[x]`, the skill is complete. Update the top-level `aped-review` task to `completed`.
