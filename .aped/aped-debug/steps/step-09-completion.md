---
step: 9
reads:
  - ".aped/skills/aped-skills/checklist-debug.md"
  - "git/diff"
writes:
  - "docs/lessons.md"
mutates_state: false
---

# Step 9: Self-Review & Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring complete, Read `.aped/skills/aped-skills/checklist-debug.md` fresh
- 🚫 Do NOT auto-chain — return control per invocation context

## YOUR TASK

Walk the self-review checklist; surface the next-step message based on invocation context; walk the completion gate.

## SELF-REVIEW

Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Step 04 repro re-run** — original failing command was re-run in this session and now passes; the output is captured here.
- [ ] **Regression test exists** (or absence of seam is documented as an `aped-arch-audit` candidate).
- [ ] **Root cause documented** — the step 06 cause statement (`file:line`, condition, behaviour) is recorded in the commit message; if the bug represents a class worth remembering, also append to `docs/lessons.md`.
- [ ] **Post-mortem captured** — commit body names the correct hypothesis + at least one falsified hypothesis.
- [ ] **No unrelated changes** — the diff contains only the fix and its regression test. No drive-by refactors, no formatting churn.
- [ ] **`[DEBUG-*]` tags removed** — `grep -r "\[DEBUG-" .` returns nothing.
- [ ] **Lint clean** — if the debug session produced a notes file (e.g. `docs/debug/<bug>-{date}.md`), run `bash .aped/scripts/lint-placeholders.sh <notes-file>`.

## NEXT-STEP MESSAGING

After step 08 verifies, return control:

- **Standalone** → tell the user: *"Bug fixed. Cause + falsified hypotheses captured in the commit message. {{handoff recommendation if any: 'Recommend aped-arch-audit on <area>' or 'Recommend aped-retro at the next epic boundary'}}."*
- **From `aped-dev`** → resume the next TDD task (the 3-failed-fixes rule may have re-cleared the assumption that was blocking).
- **From `aped-review`** → append the step 06 cause statement to the review report as Eva's / Marcus's evidence; resume the review.

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-debug.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## DONE

Once every checklist item is `[x]`, the skill is complete.
