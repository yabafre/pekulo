---
step: 6
reads:
  - "docs/product-brief.md"
  - ".aped/scripts/lint-placeholders.sh"
  - ".aped/aped-analyze/scripts/validate-brief.sh"
  - ".aped/skills/aped-skills/checklist-analyze.md"
writes:
  - "docs/product-brief.md"
  - "subagent/spec-reviewer"
  - "state.yaml#pipeline.phases.analyze"
mutates_state: true
---

# Step 6: Self-Review, Spec-Reviewer, Validation, State Update, Final Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Each `[ ]` flips to `[x]` or HALT
- ✋ Do NOT update state until user explicitly approves the brief

## YOUR TASK

Walk inline self-review, dispatch spec-reviewer, run validation, present to user, update state.

## INLINE SELF-REVIEW

1. **Placeholder lint** — `bash .aped/scripts/lint-placeholders.sh docs/product-brief.md`. Exit 0 = pass.
2. **Market/domain/tech findings consistent** — three subagent outputs do not contradict each other (*"low competition"* + *"saturated tooling"* = contradiction).
3. **Evidence quality** — every claim backed by a cited source from research, or labelled *"no evidence found — assumption to validate"*.
4. **Scope of product unambiguous** — one Executive Summary sentence answers *"what is it?"* without hedging.
5. **Non-falsifiable claims removed** — *"users will love it"* / *"scales effortlessly"* deleted or reframed as falsifiable hypotheses.

Fix inline; no re-review.

## SPEC-REVIEWER DISPATCH

Use the `Agent` tool (`subagent_type: "general-purpose"`) with the standard spec-review prompt (calibrated: completeness, consistency, clarity, evidence, YAGNI). The reviewer output format ends with `**Status:** Approved | Issues Found`.

Approve → continue. Issues Found → fix inline (or `[O]verride`), re-dispatch ONCE; second NACK → HALT.

## VALIDATION

```bash
bash .aped/aped-analyze/scripts/validate-brief.sh docs/product-brief.md
```

If validation fails: fix missing sections and re-validate.

## PRESENT TO USER

Summarize every section. Ask:

- *"Does this accurately capture your project?"*
- *"Anything to add, remove, or change?"*

⏸ **GATE: Do NOT update state until user explicitly approves.**

If user requests changes: apply, re-validate, re-present.

## SELF-REVIEW CHECKLIST (final gate)

- [ ] **Placeholder lint** — exit 0.
- [ ] **All 3 research outputs cited** — Mary, Derek, Tom each appear in the brief with attribution.
- [ ] **Required sections present** — Executive Summary, Core Vision (Goals), Target Users, Success Metrics, MVP Scope (Constraints) populated.
- [ ] **User-facing summary written** — Executive Summary answers *"what is it"* + *"why now"* in one sentence each.
- [ ] **Spec-reviewer dispatched** — Approved (or `[O]verride` recorded).

## STATE UPDATE (only after user approval)

Create / update `docs/state.yaml`:

```yaml
schema_version: 1
pipeline:
  current_phase: "analyze"
  phases:
    analyze:
      status: "done"
      output: "docs/product-brief.md"
```

`schema_version: 1` is mandatory at the top — subsequent skills refuse to run on unknown versions.

## NEXT-STEP MESSAGE

> Product brief is ready. When you're ready, run `aped-prd` to generate the PRD.

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-analyze.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## DONE

Once every checklist item is `[x]`, the skill is complete.
