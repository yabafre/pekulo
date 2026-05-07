---
step: 7
reads:
  - "src/**"
  - "tests/**"
writes:
  - "src/**"
  - "tests/**"
  - "git/commits"
  - ".aped/.last-test-exit"
mutates_state: false
---

# Step 7: Phase 5 — Fix + Regression Test (with 3-failed-fixes rule)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Write the regression test BEFORE the fix — IF a correct seam exists
- 🛑 If no correct seam exists, that itself is the finding (handoff to `aped-arch-audit` in step 08)
- 🛑 3-failed-fixes rule fires here — STOP after 3 failed attempts

## YOUR TASK

Write the regression test, apply the smallest fix that addresses the cause statement, validate via the loop, add defense-in-depth.

## CORRECT SEAM CHECK

A correct seam exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that can't replicate the chain that triggered the bug), a regression test there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it. The codebase architecture is preventing the bug from being locked down. Flag this for step 08 handoff to `aped-arch-audit`.

## SEQUENCE (when a correct seam exists)

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail (RED) for the right reason.
3. Apply the fix — the smallest change that addresses the cause statement from step 06. Resist the temptation to refactor surrounding code.
4. Watch it pass (GREEN).
5. Re-run the step 03 feedback loop against the original (un-minimised) scenario.
6. Run the surrounding test suite; no other failures.

## SUB-DISCIPLINE — DEFENSE-IN-DEPTH

When you fix a bug caused by invalid data, validating at one place feels sufficient — but a single check is bypassed by different code paths, refactoring, or mocks. **Validate at every layer the data passes through. Make the bug structurally impossible.**

Four layers:

1. **Entry-point validation** — reject obviously invalid input at the API boundary. Throw with a specific error.
2. **Business-logic validation** — ensure data makes sense for this operation. Defends against internal callers that bypass Layer 1.
3. **Environment guards** — refuse dangerous operations in specific contexts (e.g. `git init` outside a temp dir during tests).
4. **Debug instrumentation** — capture context (stack trace + cwd + env + parameters) before the dangerous operation, not after it fails. Forensics for when the other three layers miss the case.

⏸ **GATE: each of the four layers is added or explicitly N/A with a one-line justification before declaring resolved.**

## 3-FAILED-FIXES RULE (cross-skill)

If three successive attempts have not turned the original repro green — the test is still red, a different test broke, or the fix didn't survive a re-run — **STOP**.

Three failed attempts means **your model of the cause is wrong**. Not "I need a smarter fix #4". The architecture, the spec, the test itself, or the assumption you're operating under is the suspect.

When this rule fires:

1. Write down the three attempts and what each produced (one line each).
2. State the assumption each attempt shared.
3. Surface to the user: *"I have tried three fixes on this failure and none has moved it forward. They share the assumption that &lt;X&gt;. Is that assumption right? Should we look at &lt;architectural alternative&gt; instead?"*
4. ⏸ **HALT** until the user agrees on a new direction.

This rule is the empirical observation that beyond 3 attempts the marginal cost of the 4th vastly exceeds the cost of stepping back.

## NEXT STEP

Load `.aped/aped-debug/steps/step-08-cleanup-and-postmortem.md`.
