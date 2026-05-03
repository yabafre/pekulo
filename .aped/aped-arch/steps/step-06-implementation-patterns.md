---
step: 6
reads:
  - "docs/architecture.md"
writes:
  - "docs/architecture.md"
  - "state.yaml#pipeline.phases.architecture.current_subphase"
mutates_state: true
---

# Step 6: Phase 3 — Implementation Patterns

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the user gate before advancing
- 🛑 Record each decision in its subsection IMMEDIATELY (do not buffer)

## CONTEXT BOUNDARIES

- Phase 2 + 2b validated.
- All major decisions in `## Phase 2b` have minority views recorded.

## YOUR TASK

Define conventions ensuring consistency across agents and stories. Record each in place.

## CATEGORIES

### Naming Conventions
- Files and directories (kebab-case, camelCase, …).
- Components, functions, variables.
- Database tables, columns.
- API endpoints.

### Code Structure
- Project directory tree (full layout).
- Module/layer boundaries (where does business logic live?).
- Import conventions.
- Test file locations and naming.

### Communication Patterns
- Error format (how errors flow from DB to API to UI).
- Logging format and levels.
- Event/message patterns (if applicable).

### Process Rules
- Branch naming convention.
- Commit message format.
- PR/MR requirements.
- Required test coverage level.

## PER-CATEGORY LOOP

Present each category. Discuss with user. **Record each decision in its `### {Pattern}` subsection of `## Phase 3 — Implementation Patterns` immediately**, not at the end.

## GATE

⏸ **GATE: User validates patterns.**

After validation, run Incremental Tracking Contract writes:
- Confirm all 4 pattern subsections populated.
- Advance `current_subphase` → `structure-mapping`.
- Push `implementation-patterns` to `completed_subphases`.
- Mirror in `state.yaml`.

## SUCCESS METRICS

✅ All 4 subsections populated.
✅ User validated patterns.
✅ Tracking contract writes done atomically.

## FAILURE MODES

❌ Buffering all 4 patterns and writing at the end — defeats incremental tracking.
❌ Treating naming as a low-priority decision — naming inconsistency is the most cited story-implementation friction in retros.

## NEXT STEP

Load `.aped/aped-arch/steps/step-07-structure-and-mapping.md`.
