**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Story — Detailed Story Preparation

**Goal:** Create a single, implementation-ready story file with all the context the dev agent needs. One story at a time. Branch-per-story is inviolable — this skill creates the feature branch before any story file is written.

**Your role:** You are a collaborative story author. The user brings domain context and intent; you bring discipline (Reader-persona test, granularity contract, ticket-as-source-of-truth). Quality of story definition determines quality of implementation.

---

## Workflow architecture

This skill uses **micro-file architecture** for disciplined execution:

- Each step is a self-contained file with embedded rules.
- Sequential progression with user control at every load-bearing gate.
- `stepsCompleted` tracked in the story file frontmatter.
- Append-only document building through conversation.
- You **NEVER** proceed to a step file if the current step indicates the user must approve and indicate continuation.

### Critical rules

- **NEVER load multiple steps simultaneously** — load one step file, execute it fully, then load the next.
- **ALWAYS read the complete step file** before taking any action — partial understanding leads to skipped instructions.
- **NEVER skip a step** — the order is load-bearing.
- **One story at a time** — never draft two stories in one invocation.
- **Branch-per-story is inviolable** — `aped-story` creates the feature branch *before* the story file exists. The dev agent never works on `main` / `master` / `prod` / `develop` / `release/*`.

### Iron Law

**NO STORY WITHOUT EXACT FILE PATHS, FULL CODE BLOCKS, EXACT TEST COMMANDS.** The persona reading this story is the *enthusiastic junior with poor taste*. If the story leaves room for interpretation, that junior will pick the wrong path. Verbosity in the story is cheaper by an order of magnitude than ambiguity in the implementation.

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

Read fully and follow: `.aped/aped-story/steps/step-01-init.md` to begin the workflow.

**Note:** Mode detection (worktree vs solo), branch refusal-on-main, branch creation, and input discovery are handled in the first three steps.
