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

- 🛑 The Product Brief is required (✱) — HALT if missing
- 📖 Load every discovered file completely

## YOUR TASK

Discover and load upstream artefacts; bias the rest of the workflow.

## DISCOVERY

### 1. Glob

Search in order: `docs/**`, `.aped/**`, `docs/**`.

Look for (✱ = required):
- Product Brief — `*brief*.md` or `product-brief.md` ✱
- Project Context — `*context*.md` or `project-context.md`
- Research — `*research*.md`

### 2. Required-input validation

For ✱ Product Brief:
- Found → continue.
- Missing → HALT: *"PRD generation requires a Product Brief. Run `aped-analyze` first."*

Do NOT auto-generate a missing brief.

### 3. Load + report

Brownfield is detected via `project-context.md` presence.

> Welcome {user_name}! Setting up `aped-prd` for {project_name}.
>
> **Documents discovered:**
> - Product Brief: {N} files {✓ loaded | ✱ MISSING — HALT}
> - Project Context: {N} files {✓ loaded (brownfield mode) | (none)}
> - Research: {N} files {✓ loaded | (none)}
>
> {if brownfield} 📋 Brownfield mode: NFRs and architectural constraints from existing system will bias FR formulation. {/if}
>
> [C] Continue with these documents
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.** (Skip in headless mode.)

### 4. Bias the rest of the workflow

- FRs are extracted from the brief's MVP scope and refined against research findings.
- Domain detection uses the brief plus research that flagged compliance signals.
- In brownfield mode, NFRs include constraints inherited from the existing system.

## NEXT STEP

Load `.aped/aped-prd/steps/step-03-foundation-and-scope.md`.
