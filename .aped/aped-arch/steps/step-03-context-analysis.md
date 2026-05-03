---
step: 3
reads:
  - "docs/prd.md"
  - "docs/ux/**"
  - "docs/product-brief.md"
  - "docs/project-context.md"
  - "docs/architecture.md"
writes:
  - "docs/architecture.md"
  - "state.yaml#pipeline.phases.architecture.current_subphase"
mutates_state: true
---

# Step 3: Phase 1 — Context Analysis

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the user gate before advancing
- 🛑 Surface tensions between requirements (no silent compromises)
- 🛑 After GATE pass, run the Incremental Tracking Contract writes

## CONTEXT BOUNDARIES

- PRD + UX + brief + context (if brownfield) loaded.
- `architecture.md` skeleton exists; `current_subphase: context-analysis`.

## YOUR TASK

Extract architectural implications from loaded documents, surface tensions, validate with the user, and write the validated content to `## Phase 1 — Context Analysis`.

## ANALYSIS

Analyze loaded documents for architectural implications:

- **Extract FRs and NFRs** that drive architectural choices (e.g. NFR-3 ACID → relational DB; FR-12 audit log → write-only schema).
- **Identify scale requirements** — users, data volume, throughput, geographical distribution.
- **Note integration points** — external APIs, services, message queues, third-party auth.
- **Flag compliance/security constraints** — GDPR, HIPAA, SOC2, PCI, audit trails.
- **Surface requirement tensions** — conflicting goals (e.g. real-time + minimal infra; offline-first + multi-tenant).

## PRESENT TO USER

> Here's what the PRD implies architecturally for {project_name}:
>
> **Functional drivers:** {3-5 bullets citing FR IDs}
> **Non-functional drivers:** {3-5 bullets citing NFR IDs}
> **Scale:** {users, ops/sec, GB/day, regions}
> **Integration points:** {list}
> **Compliance:** {list}
> **Tensions to resolve:**
> - {Tension 1: e.g. NFR-7 wants 99.99% uptime, but FR-2 wants on-prem deployable}
>
> Flag anything I've missed before we move on.

⏸ **GATE: User validates the context analysis.**

## INCREMENTAL TRACKING CONTRACT WRITES

After validation:

1. **Append validated content** under `## Phase 1 — Context Analysis` in `docs/architecture.md`. Use Edit (do not regenerate the file).
2. **Update frontmatter**: `current_subphase: technology-decisions`, push `context-analysis` onto `completed_subphases`, bump `last_updated`.
3. **Mirror in `state.yaml`**: same `current_subphase` + `completed_subphases`, bump `last_updated`. Keep `status: in-progress`.

## SUCCESS METRICS

✅ Drivers, scale, integrations, compliance, and tensions extracted.
✅ User validated the analysis.
✅ Three writes done atomically (architecture.md + frontmatter + state.yaml).

## FAILURE MODES

❌ Silently merging conflicting requirements — surface them; let the user decide.
❌ Listing FRs without their IDs — downstream cannot trace.
❌ Updating frontmatter while the architecture.md write failed — divergent state.

## NEXT STEP

Load `.aped/aped-arch/steps/step-04-technology-decisions.md`.
