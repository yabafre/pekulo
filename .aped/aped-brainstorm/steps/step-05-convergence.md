---
step: 5
reads:
  - "docs/brainstorm/session-{date}.md"
writes:
  - "docs/brainstorm/session-{date}.md"
mutates_state: false
---

# Step 5: Phase 4 — Convergence (cluster, rank, ground)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Only run after quota is hit AND user calls time
- 🛑 Ground every survivor with the 4-field table — *"strong intuition"* is NOT a basis

## YOUR TASK

Cluster ideas, rank within each cluster, ground every survivor before recommending. The convergence trap to avoid: recommendations flip when followed up because the first pass was vibing.

## STEPS

1. **Cluster** — group similar ideas (you do this, not the user — they're tired).

2. **Rank** — for each cluster, pick the 1–2 strongest by a criterion the user chooses (novelty / feasibility / impact).

3. **Ground each survivor before recommending it.** The convergence trap: recommendations flip when followed up because the first pass was vibing. Per-survivor table:

   | Field | Required content |
   |---|---|
   | **Assumptions** | What about the world / user / tech must be true for this to work? |
   | **Failure modes** | One sentence each on the top 2 ways this idea breaks under stress |
   | **Disqualifiers** | Conditions that would cause you to retract this from the survivor list (regulatory blocker, missing skill, etc.) |
   | **Evidence basis** | Anchor in: (a) existing internal artefact (cite path), (b) external precedent (cite link), or (c) reasoning from first principles (one-line sketch). "Strong intuition" is NOT a basis. |

4. **Present** — show user the top 5–10 ideas across clusters with the grounding table above each rationale.

⏸ **GATE: Ask the user which ideas survive. Don't over-filter — the user decides.**

If the user picks an idea whose `Evidence basis` was *"first principles"*, flag it as a candidate for `aped-grill` before downstream PRD/arch work — alignment grilling pre-empts the flip.

## NEXT STEP

Load `.aped/aped-brainstorm/steps/step-06-output-and-spec-review.md`.
