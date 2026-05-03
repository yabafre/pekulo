---
step: 2
reads: 
  - "docs/**"
  - ".aped/**"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 2: Input Discovery (no required inputs — entry point)

## YOUR TASK

Discover and load any prior artefacts. Detect brownfield vs greenfield.

## DISCOVERY

### 1. Glob

Search `docs/**`, `.aped/**`, `docs/**`.

Look for (none required — this is an entry-point skill):
- Product Brief — `*brief*.md` or `product-brief.md`
- Project Context — `*context*.md` or `project-context.md`
- Research — `*research*.md`

For sharded folders (folder with `index.md` + multiple files), load the index first.

### 2. Required-input validation

None — `aped-analyze` runs with or without prior artefacts.

### 3. Load + report

Brownfield is detected, NOT declared:
- `project-context.md` found → brownfield mode.
- Otherwise → greenfield mode.

> Welcome {user_name}! Setting up `aped-analyze` for {project_name}.
>
> **Documents discovered:**
> - Product Brief: {N} files {✓ loaded — will refine | (none — fresh analysis)}
> - Project Context: {N} files {✓ loaded (brownfield mode) | (none — greenfield)}
> - Research: {N} files {✓ loaded — will inform agents | (none)}
>
> {if brownfield} 📋 Brownfield mode: Discovery questions assume existing system; the 3 research agents receive the context as input. {/if}
>
> [C] Continue with these documents
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.** Light confirmation, not a heavy gate.

### 4. Bias the rest of the workflow

- **Step 03 (Discovery)**: skip questions already answered by loaded docs (confirm and probe deeper instead of re-asking).
- In brownfield mode, frame Discovery as *"what's NEW relative to the existing system"*.
- **Step 04 (Research agents)**: pass loaded artefacts to Mary/Derek/Tom as input context so research builds on existing analysis.

## NEXT STEP

Load `.aped/aped-analyze/steps/step-03-discovery-rounds.md`.
