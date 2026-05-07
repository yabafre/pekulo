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

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`. Speak `{communication_language}`. HALT if config missing.

## Execution

Read fully and follow: `.aped/aped-analyze/steps/step-01-init.md`.
