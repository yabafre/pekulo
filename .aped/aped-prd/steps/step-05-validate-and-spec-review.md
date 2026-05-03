---
step: 5
reads:
  - "docs/prd.md"
  - ".aped/scripts/lint-placeholders.sh"
  - ".aped/aped-prd/scripts/validate-prd.sh"
  - ".aped/aped-prd/scripts/oracle-prd.sh"
  - "mcp/aped_validate.phase"
writes:
  - "subagent/spec-reviewer"
mutates_state: false
---

# Step 5: Inline Self-Review, Validation, Spec-Reviewer Dispatch

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If oracle returns ERROR codes (E001-E007), surface verbatim and HALT
- 🛑 Spec-reviewer dispatched after self-review passes; HALT on persistent NACK

## YOUR TASK

Run the inline self-review checklist, run validation (oracle), dispatch the spec-reviewer subagent.

## INLINE SELF-REVIEW (after all 4 sections drafted)

1. **Placeholder lint** — `bash .aped/scripts/lint-placeholders.sh docs/prd.md`. Exit 0 = pass. Fix flagged TBD / TODO / lone ellipses inline.
2. **FR/NFR coherence** — no contradictions between sections (NFR offline-first vs FR live websocket).
3. **AC presence** — every FR has at least one acceptance criterion (explicit or implicit via the FR's `[capability]` clause being independently testable).
4. **Metrics measurability** — Success Metrics and NFRs have units and thresholds.
5. **No scope creep** — PRD does not introduce features absent from the brief. If brief says MVP = inventory tracking and PRD adds chat, surface to user as a gap.

If you find issues, fix them inline. No re-review.

## VALIDATION

**Prefer MCP**: `aped_validate.phase(phase: "prd")` returns `{ ok, violations: [{code, message}] }` typed.

**Fallback**:

```bash
bash .aped/aped-prd/scripts/validate-prd.sh docs/prd.md
bash .aped/aped-prd/scripts/oracle-prd.sh docs/prd.md
```

If violations are non-empty (or oracle exits non-zero), surface each `ERROR Eddd: ...` verbatim. Offer one final A/P/C round. Do NOT ship the PRD until oracle passes — every error code (E001–E007) maps to a deterministic fix.

## SPEC-REVIEWER DISPATCH

Dispatch a fresh subagent (`subagent_type: "general-purpose"`) with this verbatim prompt (substitute `[ARTEFACT_FILE_PATH]` with the path of `prd.md`):

```
You are a spec document reviewer. Verify this PRD is complete and ready for planning.

**Spec to review:** [ARTEFACT_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, "TBD", incomplete sections, missing required sections |
| Consistency | FR/NFR contradictions, conflicting requirements between sections |
| Clarity | Requirements ambiguous enough to cause someone to build the wrong thing |
| Scope | Features in the PRD that are not anchored in the product brief |
| YAGNI | Unrequested features, over-engineering, gold-plated NFRs |

Approve unless serious gaps would lead to a flawed `aped-arch` or `aped-epics` cycle.

## Output Format

## Spec Review

**Status:** Approved | Issues Found
**Issues (if any):** ...
**Recommendations (advisory):** ...
```

When the reviewer returns:
- **Approved** → proceed to step 06.
- **Issues Found** → fix flagged inline (or `[O]verride` with reason), then re-dispatch ONCE. Second-pass NACK → HALT and ask user.

## SELF-REVIEW CHECKLIST (final gate before write)

Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Placeholder lint** — exit 0.
- [ ] **FR format** — every FR matches `FR#: [Actor] can [capability]`. No FR-less section.
- [ ] **FR IDs** — sequential, unique, none reused.
- [ ] **NFRs measurable** — every NFR has a threshold.
- [ ] **Required sections present** — Goals, Non-goals (Out of Scope), FRs, NFRs, Success Metrics.
- [ ] **Ambiguity scan** — `should`, `might`, `could` only with explicit justification.
- [ ] **Spec-reviewer dispatched** — Approved (or `[O]verride` recorded).

## NEXT STEP

Load `.aped/aped-prd/steps/step-06-write-and-completion.md`.
