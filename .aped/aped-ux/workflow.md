<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED UX — ANF Framework

**Goal:** Produce a validated, interactive React prototype from the PRD. The prototype becomes the UX spec that `aped-epics` consumes as the visual source of truth.

**ANF = Assemble → Normalize → Fill**:
- **A**ssemble: design DNA (inspirations, UI library, tokens, branding) + scaffold preview app.
- **N**ormalize: layout + navigation + screens with REAL content (no lorem ipsum).
- **F**ill: complete states (loading, error, empty), responsive, dark mode, accessibility, user review.

---

## Workflow architecture

This skill uses **micro-file architecture**:

- Each step is a self-contained file with embedded rules.
- Sequential progression — no auto-chain.
- The user review cycle (step 06) is the load-bearing gate — never skip.
- Output (step 07) writes the 4-file UX spec PLUS keeps the live preview app for downstream React Grab inspection.

### Critical rules

- **NEVER use lorem ipsum** — every text element must reflect the actual product from the PRD.
- **ALWAYS run the pre-delivery checklist** before presenting to the user.
- **Take time per screen** — quality > speed.
- **Do NOT skip the user review cycle** — the prototype MUST be approved before proceeding.

## Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in EVERY message to the user — progress lines, tool preambles, summaries, and questions all included. This overrides your default; never narrate in English when `{communication_language}` is not English.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Execution

Read fully and follow: `.aped/aped-ux/steps/step-01-init.md`.
