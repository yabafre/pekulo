---
step: 3
reads: []
writes: []
mutates_state: false
---

<!-- Note: Step 3 is pure conversational discovery — questions only, no I/O. The synthesis lands in step 05. -->


# Step 3: Phase 1 — Guided Discovery (4 rounds)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 ONE category at a time — do NOT dump all questions
- 🛑 Each round ends with a catch-all + HALT
- 🛑 Don't auto-progress; wait for the user to add detail or say done

## YOUR TASK

Conversational discovery. Adapt to `communication_language`. Probe vague answers; help the user articulate.

## ROUND 1 — THE VISION

Start with the big picture. Ask:

- **What are we building?** — Product/service in user's own words.
- **What problem does it solve?** — Specific pain point, not generic category.
- **What exists today?** — How do people currently solve this (even imperfectly)?

Probe vague answers (*"a platform for X"*) with: *"Can you walk me through a specific scenario where a user would use this?"* / *"What's the most frustrating thing about the current alternatives?"*

⏸ **Catch-all:** *"Anything else about the vision or the problem space you want to mention before we move to users?"* Wait. Capture; don't redirect.

## ROUND 2 — THE USERS

- **Who is the primary user?** — Role, context, technical level.
- **Who pays?** — User and buyer are sometimes different.
- **What does success look like for them?** — What outcome makes them come back?

Probe: *"Individuals or teams? Small businesses or enterprise?"* / *"Budget sensitivity? Must-have or nice-to-have?"*

⏸ **Catch-all:** *"Any other detail about the users — secondary personas, anti-patterns, a specific person you're building this for — before we move to constraints?"*

## ROUND 3 — THE CONSTRAINTS

- **Why now?** — Market timing, technology enabler, competitive gap.
- **What's the MVP scope?** — If you had to launch in 2 weeks, what's the one thing it MUST do?
- **Any technical constraints?** — Platform preferences, existing systems, compliance.

⏸ **Catch-all:** *"Any other constraint — budget, deadline, team capacity, an existing tool you must integrate with — before we summarise?"*

## ROUND 4 — VALIDATION

Summarize back to user in a structured format:

- **Product:** one-line description.
- **Problem:** the pain point.
- **Users:** primary audience.
- **MVP core:** the one essential feature.
- **Constraints:** platform, integrations, compliance.

Then present the A/C menu:

```
Discovery summary ready. Choose:
[A] Advanced elicitation — invoke aped-elicit on the summary
    (Socratic / Pre-mortem / Devil's Advocate to surface blind spots before research)
[C] Continue — accept the summary, dispatch parallel research (Mary / Derek / Tom)
[Other] Direct correction — type changes; I'll apply and redisplay
```

⏸ **HALT — wait for `[C]`. Do NOT dispatch research before `[C]`.**

## NEXT STEP

After `[C]`, load `.aped/aped-analyze/steps/step-04-research-agents.md`.
