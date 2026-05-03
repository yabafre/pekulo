# Pekulo

Goal-based personal finance app — Persona #1: Alex.

<!-- APED:START -->
## APED Method — disciplined user-driven pipeline

Pipeline: **Analyze → PRD → UX → Architecture → Epics → Story → Dev → Review**.

### Skill invocation

If there's **even a 1% chance** an APED skill applies, invoke it via the Skill tool. Use natural-language phrases ("create the prd", "review this branch", "kick off dev") — the runtime routes by the skill's `description:`. Do not paraphrase what you think the skill would say.

User instructions in CLAUDE.md or `aped/config.yaml` override skill defaults. Record overrides; don't bake them into new skills.

Full catalog: `.aped/skills/SKILL-INDEX.md`.

### APED rules

- **No auto-chain.** Each skill ends with "Run aped-X when ready." Wait for user.
- **Gates are mandatory.** When a skill says "⏸ HALT" or "⏸ GATE", wait for explicit user confirmation regardless of harness auto-mode. Auto-mode never bypasses APED gates.
- **Validate before persisting** to `docs/`.
- **Story-driven dev.** No code without a story file. Use `aped-story` first.
- **Frontend = visual verification.** Use `mcp__react-grab-mcp__get_element_context` at every GREEN.

### State

- Engine: `.aped/` (immutable) · Artifacts: `docs/` (evolves)
- State: `docs/state.yaml` · Lessons: `docs/lessons.md`
- Project: Pekulo (Alex, french)
<!-- APED:END -->
