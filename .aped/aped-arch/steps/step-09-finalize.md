---
step: 9
reads: []
writes:
  - "docs/architecture.md"
  - "state.yaml#pipeline.phases.architecture"
mutates_state: true
---

# Step 9: Finalisation (state structured fields, NOT regeneration)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 `architecture.md` is already populated by per-gate appends; this step is FINALISATION
- 🛑 Do NOT regenerate `architecture.md` — fill any incomplete section in place
- 🚫 NEVER blow away `councils_dispatched` / `adrs` lists — they're append-only across the run

## CONTEXT BOUNDARIES

- All 5 phases validated and written.
- Self-review + final A/C gate passed.
- `current_subphase: validation`.

## YOUR TASK

Populate Phase 5 results, bump frontmatter to `done`, write structured state fields.

## 1. Populate Phase 5 results

Append the coherence checklist results from step 08 under `## Phase 5 — Validation` in `architecture.md`.

## 2. Bump frontmatter

```yaml
current_subphase: done
completed_subphases: [...all that actually ran...]
last_updated: <ISO 8601 now>
```

## 3. State.yaml — structured fields

**Prefer MCP**: `aped_state.advance(phase: "arch", status: "done")` plus `aped_state.update` for the structured fields below.

**Fallback**: edit `docs/state.yaml` under `pipeline.phases.architecture`:

```yaml
pipeline:
  current_phase: "architecture"
  phases:
    architecture:
      status: "done"
      current_subphase: "done"
      completed_subphases: [context-analysis, technology-decisions, implementation-patterns, structure-mapping, validation]
      output: "docs/architecture.md"
      last_updated: "<ISO 8601 now>"
      mode: "interactive"            # interactive | headless
      councils_dispatched:
        - id: "D1"
          subject: "<one-line decision name>"
          specialists: ["winston", "lena", "raj"]
          verdict: "<final pick + 1-line rationale>"
      adrs:
        - id: "ADR-001"
          subject: "<one-line subject>"
          path: "docs/adr/001-<slug>.md"
          author: "<persona/specialist or human>"
      watch_items: <int>
      residual_gaps: <int>
      epic_zero_stories: <int>
```

`completed_subphases` includes `council-dispatches` only if at least one major decision ran through Council.

### Field derivation

- **`mode`** — `interactive` (default) or `headless` if a `--headless` flag was passed.
- **`councils_dispatched`** — populated incrementally by step 05's gate; just verify the list at finalisation. NEVER rewrite past entries.
- **`adrs`** — populated as ADRs are written. NEVER rewrite past entries.
- **`watch_items`** — count of W-items in `architecture.md` §6 (Watch Items / risks).
- **`residual_gaps`** — count of G-items in `architecture.md` §7 (Residual Gaps).
- **`epic_zero_stories`** — count of E0.x stories in `architecture.md` §8 (Epic Zero / foundation stories).

If §6 / §7 / §8 don't exist, set the corresponding field to `0` — the field is mandatory but the value can be zero.

## SUCCESS METRICS

✅ Phase 5 results populated.
✅ Frontmatter bumped to `current_subphase: done`.
✅ State.yaml structured fields written (or MCP advance succeeded).
✅ `councils_dispatched` and `adrs` lists preserved (not overwritten).

## FAILURE MODES

❌ Regenerating `architecture.md` from scratch — loses incremental write trail.
❌ Forgetting `mode` field — downstream tooling cannot detect headless vs interactive.
❌ Setting `councils_dispatched: []` on finalisation — overwrites the run's actual dispatches.

## NEXT STEP

Load `.aped/aped-arch/steps/step-10-completion.md`.
