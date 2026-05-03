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
- 🛑 If `pipeline.phases.architecture.status: done` AND no architecture file is found → HALT
- 📖 Load every discovered file completely (no offset/limit)

## CONTEXT BOUNDARIES

- Pipeline state checked.
- Task tracking initialized.

## YOUR TASK

Discover and load every upstream APED artefact. Validate required inputs. Bias the rest of the workflow with what was loaded.

## DISCOVERY

### 1. Glob

Search these locations in order:

- `docs/**`
- `.aped/**`
- `docs/**` (project root)

Look for these artefacts (✱ = required):

- PRD — `*prd*.md` or `prd.md` ✱
- UX Spec — `ux/*.md` or `*ux-design*.md` (sharded folder with design-spec, screen-inventory, components, flows)
- Architecture — `*architecture*.md` or `architecture.md`
- Product Brief — `*brief*.md` or `product-brief.md`
- Project Context — `*context*.md` or `project-context.md`

For the UX spec folder, load every file (`design-spec.md`, `screen-inventory.md`, `components.md`, `flows.md`).

### 2. Required-input validation (hard-stop)

For ✱ PRD:
- Found → extract ALL FRs and NFRs by number.
- Missing → HALT: *"Epic decomposition requires a PRD. Every epic and story maps back to FRs/NFRs. Run `aped-prd` first, or provide the PRD file path."*

For Architecture (conditional ✱ — required when state declares it `done`):
- Read `pipeline.phases.architecture.status` from `docs/state.yaml`. If absent, treat architecture as deliberately skipped — continue without HALT.
- If `done` AND no architecture file in glob → HALT: *"state.yaml records `pipeline.phases.architecture.status: done`, but no architecture file was found. Re-run `aped-arch` to regenerate it, or set status to `skipped` in state.yaml if architecture was deliberately skipped."*
- If `done` AND architecture is found → continue. Architecture informs story splitting in step 04.

### 3. Load + report

Load every discovered file completely. Brownfield is detected via `project-context.md` presence.

Present a discovery report (adapt to `communication_language`):

> Welcome {user_name}! Setting up `aped-epics` for {project_name}.
>
> **Documents discovered:**
> - PRD: {N} files {✓ loaded — {M} FRs / {K} NFRs extracted | ✱ MISSING — HALT}
> - UX Spec: {N} files {✓ loaded — stories enriched with screens/components | (none)}
> - Architecture: {N} files {✓ loaded — tech decisions inform story splitting | (none)}
> - Product Brief: {N} files {✓ loaded | (none)}
> - Project Context: {N} files {✓ loaded (brownfield) | (none)}
>
> **Files loaded:** {comma-separated filenames}
>
> {if brownfield} 📋 Brownfield mode: existing system context loaded. Story splitting will favour additive work over rewriting. {/if}
>
> [C] Continue with these documents
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.**

### 4. Bias the rest of the workflow

- Epic grouping respects user-value domains from the PRD's user journeys.
- When UX is loaded, stories reference concrete screens, components, flows.
- When architecture is loaded, story 1 of an epic may be technical foundation when decisions imply it.
- In brownfield mode, the first epic typically integrates with existing modules listed in `project-context.md`.

## SUCCESS METRICS

✅ PRD loaded with FR/NFR counts.
✅ Architecture conditional handled (HALT or continue with `architecture.md` loaded).
✅ Discovery report shown; user `[C]` confirmed.

## FAILURE MODES

❌ Skipping the PRD — there's nothing to decompose.
❌ Treating `pipeline.phases.architecture.status: done` with missing file as a soft warning — it's a HALT.

## NEXT STEP

Load `.aped/aped-epics/steps/step-03-fr-extraction-and-file-design.md`.
