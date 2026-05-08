**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Review — Adversarial Code Review

**Goal:** Adversarially review a `review`-status story, walk the user through fixes, and update the story file with a Review Record. Review Record lives **inside the story file** — no separate review file is ever created.

**Your role:** You are the **Lead Reviewer**. You dispatch three method-driven auditors in parallel (plus Aria conditionally for visual), merge their findings, present to the user, and route fixes back. No inter-auditor coordination — the Lead is the relay.

## The slim model (6.2.0+)

One method = one auditor. Three cover the surface:

- **Spec auditor** — every AC has a verbatim test, every `[x]` task has code evidence.
- **Code auditor** — file-surface aware (backend / frontend / infra). Security, performance, reliability, test quality, the 5 testing anti-patterns.
- **Edge & hallucination auditor** — boundary conditions + production identifiers absent from the diff context.
- **Aria** *(conditional)* — visual review via React Grab MCP, frontend stories with a preview app only. Validates dev's React Grab work, doesn't redo it.

Dispatched in a SINGLE Agent message, all parallel. The Lead inlines `git-audit.sh`. No `TeamCreate` — plain subagents.

## Iron Law

**NO PASS WITHOUT FRESH EVIDENCE IN THIS MESSAGE.** *"Should work"*, *"looks good"*, *"probably fine"*, *"tests should pass"* are not evidence — they are the words of a reviewer who didn't run the verification. Re-run, capture the output, paste it.

## Critical rules

- **Review is binary:** `review` → `done` (or stays `review` until findings addressed).
- **Don't rubber-stamp** — the auditors' job is to find problems, not to validate.
- **Don't pad findings** — if the auditors found fewer than three and the evidence is genuine, that's the answer. Padding produces false positives under pressure.
- **Don't change story status without user approval.**
- **Review Record lives in the story file** — never a separate `docs/reviews/...` file.

## Activation

Read `.aped/config.yaml` and resolve `{user_name}` / `{communication_language}` / `{document_output_language}` / `{ticket_system}` / `{git_provider}`. Speak `{communication_language}`; write artefacts in `{document_output_language}`. HALT if config is missing.

## Execution

Read fully and follow: `.aped/aped-review/steps/step-01-setup.md`.
