---
step: 7
reads:
  - "docs/architecture.md"
  - "docs/prd.md"
  - "docs/ux/**"
writes:
  - "docs/architecture.md"
  - "state.yaml#pipeline.phases.architecture.current_subphase"
mutates_state: true
---

# Step 7: Phase 4 — Structure & Mapping

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 FR → File mapping uses PRD FR IDs verbatim
- 🛑 UX components from spec are reflected in the directory tree
- ✋ HALT for the user gate before advancing

## CONTEXT BOUNDARIES

- Phase 3 implementation patterns validated.
- Phase 2 + 2b technology decisions locked in.

## YOUR TASK

Create the concrete project structure: directory tree, FR → file mapping, integration boundaries, shared code inventory.

## SUBSECTIONS

1. **Directory tree** — full project layout with annotations (which decisions from Phase 2/3 land where).
2. **FR → File mapping** — each PRD FR ID appears with the file/module it lands in (use FR IDs verbatim).
3. **Integration boundaries** — where external systems connect (auth provider, payment processor, ticket system, …).
4. **Shared code inventory** — utilities, types, constants that multiple features share (avoid premature DRY but prevent duplicate auth utility classes).

## PRESENT + RECORD

Present to user. Populate the four `## Phase 4 — Structure & Mapping` subsections of `architecture.md` as each is validated.

## GATE

⏸ **GATE: User validates structure.**

After validation, run Incremental Tracking Contract writes:
- Advance `current_subphase` → `validation`.
- Push `structure-mapping` to `completed_subphases`.
- Mirror in `state.yaml`.

## SUCCESS METRICS

✅ Directory tree complete; every Phase 2 / 3 decision has a home.
✅ Every PRD FR ID appears in the mapping table verbatim.
✅ Integration boundaries enumerated.
✅ Shared inventory listed (or explicitly noted as empty for early MVP).

## FAILURE MODES

❌ FR mapping with paraphrased identifiers — `aped-story` cannot trace.
❌ Skipping shared inventory — first epic produces 3 copies of the same auth helper.

## NEXT STEP

Load `.aped/aped-arch/steps/step-08-validation-and-final-gate.md`.
