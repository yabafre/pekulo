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

**THE FEEDBACK LOOP IS THE SKILL.** Everything else is mechanical. If you have a fast, deterministic, agent-runnable pass/fail signal for the bug, you will find the cause — bisection, hypothesis-testing, and instrumentation all just consume that signal. Spend disproportionate effort on step 03.

### 3-failed-fixes rule (cross-skill)

If step 07 (Fix) sees three successive attempts that have not turned the original repro green, **STOP**. Three failed attempts means **your model of the cause is wrong**. Question the architecture / spec / test, not the fix.

The same rule fires in `aped-dev` (HALT condition) and `aped-review` (Step 6 routing) — definition is consistent across all three.

## Activation

Read `.aped/config.yaml` and resolve `{user_name}`, `{communication_language}`, `{document_output_language}`, `{ticket_system}`. Speak `{communication_language}`. HALT if config missing.

## Execution

Read fully and follow: `.aped/aped-debug/steps/step-01-init.md`.
