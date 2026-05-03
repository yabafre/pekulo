---
name: aped-grill
keep-coding-instructions: true
description: 'Use when user says "grill me", "align on this", "interview me about", "get on the same page", "pin down the spec", "stress test the plan", or invokes aped-grill. Pocock-style relentless one-question-at-a-time alignment. Stops when (a) no new question for two turns, (b) token budget exceeds 25k, (c) user says stop. Emits grill-summary.md for downstream skills (aped-prd, aped-arch). Not for divergent ideation — see aped-brainstorm. Not for critique-method elicitation — see aped-elicit.'
allowed-tools: "Read Edit Write Bash Grep Glob"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.0.0
---

# APED Grill — Pocock-style alignment grilling

Pin down a half-formed product idea, plan, or refactor by asking ONE concrete question per turn. Each question targets an unstated decision the user hasn't made. Stop when the questions stop being meaningful.

## On Activation

Read `.aped/config.yaml` upfront and resolve `{user_name}` / `{communication_language}` / `{document_output_language}`. ✅ YOU MUST speak in `{communication_language}` and write `grill-summary.md` in `{document_output_language}`. HALT if config is missing.

## Inputs (consumed in this order)

1. The user's most recent message (the framing).
2. `.aped/config.yaml` (already loaded above).
3. Any prior PRD at `docs/prd.md` — load if present, never invent its content.
4. Any prior architecture at `docs/architecture.md` — load if present.
5. Any `CONTEXT.md` at the project root — load if present, treat as authoritative domain glossary.
6. The most-recent ticket if the user pasted one (LIN-/JIRA-/#NN style ID in the conversation).

If none of (3)-(6) exist, this is a cold-start grill. Surface that to the user explicitly: "No prior PRD/arch/CONTEXT loaded — grilling from scratch."

## How a good grill question is shaped

A *good* grill question (Pocock workshop L513-528):
- Surfaces a decision the user **also** has not made — they should answer "huh, hadn't thought about that".
- Concerns scope, sequencing, edge cases, or downstream consequence — never UI colour or vocabulary.
- Includes a **recommended answer** based on what's loaded so far. If the user agrees, one round done; if not, you learn the constraint that disagrees.
- Single question, single decision. No multi-part questions.

A *bad* grill question (workshop L646-649):
- Targets the wrong audience (PO-domain question to a developer; tech-debt question to a stakeholder). When in doubt: ask the user "is this question for you, or for someone else?".
- Asks for an opinion when code or a doc already answers (read first).
- Re-asks something already answered earlier in the session.

## Loop

Repeat:

1. **Ask ONE question.** Format:
   ```
   Q{N}: {question, single decision}
   Recommended: {recommended answer + 1-line rationale grounded in loaded artefacts}
   ```
2. **Wait** for user response.
3. **Tag** the response in working memory: `decided | deferred | out-of-scope`.
4. **Update** working memory with the new constraint.
5. **Check stop conditions** (next section). If none fired, generate the next question grounded in the new constraint.

## Stop conditions (any one fires)

a) **No new meaningful question for two consecutive turns.** Means: the question well is dry on what's been loaded; further grilling would either repeat or invent. Stop and write `grill-summary.md`.

b) **Token budget exceeds 25k since grill start.** Pocock's workshop ceiling (L777-787) — past 25k of grilling, returns diminish and the model enters the dumb zone (workshop L93-108: "by around 100k it starts to just get dumber"). Stop, write the summary, suggest `/clear` then `aped-prd` or `aped-arch`.

c) **User says "stop", "enough", "no more", "let's move on", "good enough", or similar.** Honour immediately, write summary.

d) **Five consecutive `out-of-scope` tags.** Means the user has reframed; current grill is no longer aligned. Stop, write summary scoped to what was decided, hand back: "Reframing detected — your scope shifted to {summary}. Continue with `aped-grill` on the new scope or `aped-brainstorm` if it's still hazy."

## Output: `grill-summary.md`

Write to `docs/grill-summary.md`. Always overwrite — last grill wins; prior grilling lives in git.

```markdown
---
generated_by: aped-grill
generated_at: <ISO 8601 now>
question_count: <int>
decided_count: <int>
deferred_count: <int>
out_of_scope_count: <int>
stop_reason: <no-new-question | token-budget | user-halt | reframing>
---

# Grill summary — {one-line scope from the user's framing}

## Decided

- {one-line decision} (Q{N})
- ...

## Deferred (still need a real-world answer)

- {one-line open question} (Q{N}) — recommended next: {who/what answers this}
- ...

## Out of scope (pinned for later)

- {one-line item} (Q{N})
- ...

## Assumptions in play

- {assumption from loaded artefact + how it influenced grilling}
- ...

## Suggested next skill

- `aped-prd` if the grilling shaped a problem statement (most common)
- `aped-arch` if the grilling shaped a technical decision (less common)
- `aped-brainstorm` if the user's reframe means we're upstream of "spec" again
- `aped-grill` again on a sharper scope if the user wants to dig further
```

## Self-review (before writing summary)

- [ ] Every `Q{N}` in the summary maps to a turn in the actual conversation — no fabricated questions.
- [ ] Every `Recommended: ...` was grounded in a loaded artefact (PRD, arch, CONTEXT, ticket) or marked "no prior input — author guess" if none was.
- [ ] No `decided` item is a paraphrase of an `assumption in play` — those are different categories.
- [ ] `Suggested next skill` is one of the four listed; do not invent a skill name.
- [ ] If `stop_reason: token-budget`, the summary is short (≤200 lines) — no point ballooning the summary that exists because we ran out of room.

## What this skill is NOT

- Not divergent ideation. Use `aped-brainstorm` to *generate* options; this skill *converges* on decisions.
- Not critique elicitation. Use `aped-elicit` to apply named methods (Socratic, Six Thinking Hats, etc.) to existing output; this skill drives forward, not back.
- Not a PRD writer. The summary it produces is **input** to `aped-prd`, not a substitute.
- Not a domain-glossary author. Use `aped-context` Phase 5 (or a future `aped-grill-with-docs`) to update CONTEXT.md inline; this skill *reads* CONTEXT.md to ground questions.

## Common Issues

- **Recommendations all parrot the user's framing back** — you skipped artefact loading. Re-read the inputs list and surface the loaded constraint as the rationale.
- **User keeps saying "I don't know"** — switch the recommendation to a default + escape hatch ("Recommended: defer to post-MVP — fine to mark deferred?") rather than continuing to push for a decision.
- **Grilling keeps drifting to UI / aesthetics** — that's signals you're past the alignment phase. Stop, write summary, hand off to `aped-ux` for the visual side.
