---
step: 8
reads:
  - "src/**"
  - "tests/**"
  - "git/diff"
writes:
  - "src/**"
  - "tests/**"
  - "git/commits"
mutates_state: false
---

# Step 8: Phase 6 — Cleanup + Post-Mortem

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Each item below flips to `[x]` or HALT
- 🚫 NEVER ship `[DEBUG-...]` tags — `grep -r "\[DEBUG-" .` returns nothing in the diff

## YOUR TASK

Verify the original repro no longer fails, remove instrumentation, write the post-mortem in the commit message, recommend a handoff if the bug had architectural / process roots.

## CHECKLIST

- [ ] **Original repro no longer reproduces** — re-run the step 03 feedback loop. Capture the output. Output must match the expected (clean) state.
- [ ] **Regression test passes** (or absence of seam is documented as a finding for `aped-arch-audit`).
- [ ] **All `[DEBUG-...]` tags removed** — `grep -r "\[DEBUG-" src/` returns nothing in the diff.
- [ ] **Throwaway prototypes deleted** (or moved to `docs/debug/` with a clearly-marked filename).
- [ ] **Post-mortem in commit message.** The commit body states the hypothesis that turned out correct, in one short paragraph. Future debuggers learn from this — make it findable. Template:

  > *"Cause: {one-line root cause statement, file:line}. Fix: {one-line summary of the change}. Falsified hypotheses: {bullet list of the 2–4 ranked hypotheses from step 05 that turned out wrong, one line each}."*

## WHAT WOULD HAVE PREVENTED THIS BUG?

Ask yourself this *after* the fix is in (you have more information now than when you started):

- **Architectural** (no good test seam, tangled callers, hidden coupling, shallow modules) → recommend `aped-arch-audit` on the affected area. Cite the step 07 finding (*"no correct seam exists for the regression test"*) if applicable.
- **Process** (the bug surfaced too late, the test missed it because of CI gaps, the spec was ambiguous) → recommend `aped-retro` at the next epic boundary; cite the bug as a lesson.
- **Neither** → no handoff needed. The fix is the whole answer.

## NEXT STEP

Load `.aped/aped-debug/steps/step-09-completion.md`.
