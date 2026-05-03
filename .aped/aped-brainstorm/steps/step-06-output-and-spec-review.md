---
step: 6
reads:
  - "docs/brainstorm/session-{date}.md"
  - ".aped/scripts/lint-placeholders.sh"
writes:
  - "docs/brainstorm/session-{date}.md"
  - "subagent/spec-reviewer"
mutates_state: false
---

# Step 6: Phase 5 — Output, Self-Review, Spec-Reviewer

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Every deferral must name **who or what** answers it (no unowned deferrals)
- 🛑 Spec-reviewer dispatched after self-review

## YOUR TASK

Finalize the session file, run inline self-review, dispatch spec-reviewer.

## FINAL OUTPUT

Finalize `docs/brainstorm/session-{date}.md`:

```markdown
# Brainstorm — {topic}
Date: {date}
Target: {what}
Lens: {perspective}
Constraints: {list}
Techniques used: [{list}]
Total ideas: {N}

## Top Survivors
1. {idea} — {1-line rationale}
   - Assumptions: ...
   - Failure modes: ...
   - Disqualifiers: ...
   - Evidence basis: ...

## Assumptions in play
- {assumption a downstream skill must verify} — based on: {source}

## Unknowns surfaced (deferred — needs human / data / external answer)
- {open question} — recommended owner: {who/what answers this}

## Out of scope (declared during brainstorm)
- {item} — reason: {one-line rationale}

## Raw Ideas (archived)
### Batch 1 — {technique}
- ...
```

The `Assumptions in play` + `Unknowns surfaced` blocks exist because brainstorming sessions historically dropped unstated decisions a downstream PRD/arch agent had to re-discover. Downstream skills (`aped-prd`, `aped-arch`) must not treat an absent block as "no assumptions" — they verify by reading.

## INLINE SELF-REVIEW

Walk:

1. **Placeholder scan** — any TBD / TODO / vague? Fix. Bare deferrals like *"later"* / *"someone will pick this up"* without a concrete successor (follow-up ticket ID, `aped-grill` handoff, explicit `## Out of scope` entry) are placeholders too. Every deferral must name who or what answers it.
2. **Internal consistency** — do sections contradict each other?
3. **Scope check** — focused enough for a single implementation plan? If multiple subsystems, flag for split.
4. **Ambiguity check** — could any requirement be interpreted two ways? Pick one explicitly.
5. **YAGNI sweep** — unrequested features survived convergence? Remove.

Fix issues inline; no re-review.

## SPEC-REVIEWER DISPATCH

Dispatch `subagent_type: "general-purpose"` with the standard spec-review prompt (see `aped-prd` step 05 for the verbatim template, calibrated for: completeness, consistency, clarity, scope, YAGNI).

Approve → proceed to step 07. Issues Found → fix inline (or `[O]verride`), re-dispatch ONCE; second-pass NACK → HALT and ask user.

## SELF-REVIEW CHECKLIST

- [ ] **Placeholder lint** — `bash .aped/scripts/lint-placeholders.sh docs/brainstorm/session-{date}.md`.
- [ ] **Top survivors non-empty** — at least one converged idea.
- [ ] **Raw ideas preserved** — archive section lists the raw ideas.
- [ ] **Techniques named** — every technique used in step 04 is labelled.
- [ ] **Spec-reviewer dispatched** — Approved (or `[O]verride` recorded).

## NEXT STEP

Load `.aped/aped-brainstorm/steps/step-07-completion.md`.
