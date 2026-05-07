---
name: aped-zoom-out
keep-coding-instructions: true
description: 'Use when user says "zoom out", "step back", "take a step back", "broader view", "wider context", "lost the thread", "are we still solving the right problem", or invokes aped-zoom-out. Horizontal — invokable at any phase. Not for sprint progress dashboards (see aped-status) or for diff walks (see aped-checkpoint).'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.3.2
---

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Zoom Out — Step Back

Stop the current task. Look at the broader project context. Ask out loud: "Are we still solving the right problem?"

Read recent state (`docs/state.yaml`), recent decisions (top of `docs/lessons.md`, recent commits via `git log --oneline -20`), and the original goal (PRD, brief, ticket, or user's first message in this session). Compare what is being implemented now to that original goal. If they have drifted, surface the drift to the user *before* writing more code.

**Missing artefacts are signal, not error.** If `state.yaml` is absent, the project is pre-pipeline — say so and zoom out from `lessons.md` + git log + first user message only. If `lessons.md` is absent, say "no logged decisions" rather than inventing one. The four bullets below should always cite the source they drew from; bullets backed by *no* source are forbidden.

This skill produces no artefact. Its only output is the agent's re-orientation message to the user — a 4-bullet summary:
- **Where we started:** original goal, in one sentence.
- **Where we are:** what got done, in one sentence.
- **Drift, if any:** divergence between the two, with file/decision pointers.
- **Recommendation:** continue / re-anchor / stop and re-PRD.

Use this when you sense the implementation has been deep in details too long and the original framing is fading. Keep the answer to two sentences — brevity is the whole point.

## No State Change

Zoom-out is read-only. It does not advance pipeline state, does not write artefacts, does not modify state.yaml.
