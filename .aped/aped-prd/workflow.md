<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED PRD — Section-by-Section PRD Authoring

**Goal:** Author a PRD section by section with the A/P/C menu after each section. The PRD is treated as LAW by every downstream skill (`aped-arch`, `aped-epics`).

---

## Workflow architecture

This skill uses **micro-file architecture**:

- Each step is a self-contained file with embedded rules.
- Section gates (A/P/C menus) are load-bearing — never auto-pick `[C]`.
- Headless mode (`--headless` / `-H`) skips menus; default is interactive.

### Critical rules

- **EVERY FR follows format**: `FR#: [Actor] can [capability]` — no exceptions.
- **Range:** 10–80 FRs, each independently testable.
- **Domain detection** determines mandatory sections.
- **Validate before writing** — quality > speed.
- **Interactive mode is the default.** Generate ONE section, present it, ⏸ HALT with the A/P/C menu. Headless is opt-in.

### Iron Law

**NO PRD SHIPPED WITH PLACEHOLDERS.** See [`ETHOS.md` § aped-prd](../ETHOS.md#aped-prd) for full rationale.

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

Read fully and follow: `.aped/aped-prd/steps/step-01-init.md`.
