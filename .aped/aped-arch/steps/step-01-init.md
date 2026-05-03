---
step: 1
reads:
  - "docs/state.yaml"
  - "docs/architecture.md"
writes:
  - "docs/architecture.md"
  - "state.yaml#pipeline.phases.architecture"
  - "mcp/aped_state.advance"
mutates_state: true
---

# Step 1: Initialization, Resume Guard, Phase 0 Skeleton

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `pipeline.phases.architecture.status: in-progress` AND `current_subphase` is set, RESUME — skip Phase 0 setup
- 🛑 NEVER silently re-initialise after a crashed write — HALT and ask the user `[R]estart` / `[A]bort`
- 📖 ALWAYS read the complete step file before acting

## CONTEXT BOUNDARIES

- This is the first step of `aped-arch`.
- The PRD already exists (verified in step 02).

## YOUR TASK

Check pipeline state, handle resume, and (if fresh) initialise `architecture.md` with the skeleton + advance state.

## STATE CHECK

Read `docs/state.yaml`:

- `pipeline.phases.architecture.status` is `done` → ask user *"Architecture exists. Redo or skip?"* If skip, STOP.
- `pipeline.phases.architecture.status` is `in-progress` AND `current_subphase` set AND `architecture.md` exists with parseable frontmatter → **RESUME**. Announce: *"Resuming Arch at `{current_subphase}` — `{N}` subphase(s) already completed."* Skip ahead to the matching step (e.g. `technology-decisions` → step 04).
- `in-progress` but `architecture.md` missing OR frontmatter unreadable → **HALT** and ask: *"State and artefact diverged. `[R]estart Phase 0 (loses recorded subphases)` or `[A]bort and restore architecture.md from VCS`?"*
- No `architecture` entry yet → continue to Phase 0 below.

## PHASE 0 — INITIALISE TRACKED ARTEFACT (only on fresh state)

### 1. Write `architecture.md` skeleton

If `docs/architecture.md` does NOT already exist, write the skeleton:

```markdown
---
artefact: architecture
project: {{project_name}}
created: <ISO 8601 now>
last_updated: <ISO 8601 now>
current_subphase: context-analysis
completed_subphases: []
phases_planned:
  - context-analysis
  - technology-decisions
  - council-dispatches
  - implementation-patterns
  - structure-mapping
  - validation
---

# Architecture — {{project_name}}

> Built incrementally by `aped-arch`. Sections fill as each subphase is validated.

## Phase 1 — Context Analysis

<!-- Populated after Phase 1 gate: extracted FRs/NFRs, scale, integration points, compliance signals, requirement tensions. -->

## Phase 2 — Technology Decisions

### Data Layer

### Authentication & Security

### API Design

### Frontend

### Infrastructure

## Phase 2b — Council Dispatches

<!-- Optional. One subsection per major decision dispatched. -->

## Phase 3 — Implementation Patterns

### Naming Conventions

### Code Structure

### Communication Patterns

### Process Rules

## Phase 4 — Structure & Mapping

### Directory Tree

### FR → File Mapping

### Integration Boundaries

### Shared Code Inventory

## Phase 5 — Validation
```

### 2. Advance state

**Prefer MCP**: `aped_state.advance(phase: "arch", status: "in-progress")`.

**Fallback**: edit `docs/state.yaml`:

```yaml
pipeline:
  current_phase: "architecture"
  phases:
    architecture:
      status: "in-progress"
      current_subphase: "context-analysis"
      completed_subphases: []
      output: "docs/architecture.md"
      started_at: "<ISO 8601 now>"
```

### 3. Confirm

> Architecture tracking initialised — `architecture.md` skeleton written, state advanced to `current_subphase: context-analysis`.

## INCREMENTAL TRACKING CONTRACT (referenced by every gate downstream)

After every `⏸ GATE` in this skill, do these three writes **atomically**, in this order:

1. **Append to `docs/architecture.md`** — write validated content under the matching section header. Use Edit; never regenerate the whole file.
2. **Update the architecture frontmatter** — set `current_subphase` to the *next* subphase, push the just-finished subphase onto `completed_subphases`, bump `last_updated`.
3. **Update `docs/state.yaml`** — mirror `pipeline.phases.architecture.current_subphase` and `completed_subphases`, bump `last_updated`. Keep `status: "in-progress"` until step 09 finalisation.

If any write fails, HALT — partial progress is better than divergent state.

## SUCCESS METRICS

✅ State checked; resume / fresh path chosen correctly.
✅ Fresh path: skeleton written, state advanced.
✅ Incremental tracking contract understood for downstream gates.

## FAILURE MODES

❌ Silently re-initialising over a crashed `architecture.md` — destroys recorded subphases.
❌ Skipping the resume check — duplicates Phase 0 work.
❌ Treating frontmatter divergence as a soft warning — it's a HALT.

## NEXT STEP

Load `.aped/aped-arch/steps/step-02-input-discovery.md`.
