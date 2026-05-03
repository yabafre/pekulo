---
step: 1
reads: 
  - ".aped/WORKTREE"
  - "git/HEAD"
  - "state.yaml#pipeline.current_phase"
writes: 
  - "tasks"
mutates_state: false
---

# Step 1: Initialization & Invocation Context

## YOUR TASK

Detect invocation context and prepare. The phases are identical regardless of context; only entry/exit differs.

## INVOCATION CONTEXTS

### Standalone (user-driven)

User invokes `aped-debug` directly with a failure description. Step 03 starts from that description.

### From `aped-dev` (persistent test red)

`aped-dev` HALTed on the 3-failed-fixes rule. Step 03 inherits the failing test as the loop seed; the 3-failed-fixes rule fires immediately and prompts re-examination of architecture / spec / assumption.

### From `aped-review` (root-cause finding)

`aped-review` step 07 routed a finding whose mechanism is unclear. Step 03 takes the finding's repro; the verdict feeds back as evidence appended to the review report.

## RED FLAGS — STOP IF YOU CATCH YOURSELF THINKING THESE

| Phrase | Why it's wrong |
|--------|----------------|
| "The test is flaky, I'll just retry" | Flaky tests have causes; retry hides the cause without removing it. |
| "This works on my machine" | The CI / other-machine difference *is* the bug. Find it. |
| "Let me just adjust the timeout" | Timeouts hide real performance regressions. |
| "It's probably an env thing" | "Probably" is not a diagnosis. Reproduce + hypothesise. |
| "I'll skip Phase 1, the bug is obvious" | The "obvious" cause is the agent's pattern-match. Patterns lie. |

## RATIONALIZATIONS — RECOGNIZE AND REJECT

| Excuse | Reality |
|--------|---------|
| "The fix is obvious, investigation is wasted time" | The "obvious fix" is a pattern-match. Patterns lie. |
| "Tracing 3 levels deep is too slow" | One bad fix costs days. Tracing costs minutes. |
| "Just this once, I'll patch and move on" | "Just this once" compounds. Run the discipline. |

## NEXT STEP

Load `.aped/aped-debug/steps/step-02-discovery.md`.
