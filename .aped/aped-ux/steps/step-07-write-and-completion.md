---
step: 7
reads:
  - ".aped/skills/aped-skills/checklist-ux.md"
  - ".aped/aped-ux/scripts/validate-ux.sh"
writes:
  - "docs/ux/design-spec.md"
  - "docs/ux/screen-inventory.md"
  - "docs/ux/components.md"
  - "docs/ux/flows.md"
  - "state.yaml#pipeline.phases.ux"
  - "mcp/aped_state.advance"
mutates_state: true
---

# Step 7: Write UX Spec, Validate, Update State, Completion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The preview app stays at `docs/ux-preview/` — it's the live source of truth
- 🛑 BEFORE declaring complete, Read `.aped/skills/aped-skills/checklist-ux.md` fresh
- 🚫 Do NOT auto-chain `aped-arch` or `aped-epics` — the user decides

## YOUR TASK

Write the 4-file UX spec, run validation, update state.yaml, walk the completion gate.

## OUTPUT — 4 FILES

```bash
mkdir -p docs/ux
```

1. **`docs/ux/design-spec.md`** — design tokens (colors, typo, spacing, radius), UI library + version, screen inventory with routes, component tree with props, layout specifications, responsive breakpoints.
2. **`docs/ux/screen-inventory.md`** — all screens with FR mapping (PRD FR IDs verbatim).
3. **`docs/ux/components.md`** — component catalog from the preview app.
4. **`docs/ux/flows.md`** — navigation flow diagrams.

The preview app at `docs/ux-preview/` IS the source of truth for downstream skills. Use React Grab to inspect it rather than static screenshots.

## VALIDATION

```bash
bash .aped/aped-ux/scripts/validate-ux.sh docs/ux
```

If validation fails: fix missing files or content and re-validate.

## STATE UPDATE

**Prefer MCP**: `aped_state.advance(phase: "ux", status: "done")`.

**Fallback**: edit `docs/state.yaml`:

```yaml
pipeline:
  current_phase: "ux"
  phases:
    ux:
      status: "done"
      output: "docs/ux/"
      preview: "docs/ux-preview/"
      design_system:
        ui_library: "{library}"
        tokens: "docs/ux-preview/src/tokens/"
```

## NEXT-STEP MESSAGE

> UX design is ready. Run `aped-arch` to design the architecture (or `aped-epics` if architecture has already been done).

The next phase reads `docs/ux/` (all 4 spec files) and inspects the live preview app via React Grab to enrich stories with component / screen / token references.

**Do NOT auto-chain.**

## COMPLETION GATE

1. Read `.aped/skills/aped-skills/checklist-ux.md` fresh.
2. Walk every item; flip each to `[x]` only when satisfied.
3. If any item is unchecked, return to the relevant step.

## SUCCESS METRICS

✅ 4 spec files written and pass `validate-ux.sh`.
✅ Preview app at `docs/ux-preview/` left intact.
✅ State advanced to `done`.
✅ Checklist Read fresh; every item `[x]`.

## FAILURE MODES

❌ Deleting the preview app — downstream loses React Grab inspection capability.
❌ Skipping `validate-ux.sh` — `aped-epics` cannot consume malformed UX spec.
❌ Auto-chaining — bypasses user gate.

## DONE

Once every checklist item is `[x]`, the skill is complete.
