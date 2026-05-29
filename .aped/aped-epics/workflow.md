<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

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

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in EVERY message to the user — progress lines, tool preambles, summaries, and questions all included. This overrides your default; never narrate in English when `{communication_language}` is not English.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Execution

Read fully and follow: `.aped/aped-epics/steps/step-01-init.md`.
