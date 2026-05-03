---
step: 2
reads: 
  - "docs/**"
  - ".aped/**"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 2: Input Discovery

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The PRD is required (✱) — HALT if missing
- 🚫 Never reference the PRD in prose without loading it (causes hallucinated content)

## YOUR TASK

Discover and load upstream APED artefacts. Bias the rest of the workflow.

## DISCOVERY

### 1. Glob

Search in order: `docs/**`, `.aped/**`, `docs/**`.

Look for (✱ = required):
- PRD — `*prd*.md` or `prd.md` ✱
- Product Brief — `*brief*.md` or `product-brief.md`
- Project Context — `*context*.md` or `project-context.md`
- Research — `*research*.md`

### 2. Required-input validation

For ✱ PRD:
- Found → continue.
- Missing → HALT: *"UX design requires a PRD — every screen, journey, and FR reference is grounded in it. Run `aped-prd` first."*

### 3. Load + report

Brownfield is detected via `project-context.md` presence.

> Welcome {user_name}! Setting up `aped-ux` for {project_name}.
>
> **Documents discovered:**
> - PRD: {N} files {✓ loaded | ✱ MISSING — HALT}
> - Product Brief: {N} files {✓ loaded — informs tone | (none)}
> - Project Context: {N} files {✓ loaded (brownfield) — existing design system constraints applied | (none)}
> - Research: {N} files {✓ loaded | (none)}
>
> {if brownfield} 📋 Brownfield mode: existing UI conventions from project-context.md will constrain Assemble (design tokens, component library, framework choices). {/if}
>
> [C] Continue with these documents
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.**

### 4. Bias the rest of the workflow

- **A — Assemble**: in brownfield, design tokens and UI library inherited from `project-context.md`; confirm before overriding.
- **N — Normalize**: screens mapped from PRD user journeys; mock data uses real product names and FR-derived values, never lorem ipsum.
- **F — Fill**: every screen's content grounded in the PRD's FRs for that journey. Surface gaps to user; never invent.

## NEXT STEP

Load `.aped/aped-ux/steps/step-03-assemble.md`.
