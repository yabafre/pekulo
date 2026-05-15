---
step: 8
reads:
  - "docs/architecture.md"
  - "docs/prd.md"
  - ".aped/scripts/lint-placeholders.sh"
  - ".aped/scripts/validate-architecture.sh"
  - ".aped/aped-arch/scripts/oracle-arch.sh"
  - "mcp/aped_validate.phase"
writes: []
mutates_state: false
---

# Step 8: Phase 5 — Validation, Self-Review, Final A/C Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Surface every oracle ERROR verbatim and HALT
- 🛑 Self-review checklist: each `[ ]` flips to `[x]` or HALT
- ✋ Final A/C gate: HALT for the user's choice

## CONTEXT BOUNDARIES

- Phases 1 / 2 / 2b / 3 / 4 all validated and written.
- `current_subphase: validation`.

## YOUR TASK

Run coherence validation, walk the self-review checklist, present the final A/C gate. After `[C]`, finalisation happens in step 09.

## COHERENCE CHECKLIST

- [ ] All technology decisions work together (no conflicts).
- [ ] Every FR/NFR from PRD has a clear implementation path.
- [ ] Security requirements are addressed.
- [ ] Scale requirements are supported by the chosen stack.
- [ ] No orphan decisions (every choice connects to a requirement).

Present validation results. Flag any gaps.

## SELF-REVIEW

- [ ] **Structural drift** — `bash .aped/scripts/validate-architecture.sh docs/architecture.md`. **WARN-only** — surface stderr if non-zero, do **not** HALT. The oracle below remains the HALT-bearing gate.
- [ ] **Placeholder lint** — `bash .aped/scripts/lint-placeholders.sh docs/architecture.md`.
- [ ] **Oracle pass** — `aped_validate.phase(phase: "arch")` returns `{ok}`. MCP fallback: `bash .aped/aped-arch/scripts/oracle-arch.sh docs/architecture.md docs/prd.md`. Surface any `ERROR Eddd: ...` line verbatim and HALT.
- [ ] **FR implementation paths** — every PRD FR is mentioned in `architecture.md` with a clear implementation surface.
- [ ] **No conflicting decisions** — Phase 2 categories work together (no `tRPC` + `gRPC` simultaneously without justification).
- [ ] **Council minority views recorded** — every Council dispatch in Phase 2b includes the minority view.
- [ ] **Frontmatter coherent** — `current_subphase: validation`; `completed_subphases` lists all five phases that actually ran.

## FINAL A/C GATE

```
Architecture document ready ({K} decisions, {N} council dispatches, {V} validation gaps).

Choose your next move:
[A] Advanced elicitation — invoke aped-elicit on the full architecture doc
    (Pre-mortem: "1 year from now this architecture is regretted, why?";
    Red Team vs Blue Team on security; Tree of Thoughts on the riskiest decision)
[C] Continue — accept the architecture, finalise architecture.md, update state.yaml
[Other] Direct correction — point at a specific decision; I revisit it (and re-dispatch
        the Council if it's a major one), then redisplay this menu
```

⏸ **HALT — wait for the user's choice.**

The Council was for divergent specialist input on major decisions; this final `[A]` is for adversarial pressure on the doc as a whole. Both serve different purposes.

## BEHAVIOUR BY CHOICE

- `[A]` → invoke `aped-elicit`. When elicit returns enhanced content, apply changes inline; redisplay the menu.
- `[C]` → proceed to step 09 (finalisation).
- Direct correction → revisit the named decision (re-dispatch Council if major); redisplay the menu.

## SUCCESS METRICS

✅ Coherence checklist + self-review checklist all `[x]`.
✅ Oracle exits 0 (or fallback bash script exits 0).
✅ Final A/C gate offered.

## FAILURE MODES

❌ Bypassing the oracle on a "small" gap — E010-E013 are blockers downstream.
❌ Auto-advancing on `[C]` without offering `[A]` — loses the last adversarial pass.

## NEXT STEP

After `[C]`, load `.aped/aped-arch/steps/step-09-finalize.md`.
