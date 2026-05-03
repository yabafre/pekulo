---
step: 7
reads:
  - ".aped/.last-test-exit"
  - "docs/stories/{story-key}.md"
  - "git/diff"
writes: []
mutates_state: false
---

# Step 7: Verification Gate (run before Completion)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The Iron Law for marking the story `review` is *no completion claim without fresh evidence in this message*
- 🛑 If none of the 3 evidence forms is captured, HALT and re-run
- 🚫 Forbidden phrases alone are NOT evidence

## CONTEXT BOUNDARIES

- All story tasks have passed their GATE.
- Local commits exist on the feature branch.
- Story status in `state.yaml` is still `in-progress`.

## YOUR TASK

Walk the verification gate. The Iron Law for `aped-dev` is *NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST*; the Iron Law for marking the story `review` is *no completion claim without fresh evidence in this message*. This step operationalises that.

## FORBIDDEN PHRASES

These words alone are not evidence. If you wrote them in this message and the message contains no captured tool output below, you have NOT verified anything.

- `should work`
- `looks good`
- `probably fine`
- `tests should pass`
- `should be ok`
- `Done!`
- `Great!`
- `Perfect!`
- `All set`

If your draft message contains any of these without accompanying tool output, the gate fails.

## ACCEPTED EVIDENCE FORMS

At least one MUST appear in this message before you mark the story `review`:

1. **Captured command output** — copy of the test runner's output ending with the pass line (`PASS`, `OK`, `✓`, `N tests passed`, exit code `0`).
2. **Diff with test output** — short diff of the change paired with the test output that exercises the change.
3. **Screenshot reference** — for frontend visual changes, an explicit reference to a React Grab visual check or screenshot path captured this session.

If none of the three is present, **HALT** and re-run the verification, capturing the output here. Do not mark the story `review` on confidence.

## SEQUENCE

1. **Re-run the full test suite** for the story:

   ```bash
   bash .aped/aped-dev/scripts/run-tests.sh
   ```

   Capture the output verbatim in this message.

2. **Check the working tree is clean**:

   ```bash
   git status --porcelain
   ```

   Empty output expected — every change should be committed (one commit per task, per step 06).

3. **Check git log shows expected commits**:

   ```bash
   git log --oneline {feature-branch} ^{base-branch} | head
   ```

   One commit per story task is the target.

4. **Confirm the AC-to-test trace**:

   For each AC in the story, find at least one test whose verbatim quote (per step 06's spec-quote rule) cites that AC. If any AC has zero tests, return to step 06 — the story is incomplete.

## SUCCESS METRICS

✅ Test suite re-ran with output captured in this message.
✅ Working tree clean.
✅ Commits per task visible in git log.
✅ Every AC has a citing test.

## FAILURE MODES

❌ Marking `review` while a forbidden phrase appears alone in the message.
❌ Treating the dev session's earlier test runs as "still valid" — the verification gate requires *fresh* evidence in *this* message.
❌ Skipping the AC-to-test trace — partial coverage gets discovered at review time, costing a round trip.

## NEXT STEP

Load `.aped/aped-dev/steps/step-08-completion.md` to update story file, state.yaml, and post the dev-done check-in.
