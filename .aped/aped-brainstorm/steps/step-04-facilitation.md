---
step: 4
reads:
  - "docs/brainstorm/session-{date}.md"
writes:
  - "docs/brainstorm/session-{date}.md"
mutates_state: false
---

# Step 4: Phase 3 — Interactive Facilitation (the heart of brainstorming)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 ONE technique element at a time. HALT after each. Never batch.
- 🛑 Quota: minimum 50 ideas, target 100, hard stop on `[D]` Done OR `[C]` Converge AND quota ≥ 50
- 🚫 NEVER generate before user reacts to the previous element

## YOUR TASK

Run the coaching dialogue: present ONE element, HALT, react to user, capture ideas, energy-checkpoint every 4–5 exchanges, anti-bias pivot every 10 ideas.

## IDEA CAPTURE FORMAT

```markdown
**[Category #N]** {Mnemonic Title}
- Concept: {2-3 sentence description}
- Novelty: {what makes this different from the obvious answer}
```

## PER-TECHNIQUE LOOP

### 4.1 Present ONE element

Pick the first element of the chosen technique. Frame it in one sentence. Ask one open question.

> Example (SCAMPER → Substitute): *"What's one thing in the current overlay role that, if you swapped it for something completely different, would change the product's identity? No filter — first thing that comes to mind?"*

⏸ **HALT — wait for the user's response. Do not generate ideas before they speak.**

### 4.2 Coach based on their response

- **Basic answer** (*"I dunno, maybe X"*) → dig: *"Tell me more about {aspect}. What would that look like in practice?"*
- **Detailed answer** (a real concept) → build: *"Love that {specific insight}. What if we pushed it further — what's the {extension/inversion/extreme version} of that?"* Add ONE AI-generated extension idea on top of theirs (not a flood of 10 alternatives).
- **Stuck** (*"I don't know"*) → seed: *"No worries. Let me suggest an angle: {one concrete starting point tied to their frame}. Reaction — yes / no / shift?"*

Capture each idea in the IDEA TEMPLATE format.

### 4.3 Energy checkpoint (every 4–5 exchanges)

> *"We've captured {N} ideas across {short list of themes}. Quick check:*
> *[K] Keep pushing this angle*
> *[S] Switch to the next technique element*
> *[P] Pivot — anti-bias forces an orthogonal domain*
> *[D] Done with this technique → end-of-technique menu"*

⏸ **HALT — do not pick for the user.** Default if user is silent or says *"continue"* → `[K]`.

### 4.4 Anti-bias domain pivot (auto every 10 ideas)

Independent of user-driven energy checkpoint: every 10 ideas captured, internally check what domain the recent ideas cluster in and force the next prompt into an orthogonal domain. Announce:

> *"We've stacked up on the {detected} angle. Pivoting to {orthogonal: user / business / infra / legal / brand} — fresh lens helps avoid semantic clustering."*

This is automatic, not a HALT.

## END-OF-TECHNIQUE MENU

When the technique has covered all its core elements (or user picks `[D]` Done in 4.3):

```
Technique {name} complete — {N} ideas captured.

Choose next move:
[K] Keep exploring this technique
[T] Try a different technique
[A] Advanced elicitation — call aped-elicit on the strongest 1-2 ideas
[B] Take a break (save and pause)
[C] Converge — quota met → Phase 4
```

⏸ **HALT — wait for user choice.** If quota < 50, prefer `[K]` or `[T]`; if ≥ 50, all options reasonable.

## FREEZE HANDLERS

- **User freezes** (2 consecutive empty / *"I don't know"*) → drop the element, offer 3 concrete alternatives, OR suggest technique switch via `[T]`, OR inject random stimulus.
- **YOU freeze** (no decent prompt) → shift the lens (user → business → engineer → skeptic), shift the time horizon (now → 1 year → 100 years), or shift the scale (one user → million users → infinite resources).

## NEXT STEP

When `[C]` Converge selected and quota ≥ 50, load `.aped/aped-brainstorm/steps/step-05-convergence.md`.
