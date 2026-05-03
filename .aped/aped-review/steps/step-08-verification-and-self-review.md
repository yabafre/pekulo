---
step: 8
reads: []
writes: []
mutates_state: false
---

# Step 8: Verification Gate + Self-Review (run BEFORE presenting the report)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The Iron Law applies: NO PASS WITHOUT FRESH EVIDENCE IN THIS MESSAGE
- 🛑 Each `[ ]` must flip to `[x]` or HALT — no item silently passes
- 🚫 Forbidden phrases alone are NOT evidence

## CONTEXT BOUNDARIES

- Findings merged into a ranked list (step 07).
- The user has not yet seen the report.

## YOUR TASK

Walk the verification gate first; then the self-review checklist. Both must pass before step 09 presents anything to the user.

## VERIFICATION GATE

### Forbidden phrases

These words alone are not evidence. If the report draft contains any of them and the message has no captured tool output below, the gate fails.

- `should work`
- `looks good`
- `probably fine`
- `tests should pass`
- `should be ok`
- `Done!`
- `Great!`
- `Perfect!`
- `All set`

### Accepted evidence forms

At least one MUST appear in this message before presenting the report:

1. **Captured command output** — re-run of the story's test command(s), pass line included.
2. **Diff with test output** — short diff of the story's changes paired with the test output that exercises them.
3. **Screenshot reference** — for frontend stories, an explicit React Grab visual check or screenshot path captured this session.

If none of the three is present, **HALT** and re-run the verification, capturing the output here. Do not present a verdict on confidence. Same gate as `aped-dev` step 07 — same standards either side of the dev/review handoff.

### Sequence

1. Re-run the story's test command (do NOT trust dev's earlier run):

   ```bash
   bash .aped/aped-dev/scripts/run-tests.sh
   ```

2. Capture the output verbatim in this message — pass line included.

3. If the project has a frontend preview app and Aria flagged a visual concern, re-inspect via React Grab and capture the result.

## SELF-REVIEW CHECKLIST

Before presenting the merged report to the user, walk this checklist. Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Minimum 3 findings** — the team produced ≥ 3 findings across all specialists; if not, re-dispatch (return to step 07).
- [ ] **Every finding has evidence** — file:line, command output, or stack trace. No bare *"looks suspicious"*.
- [ ] **Git audit captured** — Rex's audit ran and its output is reflected in the report.
- [ ] **Verification re-run** — the test command(s) for this story were re-run by the lead in this session, output captured. Reports from the dev session do not count.
- [ ] **Two-stage ordering** — Eva ran first (single subagent, synchronous); Marcus, Rex, and conditional specialists were dispatched only after Eva PASS or after the user chose `[O]verride` with a recorded reason.
- [ ] **Stage 1.5 handled** — if `review.parallel_reviewers: true`, the three adversarial reviewers ran in parallel; if degraded mode (1 of 3 fail), noted in the upcoming report.
- [ ] **Testing anti-patterns** — Marcus checked the artefact for the 5 testing anti-patterns (mock-the-behavior, test-only-methods, mock-without-understanding, incomplete-mocks, integration-test-as-afterthought).
- [ ] **No persisted review file mentioned** — the report will be rendered inline in step 09 and appended to the story file's Review Record in step 11. NO separate `docs/reviews/...` file is ever created.

## SUCCESS METRICS

✅ Verification gate passed (one of three evidence forms captured in this message).
✅ Every checklist item flipped to `[x]`.
✅ The merged finding list is ready for user presentation.

## FAILURE MODES

❌ Presenting a report on confidence — ignores the Iron Law.
❌ Treating dev's earlier test runs as "still valid" — the verification gate requires fresh evidence in *this* message.
❌ Marking the no-persisted-review-file box ✓ while still planning to write `docs/reviews/...` — the bug this skill exists to prevent (4.x → 6.0 fix).

## NEXT STEP

Load `.aped/aped-review/steps/step-09-present-report.md` to present the consolidated report to the user.
