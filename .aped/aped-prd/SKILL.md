---
name: aped-prd
description: 'Generates PRD autonomously from product brief. Use when user says "create PRD", "generate PRD", "aped prd", or invokes /aped-prd.'
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED PRD — Autonomous PRD Generation

## Critical Rules

- EVERY FR must follow format: `FR#: [Actor] can [capability]` — no exceptions
- Take your time to generate quality FRs — 10-80 range, each independently testable
- Do not skip domain detection — it determines mandatory sections
- Quality is more important than speed — validate before writing

## Setup

1. Read `.aped/config.yaml` — extract `user_name`, `communication_language`, `document_output_language`
2. Read `docs/state.yaml` — check pipeline state
   - If `pipeline.phases.prd.status` is `done`: ask user — redo PRD or skip?
   - If user skips: stop here (user will invoke next phase manually)

## Load Product Brief

- Read brief from path in `pipeline.phases.analyze.output`
- If no analyze phase in state: ask user for product brief path or content

## Domain & Project Type Detection

1. Read `.aped/aped-prd/references/domain-complexity.csv`
   - Match brief content against `signals` column
   - If match found: note `complexity`, `key_concerns`, `special_sections`
   - High-complexity domains (healthcare, fintech, govtech, etc.) — mandatory Domain Requirements section
2. Read `.aped/aped-prd/references/project-types.csv`
   - Match against `detection_signals`
   - Note `required_sections`, `skip_sections`, `key_questions`

## Task Tracking

Create tasks for each generation phase:
```
TaskCreate: "P1: Foundation — Executive Summary & Vision"
TaskCreate: "P2: Scope & Journeys"
TaskCreate: "P3: Domain Requirements (conditional)"
TaskCreate: "P4: Functional & Non-Functional Requirements"
TaskCreate: "Validate PRD"
```

Update each task to `completed` as you finish each phase.

## PRD Generation (4 compressed phases)

Generate the PRD autonomously using `.aped/templates/prd.md` as structure.

### P1: Foundation
- Executive Summary from brief's Core Vision
- Product vision and purpose statement

### P2: Scope & Journeys
- Success Criteria: User/Business/Technical/Measurable Outcomes
- Product Scope: MVP — Growth — Vision phases
- User Journeys: key end-to-end workflows

### P3: Domain Requirements (conditional)
- Only if domain-complexity detection flagged medium/high
- Include mandatory compliance, regulations, certifications from `key_concerns`
- Skip this section entirely for low-complexity/general domains

### P4: Requirements
- Functional Requirements (target 10-80 FRs)
  - Format: `FR#: [Actor] can [capability] [context/constraint]`
  - Group by capability area
  - Read `.aped/aped-prd/references/fr-rules.md` — validate quality
- Non-Functional Requirements (relevant categories only)
  - Format: `The system shall [metric] [condition] [measurement method]`

## Validation

```bash
bash .aped/aped-prd/scripts/validate-prd.sh docs/prd.md
```

## Output & State

1. Write PRD to `docs/prd.md`
2. Update `docs/state.yaml`:
```yaml
pipeline:
  current_phase: "prd"
  phases:
    prd:
      status: "done"
      output: "docs/prd.md"
```

## Next Step

Tell the user: "PRD is ready. Next options:"
- `/aped-ux` — Design UX (recommended for UI-heavy projects)
- `/aped-arch` — Define architecture decisions (recommended before epics)
- `/aped-epics` — Go straight to epics (if arch/UX not needed)

**Do NOT auto-chain.** The user decides when to proceed.

## Example

From a restaurant inventory brief → PRD generates:
- FR1: Manager can add inventory items with name, quantity, and unit
- FR2: Manager can set low-stock thresholds per item
- FR3: System can send alerts when stock falls below threshold
- NFR: The system shall respond to inventory queries within 200ms at p95

## Common Issues

- **FR count too low (<10)**: Brief may lack detail — re-read brief, extract implicit capabilities
- **Anti-pattern words detected**: Replace "easy" with step count, "fast" with time threshold
- **Validation script fails**: Run `bash .aped/aped-prd/scripts/validate-prd.sh docs/prd.md` — fix reported issues one by one
