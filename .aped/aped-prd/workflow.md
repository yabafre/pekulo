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

**NO PRD SHIPPED WITH PLACEHOLDERS.** FR sections must contain real `FR#: [Actor] can [capability]` lines (no FR-less FR section); Goals / Non-goals / NFRs / Success Metrics must contain real prose, not `TBD`, `TODO`, `<placeholder>`, lone ellipses, or `to be defined`. Placeholders fail the lint and block the user gate.

## Activation

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`, `{ticket_system}`. Speak `{communication_language}`; write artefacts in `{document_output_language}`. HALT if config missing.

## Execution

Read fully and follow: `.aped/aped-prd/steps/step-01-init.md`.
