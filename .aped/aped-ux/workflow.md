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

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`, `{ticket_system}`, `{git_provider}`. Speak `{communication_language}`; write artefacts in `{document_output_language}`. HALT if config is missing.

## Execution

Read fully and follow: `.aped/aped-ux/steps/step-01-init.md`.
