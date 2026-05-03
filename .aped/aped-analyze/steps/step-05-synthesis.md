---
step: 5
reads:
  - "subagent/findings"
  - ".aped/templates/product-brief.md"
writes:
  - "docs/product-brief.md"
mutates_state: false
---

# Step 5: Phase 3 — Research Review + Phase 4 — Synthesis

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the user gate before synthesizing
- 🛑 Highlight conflicts between research areas

## YOUR TASK

Present research findings, surface tensions, then synthesize into the product brief.

## RESEARCH REVIEW

Present a structured summary:

- Key competitors found and how they compare.
- Market size and opportunity.
- Regulatory or compliance concerns.
- Recommended technical approach and why.
- Any surprises or conflicts between research areas.

Highlight anything that might change the user's original vision:

- *"Research shows the market is more crowded than expected — here are 3 direct competitors..."*
- *"There's a compliance requirement you may not have considered..."*
- *"Technical approach X is more mature than Y for this use case..."*

⏸ **GATE: Ask the user if the research changes their vision. Wait for confirmation before synthesizing.**

## SYNTHESIS

Ensure output dir exists:

```bash
mkdir -p docs
```

1. Fuse Discovery answers + research results into a product brief.
2. Use template from `.aped/templates/product-brief.md`.
3. Fill every section: Executive Summary, Core Vision, Target Users, Success Metrics, MVP Scope.
4. Write output to `docs/product-brief.md`.

## NEXT STEP

Load `.aped/aped-analyze/steps/step-06-self-review-and-output.md`.
