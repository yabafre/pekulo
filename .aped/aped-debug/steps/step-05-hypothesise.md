---
step: 5
reads:
  - "src/**"
  - "git/log"
writes: []
mutates_state: false
---

# Step 5: Phase 3 — Hypothesise

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Generate 3–5 ranked hypotheses BEFORE testing any of them
- 🛑 Each hypothesis is FALSIFIABLE — state the prediction
- ✋ HALT to present the ranked list to the user

## YOUR TASK

Generate 3–5 ranked, falsifiable hypotheses for the cause. Single-hypothesis generation anchors on the first plausible idea — that's why the rule exists.

## FORMAT

Each hypothesis must state the prediction:

> *"If &lt;X&gt; is the cause, then &lt;changing Y&gt; will make the bug disappear / &lt;changing Z&gt; will make it worse."*

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

## PRESENT TO USER

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly (*"we just deployed a change to #3"*) or know hypotheses they have already ruled out. Cheap checkpoint, big time saver.

Don't block on it — proceed with your ranking if the user is AFK.

⏸ **HALT — present the ranked list and wait for re-rank or AFK signal.**

## SUCCESS METRICS

✅ 3–5 hypotheses generated.
✅ Each is falsifiable with a stated prediction.
✅ User saw the ranked list (or AFK acknowledged).

## FAILURE MODES

❌ Single-hypothesis tunnel vision — the first plausible idea anchors everything else.
❌ Vague hypotheses (*"it might be a race condition"*) — un-falsifiable.

## NEXT STEP

Load `.aped/aped-debug/steps/step-06-instrument.md`.
