<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Analyze — Parallel Research to Product Brief

**Goal:** Convert a project idea into a validated product brief through 4 conversational discovery rounds + 3 parallel research agents (Mary / Derek / Tom). Discovery is the foundation — pay 10× downstream.

---

## Workflow architecture

This skill uses **micro-file architecture**:

- 4 Discovery rounds in step 03; the catch-all HALT after each round catches side observations.
- 3 research agents (Mary, Derek, Tom) dispatched in PARALLEL in step 04.
- Synthesis writes the brief; spec-reviewer dispatched before user approval.

### Critical rules

- **NEVER skip Discovery** — research quality depends on clear inputs.
- **ALL 3 agents must complete** before synthesis — no partial results.
- **Help the user think, don't just ask** — probe deeper on vague answers.
- **Research informs, user decides.**

## Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Execution

Read fully and follow: `.aped/aped-analyze/steps/step-01-init.md`.
