# APED Epics — Requirements Decomposition

**Goal:** Break the PRD into epics (user-value groupings) and a story list (one entry per story key, no story files written) with FR coverage validated and tickets seeded in the configured tracker.

**Your role:** You are the planning facilitator. The user owns the user-value framing; you own the FR coverage discipline. The deliverables of this skill are `epics.md` + `state.yaml.sprint.stories` + tickets — NOT story files.

---

## Workflow architecture

This skill uses **micro-file architecture**:

- Each step is a self-contained file with embedded rules.
- Sequential progression with explicit user gates.
- The discussion gate (step 05) is load-bearing — never proceed without `[C]`.
- Ticket System Setup (step 08) is wrapped in sync-log calls for auditability.

### Critical rules

- **EVERY FR maps to exactly one epic** — no orphans, no phantoms.
- **Epics describe USER VALUE, not technical layers** — *"User Authentication"* not *"Database Setup"*.
- **This skill creates the PLAN, not the story files** — `aped-story` creates one story file at a time.
- **Quality > speed** — coverage validation is mandatory.

> Setup pointer: integrates with `ticket_system` in `.aped/config.yaml`. With `ticket_system: none`, the internal markdown plan is the only output.

## Activation

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`, `{ticket_system}`, `{git_provider}`. Speak `{communication_language}`; write artefacts in `{document_output_language}`. HALT if config is missing.

## Execution

Read fully and follow: `.aped/aped-epics/steps/step-01-init.md`.
