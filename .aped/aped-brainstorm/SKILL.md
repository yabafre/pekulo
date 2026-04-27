---
name: aped-brainstorm
description: 'Structured brainstorming with diverse creative techniques to generate 100+ ideas before convergence.'
when_to_use: 'Use when user says "brainstorm", "help me ideate", "explore ideas". Runs before /aped-analyze when the idea is still fuzzy.'
argument-hint: "[topic]"
allowed-tools: Read Write Edit Glob Grep Bash TaskCreate TaskUpdate
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Brainstorm — Divergent Ideation Before Convergence

## Critical Rules

- NEVER organize or converge before the divergence quota is met — stay in generative mode
- NEVER accept "I think that's enough" before 50 ideas — the magic is in ideas 50-100
- Shift creative domain every 10 ideas to fight LLM semantic clustering bias
- Capture every idea verbatim, even the bad ones — they feed better ones
- No time estimates, no effort sizing during brainstorm — that's for later phases

## Guiding Principles

### 1. Quantity Before Quality
The first 20 ideas are obvious. Ideas 20-50 require effort. Ideas 50-100 are where the breakthrough lives. Never settle before the quota — push through the "I've run out of ideas" wall at least twice.

### 2. Anti-Bias Protocol
LLMs drift toward semantic clustering (similar ideas chain together). Every 10 ideas, force an orthogonal domain shift: if you've been in technical, pivot to UX. If UX, pivot to business model. If business model, pivot to edge cases or black swans.

### 3. Help the User Think, Don't Just Ask
Many users know what they want but struggle to articulate. Your job is to offer concrete suggestions they can react to, not just repeat "what else?" When stuck, draft 2-3 alternatives yourself — the user sharpens faster with something to push against than with silence.

### 4. Divergence First, Convergence Later
Resist the urge to evaluate, prioritize, or cluster during divergence. Write ideas down, keep moving. Convergence is a separate phase at the end.

## Setup

1. Read `.aped/config.yaml` — extract `user_name`, `communication_language`
2. Check for an existing session file: `docs/brainstorm/session-{date}.md`
   - If one exists and is <7 days old: ask user — resume or start fresh?
3. Ensure output directory exists:
   ```bash
   mkdir -p docs/brainstorm
   ```
4. If the user passed a topic argument, use it. Otherwise ask: "What are we brainstorming today? One sentence."

## Phase 1: Framing

Before diverging, lock the frame in 3 questions (adapt to `communication_language`):

- **Target:** What are we generating ideas about? (a feature, a business model, a technical approach, a user persona?)
- **Lens:** From whose perspective? (user, business, engineer, skeptic?)
- **Constraints:** Any hard constraints to keep in mind? (none, a specific platform, a budget, a deadline)

Write the frame at the top of `docs/brainstorm/session-{date}.md`:
```markdown
# Brainstorm — {topic}
Date: {date}
Target: {what}
Lens: {perspective}
Constraints: {list}
Techniques used: []
Total ideas: 0
```

⏸ **GATE: Confirm the frame with the user before diverging.**

## Phase 2: Technique Selection

Pick a technique based on the frame. Suggest 3 options, let the user pick one. If they're unsure, pick for them and explain why.

### Technique Library

| Technique | Best For | How It Works |
|---|---|---|
| **SCAMPER** | Improving an existing concept | Substitute / Combine / Adapt / Modify / Put to other use / Eliminate / Reverse — 7 lenses |
| **What If Scenarios** | Exploring possibility space | "What if X were 10x cheaper?" "What if users had infinite time?" Push extremes |
| **Reverse Engineering** | Goal is clear, path is not | Start from desired end state, walk backwards to now |
| **Random Input Stimulus** | Stuck in a rut | Pick a random word/concept, force connections to the topic |
| **5 Whys** | Root-causing a problem | Start with the symptom, ask why 5 times |
| **First Principles** | Breaking received wisdom | Strip assumptions, rebuild from physics/logic |
| **Pre-mortem** | Evaluating risk | Imagine it's 1 year from now and this failed — why? |
| **Genre Mashup** | Seeking novelty | Combine 2 unrelated domains (e.g., "restaurant" + "dungeon crawl") |
| **Customer Support Theater** | Finding pain points | Roleplay an angry user and a support rep |
| **Time Traveler Council** | Long-term thinking | Past-you and future-you advise present-you |

