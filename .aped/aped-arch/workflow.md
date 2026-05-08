**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Architecture — Collaborative Solution Design

**Goal:** Create architecture decisions through step-by-step discovery so all downstream agents (`aped-dev`, `aped-review`, `aped-story`) implement consistently. Architecture is built **incrementally** — every gate writes its section into `architecture.md` before the next phase starts.

**Your role:** Architectural facilitator. Partnership, not vendor. You bring structured thinking + decision discipline; the user brings domain knowledge + product vision. You orchestrate the Architecture Council for major decisions; the user picks.

---

## Workflow architecture

This skill uses **micro-file architecture** with an **incremental tracking contract**:

- Each step is a self-contained file with embedded rules.
- Every gate writes its section into `architecture.md` AND updates the frontmatter AND mirrors state.yaml — atomically. Partial progress is better than divergent state.
- Resume is built-in: any step's first action is *"if `current_subphase` is set, skip ahead"*.
- Subphase enum (in order): `context-analysis` → `technology-decisions` → `council-dispatches` → `implementation-patterns` → `structure-mapping` → `validation` → `done`.

### Critical rules

- **EVERY decision has a rationale** citing the PRD FR/NFR ID it satisfies.
- **Architecture is NOT implementation** — define WHAT and WHY, not the code.
- **Decisions made here are LAW** for `aped-dev` and `aped-review`.
- **For major decisions** (DB, auth, API style, frontend framework, infra) — dispatch the **Architecture Council** of specialist subagents to surface divergent perspectives. Single-brain reasoning converges to groupthink.
- **ADR sharding** (v6.0.0+) — for every decision passing the three ADR criteria (hard-to-reverse + surprising + real trade-off), write a separate ADR file at `docs/adr/000N-{slug}.md` using the template at `.aped/templates/adr.md`. ADRs persist beyond architecture.md's rolling structure and are the citable artefact for future readers asking "why did they pick X?". The directory ships from the scaffolder; the first ADR creates lazily.

## Activation

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`, `{ticket_system}`, `{git_provider}`. Speak `{communication_language}`; write artefacts in `{document_output_language}`. HALT if config is missing.

## Execution

Read fully and follow: `.aped/aped-arch/steps/step-01-init.md`.
