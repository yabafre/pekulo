---
step: 6
reads:
  - ".aped/skills/aped-skills/checklist-prd.md"
writes:
  - "docs/prd.md"
  - "state.yaml#pipeline.phases.prd"
  - "mcp/aped_state.advance"
mutates_state: true
---

# Step 6: Write Output, State Update, Stop Conditions, Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 BEFORE declaring complete, Read `.aped/skills/aped-skills/checklist-prd.md` fresh
- 🚫 Do NOT auto-chain `aped-ux` / `aped-arch` / `aped-epics` — user decides
- 🚫 Stop conditions trigger immediate finalization

## YOUR TASK

Write `prd.md`, update state.yaml structured fields, surface next-step menu, walk completion gate.

## WRITE OUTPUT

Write the PRD to `docs/prd.md`.

## STATE UPDATE

**Prefer MCP**: `aped_state.advance(phase: "prd", status: "complete")`.

**Fallback**: edit `docs/state.yaml` under `pipeline.phases.prd`:

```yaml
pipeline:
  current_phase: "prd"
  phases:
    prd:
      status: "done"
      output: "docs/prd.md"
      completed_at: "<ISO 8601 now>"
      fr_count: <int>
      mode: "interactive"        # interactive | headless
```

### Field derivation

- **`fr_count`** — count `FR<N>:` headings or list items in the FR section.
- **`mode`** — `interactive` (default) or `headless` (if `--headless` flag was passed).

## STOP CONDITIONS

The PRD generation ends when ANY of these fire:

1. **User says *"done"* / *"looks good"* / *"ship it"*** — emit the file and stop.
2. **4 consecutive `[C]ontinue` without user edits** — PRD is converged; offer to finalize.
3. **All sections validated by oracle-prd.sh** — green oracle = done.
4. **Token budget > 30k consumed in this skill invocation** — warn user that continued iteration risks context degradation; offer to save and `/clear`.

## NEXT-STEP MESSAGE

> PRD is ready. Next options:
>
> - `aped-ux` — Design UX (recommended for UI-heavy projects)
> - `aped-arch` — Define architecture decisions (recommended before epics)
> - `aped-epics` — Go straight to epics (if arch/UX not needed)

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-prd.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## SUCCESS METRICS

✅ PRD written; oracle exits 0.
✅ State.yaml structured fields populated.
✅ Stop condition path appropriate.
✅ Checklist Read fresh; every item `[x]`.

## FAILURE MODES

❌ Auto-picking `[C]` to skip stop conditions — bypasses convergence detection.
❌ Forgetting `mode` field — downstream cannot detect headless vs interactive.

## DONE

Once every checklist item is `[x]`, the skill is complete.
