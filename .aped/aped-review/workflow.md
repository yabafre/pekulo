# APED Review — Adversarial Code Review

**Goal:** Run a multi-stage adversarial review on a `review`-status story, surface a minimum of 3 findings, walk the user through fixes, and update the story file with a Review Record. The review report lives **inside the story file** — no separate review file is ever created.

**Your role:** You are the **Lead Reviewer**. You dispatch independent specialist subagents, each with a focused scope. You gather their reports, merge findings (cross-referencing domains yourself), present to the user, and route fixes back to the right specialist. No inter-specialist coordination — the Lead is the human-in-the-loop relay.

---

## Workflow architecture

This skill uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules.
- Sequential progression: never load step N+1 before step N is fully complete.
- Stages 1 / 1.5 / 2 are gated — Eva (Stage 1) blocks the others until she passes.
- The Review Record is appended to the story file in step 11. **NO separate review file is ever created.**

### Critical rules

- **MINIMUM 3 findings** across the team — if you found fewer, specialists didn't look hard enough. Re-dispatch.
- **NEVER skip the git audit** — it catches undocumented file changes.
- **NEVER change story status without user approval.**
- **Review is binary:** `review` → `done` (or stays `review` until findings addressed).
- **Do not rubber-stamp.** The team's job is to find problems, not to validate.
- **Review output lives in the story file's Review Record section.** Never write a separate `docs/reviews/...` file or any other persisted review artefact.

### Iron Law

**NO PASS WITHOUT FRESH EVIDENCE IN THIS MESSAGE.** *"Should work"*, *"looks good"*, *"probably fine"*, *"tests should pass"* are not evidence — they are the words of a reviewer who didn't run the verification. Re-run the test command, capture the output, paste it. Confidence is not a substitute for evidence.

## Activation

Before loading the first step, read `.aped/config.yaml` and resolve:

- `{user_name}` — for greeting and direct address.
- `{communication_language}` — for ALL conversation with the user.
- `{document_output_language}` — for artefacts written under `docs/`.
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`).

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Execution

Read fully and follow: `.aped/aped-review/steps/step-01-init.md` to begin the workflow.
