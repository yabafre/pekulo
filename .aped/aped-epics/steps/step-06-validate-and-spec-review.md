---
step: 6
reads:
  - "docs/prd.md"
  - ".aped/aped-epics/scripts/validate-coverage.sh"
  - ".aped/aped-epics/scripts/oracle-epics.sh"
  - ".aped/scripts/lint-placeholders.sh"
  - "mcp/aped_validate.phase"
writes:
  - "subagent/spec-reviewer"
mutates_state: false
---

# Step 6: Coverage Validation, Self-Review, Spec-Reviewer Dispatch

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `aped_validate.phase` returns violations or oracle exits non-zero, HALT and surface ERRORs verbatim
- 🛑 The spec-reviewer is dispatched after self-review passes; HALT on persistent NACK
- 🚫 NEVER mask validation failures — E020 / E021 block downstream skills

## CONTEXT BOUNDARIES

- User confirmed the structure with `[C]`.
- Epics design + story list + running coverage matrix complete.

## YOUR TASK

Run the FR coverage validation, walk the inline self-review, dispatch the spec-reviewer subagent.

## VALIDATION

**Prefer MCP**: `aped_validate.phase(phase: "epics")` returns `{ ok, violations: [{code, message}] }` typed.

**Fallback** (MCP unavailable):

```bash
bash .aped/aped-epics/scripts/validate-coverage.sh docs/epics.md docs/prd.md
bash .aped/aped-epics/scripts/oracle-epics.sh docs/epics.md docs/prd.md
```

If violations are non-empty (or oracle exits non-zero), surface each `ERROR` verbatim and HALT. E020 (uncovered FR) or E021 (empty epic) block `aped-story` / `aped-dev` downstream.

(Note: `epics.md` doesn't exist yet — these scripts can be run against the in-memory draft by piping it; or write a temp file first. The final write happens in step 07 after validation passes.)

## INLINE SELF-REVIEW

After the coverage validation passes, look at the epic structure with fresh eyes — this is an inline checklist you run yourself, not a subagent dispatch. Fix any issues inline; no need to re-review.

1. **Placeholder lint** — run `bash .aped/scripts/lint-placeholders.sh <draft-path>`. Exit 0 = pass.
2. **FR coverage matches PRD** — every PRD FR appears in at least one story's `Covered FRs:` list. No orphan FRs, no phantom FRs that are not in the PRD.
3. **Given/When/Then ACs** — every story's acceptance criteria follow the Given/When/Then format. No *"should work"* or *"TBD"* ACs.
4. **Acyclic depends_on graph** — the `depends_on:` chain across all stories is a DAG — no cycles, no story depending on itself transitively.
5. **Story granularity** — no story implements more than 5 FRs (likely needs splitting), and no story implements 0 FRs (likely a phantom or a foundation story that should be merged or labelled explicitly).

If you find issues, fix them inline. No need to re-review — just fix and move on.

## SPEC-REVIEWER DISPATCH

After the inline self-review passes, dispatch a fresh subagent to review the epics breakdown **before** the user gate. The reviewer's job is to verify the structure is sound and ready for `aped-story` and `aped-dev` consumption.

Use the `Agent` tool (`subagent_type: "general-purpose"`) with this verbatim prompt (substitute `[ARTEFACT_FILE_PATH]` with the path of the draft):

```
You are a spec document reviewer. Verify this epics breakdown is complete and ready for execution.

**Spec to review:** [ARTEFACT_FILE_PATH]

## What to Check

| Category | What to Look For |
|----------|------------------|
| Completeness | TODOs, placeholders, missing ACs, missing FR coverage list per story |
| Consistency | Cycles in `depends_on:`, duplicate story keys, FR coverage that doesn't match the PRD |
| Clarity | Stories whose scope cannot be understood without reading the PRD |
| Granularity | Stories owning multiple subsystems (need split) or stories that touch identical code (need merge) |
| YAGNI | Stories that don't map to any FR, foundation stories that aren't actually needed |

## Calibration

**Only flag issues that would cause real problems for `aped-story` and `aped-dev`.**
Story granularity that obviously needs to split (one story owning multiple
subsystems) or merge (two stories that touch identical code), orphan FRs not
covered by any story, or cycles in `depends_on` — those are issues. Naming
bikesheds and ordering preferences are not.

Approve unless there are serious gaps that would lead to a flawed sprint.

## Output Format

## Spec Review

**Status:** Approved | Issues Found

**Issues (if any):**
- [Section X]: [specific issue] - [why it matters for execution]

**Recommendations (advisory, do not block approval):**
- [suggestions for improvement]
```

When the reviewer returns:

- **Status: Approved** — proceed to step 07. Surface recommendations (advisory) but do not block.
- **Status: Issues Found** — fix flagged issues inline (or `[O]verride` with a recorded reason if a flag is wrong), then re-dispatch the same reviewer ONCE. If the second pass still flags issues, HALT and present them to the user for adjudication.

## SUCCESS METRICS

✅ Validation passed (MCP or fallback).
✅ Inline self-review checklist all `[x]`.
✅ Spec-reviewer dispatched; Status: Approved (or `[O]verride` recorded).

## FAILURE MODES

❌ Skipping validation — orphan FRs leak to `aped-story`.
❌ Running spec-reviewer before self-review — wastes a dispatch on issues you would have caught.
❌ Looping spec-reviewer more than twice — escalate to the user instead.

## NEXT STEP

Load `.aped/aped-epics/steps/step-07-write-output.md` to write `epics.md` and update state.yaml.
