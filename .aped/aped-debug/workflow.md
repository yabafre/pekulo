<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Debug — Disciplined Diagnosis Loop

**Goal:** Apply a six-phase discipline for hard bugs and performance regressions: build the loop, reproduce, hypothesise, instrument, fix + regression test, cleanup + post-mortem. Enforces the 3-failed-fixes rule, the Invocation contexts contract, defense-in-depth, and condition-based waiting.

---

## Workflow architecture

This skill uses **micro-file architecture**:

- Each step is a self-contained file with embedded rules.
- Phases 1 → 6 are sequential; the 3-failed-fixes rule can fire from step 07 back to step 03.
- Invocation context (standalone / from-dev / from-review) is detected in step 01 and changes only the entry / exit, not the phases.

### Critical rules

- **The feedback loop is the primary artefact.** Build it before anything else (step 03). Without a fast deterministic pass/fail signal, debugging is staring-at-code.
- **Change one variable at a time** during instrumentation. Observe, then decide.
- **Every fix carries a regression test** (or an explicit "no correct seam" finding).
- `[DEBUG-XXXX]` instrumentation tags are removed at step 08. Untagged probes survive; tagged probes die.

### Iron Law

**THE FEEDBACK LOOP IS THE SKILL.** See [`ETHOS.md` § aped-debug](../ETHOS.md#aped-debug) for full rationale.

### 3-failed-fixes rule (cross-skill)

If step 07 (Fix) sees three successive attempts that have not turned the original repro green, **STOP**. Three failed attempts means **your model of the cause is wrong**. Question the architecture / spec / test, not the fix.

The same rule fires in `aped-dev` (HALT condition) and `aped-review` (Step 6 routing) — definition is consistent across all three.

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

Read fully and follow: `.aped/aped-debug/steps/step-01-init.md`.