Log the chosen technique in the session file.

## Phase 3: Divergence

### Quota

- **Minimum:** 50 ideas
- **Target:** 100 ideas
- **Hard stop:** user explicitly says "stop" AND quota ≥ 50

### Cadence

Generate ideas in batches of 10 with the chosen technique. After each batch:
1. Append to the session file under `## Batch {n} — {technique}`
2. **Anti-bias check:** What domain did this batch cluster in? Pivot to an orthogonal domain for batch {n+1}.
3. Re-engage the user: "{summary of batch}. Any of these spark something? Want to push in a direction?"

### When the User Freezes

- Don't repeat "what else?" — draft 3 concrete alternatives they can react to
- Suggest a technique switch (e.g., "We've been in SCAMPER — want to try a pre-mortem?")
- Inject a random stimulus — pick a word from a different field and force a connection

### When You Freeze

- Shift the lens (user → business → engineer → skeptic)
- Shift the time horizon (now → 1 year → 10 years → 100 years)
- Shift the scale (one user → a million users → one user with infinite resources)

## Phase 4: Convergence

Only once the quota is hit AND the user calls time:

1. **Cluster** — group similar ideas (you do this, not the user — they're tired)
2. **Rank** — for each cluster, pick the 1-2 strongest by a simple criterion the user chooses (novelty, feasibility, impact)
3. **Present** — show the user the top 5-10 ideas across clusters with a 1-line rationale each

⏸ **GATE: Ask the user which ideas survive. Don't over-filter — the user decides.**

## Phase 5: Output

Finalize `docs/brainstorm/session-{date}.md` with:

```markdown
# Brainstorm — {topic}
Date: {date}
Target: {what}
Lens: {perspective}
Constraints: {list}
Techniques used: [{list}]
Total ideas: {N}

## Top Survivors
1. {idea} — {1-line rationale}
2. ...

## Raw Ideas (archived)
### Batch 1 — {technique}
- ...
### Batch 2 — {technique}
- ...
```

Present the file path to the user.

## State Update

Brainstorm is not a formal pipeline phase — it does NOT update `docs/state.yaml`. It's a creative tool usable at any time.

If the brainstorm was a precursor to `/aped-analyze`, tell the user:
> "Brainstorm saved at `docs/brainstorm/session-{date}.md`. When you're ready, run `/aped-analyze` to turn one of these survivors into a validated product brief."

## Next Step

**Do NOT auto-chain.** The user decides what to do with the survivors — maybe keep brainstorming, maybe go analyze, maybe park for later.

## Example

User: "aide-moi à brainstormer des idées de features pour bonjour-overlay"

1. Framing: Target = "features pour overlay", Lens = "utilisateurs finaux d'un mail server", Constraints = "doit rester lean, Bun/Elysia"
2. Technique: propose SCAMPER + What If + Customer Support Theater — user picks SCAMPER
3. Batch 1 (SCAMPER — Substitute): 10 ideas on what could be swapped in the overlay's role
4. Anti-bias: batch was about auth layers. Batch 2 pivots to operational/observability lens.
5. ... continue until 50+ ideas ...
6. Convergence: cluster into auth, observability, dev-experience, integrations
7. Top 5 survivors presented with 1-liner rationale
8. Session saved to `docs/brainstorm/session-2026-04-21.md`

## Common Issues

- **User wants to stop at 20 ideas**: Remind them the quota is 50 minimum. If they insist, document it and move on — but note in the session file that divergence was cut short.
- **Ideas all feel similar**: Semantic clustering. Force a domain pivot (user → infra → legal → marketing).
- **User rejects every idea**: They may be in evaluation mode. Remind them: during divergence, even bad ideas feed better ones. Write it down, move on.
- **Technique feels wrong for the topic**: Switch mid-session. Log the switch in the session file.
- **Resume a paused session**: Read the previous `session-{date}.md`, pick up at the next batch number.
