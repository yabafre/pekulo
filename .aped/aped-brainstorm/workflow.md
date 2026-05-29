<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Brainstorm — Divergent Ideation Before Convergence

**Goal:** Run a creative-facilitator dialogue that generates 50+ ideas, then converges to 5–10 grounded survivors. Brainstorm is a **coaching dialogue**, not a generation script — present ONE element at a time, HALT, react, build.

---

## Workflow architecture

This skill uses **micro-file architecture**:

- Each step is a self-contained file with embedded rules.
- The facilitation loop (step 04) is the heart — load it once, iterate inside it.
- Spec self-review + spec-reviewer dispatch happen after convergence (step 06).

### Critical rules

- **NEVER organize or converge before the divergence quota is met** — stay in generative mode.
- **NEVER accept "I think that's enough"** before 50 ideas — the magic is in ideas 50–100.
- **NEVER generate ideas in silent batches.** ONE technique element at a time, HALT, react, move on.
- **Shift creative domain every 10 ideas** to fight LLM semantic clustering bias.
- **Capture every idea verbatim**, even the bad ones — they feed better ones.
- **No time estimates, no effort sizing** during brainstorm — that's for later phases.

### Guiding principles

1. **Quantity Before Quality** — first 20 are obvious; 50–100 is where the breakthrough lives.
2. **Anti-Bias Protocol** — every 10 ideas, force an orthogonal domain shift (technical → UX → business → edge case).
3. **Help the user think, don't just ask** — offer concrete suggestions to react to.
4. **Divergence first, convergence later** — resist evaluation during divergence.

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

Read fully and follow: `.aped/aped-brainstorm/steps/step-01-init.md`.
