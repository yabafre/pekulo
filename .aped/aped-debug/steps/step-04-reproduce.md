---
step: 4
reads:
  - "tests/**"
writes: []
mutates_state: false
---

# Step 4: Phase 2 — Reproduce

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The loop must produce the failure mode the USER described
- ✋ HALT until reproduction is confirmed

## YOUR TASK

Run the loop. Watch the bug appear. Confirm it's the right bug.

## CONFIRM

- [ ] The loop produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against — see step 03 non-deterministic notes).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so step 08 can verify the fix actually addresses it.

⏸ **HALT — do not proceed until step 04 confirms.**

## FAILURE MODES

❌ Reproducing "a similar failure" instead of the user's exact one — the wrong bug.
❌ Skipping the symptom capture — step 08 has nothing to verify against.

## NEXT STEP

Load `.aped/aped-debug/steps/step-05-hypothesise.md`.
