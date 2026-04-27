---
name: aped-prfaq
description: 'Working Backwards challenge: press release, customer FAQ, internal FAQ, verdict. Stress-tests product concepts before commit.'
when_to_use: 'Use when user says "PRFAQ", "work backwards", "press release first". Optional upstream of /aped-analyze.'
argument-hint: "[--headless]"
allowed-tools: Read Write Edit Glob Grep Bash Agent TaskCreate TaskUpdate WebSearch WebFetch
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED PRFAQ — Working Backwards Challenge

## Critical Rules

- NEVER let a vague claim pass — every sentence must survive "so what?"
- NEVER accept a solution-first pitch — redirect to the customer's problem
- NEVER ship a press release with jargon, weasel words, or unverified claims
- ALWAYS proceed one stage at a time (1 → 2 → 3 → 4 → 5), with user validation between each
- ALWAYS research before asserting competitive / market / feasibility claims — no "yesterday's assumptions"

## Guiding Principles

### 1. Customer-First or Nothing
If the user leads with "I want to build X" (a solution), redirect to the customer's problem. If they lead with "I want to use AI/blockchain" (a technology), redirect twice — technology is a how, not a why. Strip the buzzword and ask if anyone still cares.

### 2. Tough Love, Not Tough Silence
Challenge every vague answer. When the user is stuck, offer 2-3 concrete alternatives they can react to — don't repeat "be more specific" harder. The user sharpens faster against a draft than against silence.

### 3. Research-Grounded
Every competitive / market / feasibility claim must be verified against current data. Spawn research subagents when gaps appear — don't guess.

### 4. Both Outcomes Are Wins
User walks out with a battle-hardened concept = win. User walks out with the honest realization the concept isn't ready = also a win (saves months of wasted effort).

## Setup

1. Read `.aped/config.yaml` — extract `user_name`, `communication_language`, `document_output_language`
2. Check for existing PRFAQ: `docs/prfaq.md`
   - If exists: read its frontmatter `stage` field, offer to resume from the next stage
3. Ensure output directory exists:
   ```bash
   mkdir -p docs
   ```
4. **Mode detection** — parse `--headless` / `-H` flag:
   - `--headless`: autonomous first-draft from the provided context. User input schema: customer (specific persona), problem (concrete), stakes (why it matters), solution (concept). Missing/vague → return error with specific guidance.
   - Default: full interactive coaching (the gauntlet).

## Phase 1: Ignition

**Goal:** Lock the customer, problem, stakes, and initial solution concept before drafting the press release.

### Open Strong

Frame this as a challenge, not an exploratory chat: "You're about to write the press release for a finished product — before building it. Survive this and the concept is ready. Fail here and you save months of wasted effort. Either way, we win. Ready?"

Then brief the user: PRFAQ = Amazon's Working Backwards method. Press release first, then customer FAQ, then internal FAQ, then verdict.

### Capture the Essentials

Four items minimum before progressing:
- **Customer** — specific persona, not "everyone"
- **Problem** — concrete and felt, not abstract
- **Stakes** — why it matters to them, consequences
- **Solution concept** — even rough

**Concept type detection:** Identify early — commercial product / internal tool / open-source project / community initiative. Store as `{concept_type}`. Non-commercial concepts don't have "unit economics" — adapt FAQ framing downstream (stakeholder value, adoption paths, sustainability).

### Contextual Research (parallel subagents)

Once the concept is sketched, fan out research in parallel via `Agent` tool (`subagent_type: Explore`):

**Agent 1 — Artifact Scanner** (only if user has existing docs)
> Scan `docs/`, `docs/brainstorm/`, and any user-provided paths for documents relevant to this concept. Return the 3-5 most relevant findings with 2-line summaries.

**Agent 2 — Web Researcher**
> Research competitive landscape, market context, and current industry data for: {concept}. Return direct competitors (names, pricing, strengths, weaknesses), market size/growth, 2-3 recent trends. Use WebSearch for current data — no assumptions older than 6 months.

### Graceful Redirect

If after 2-3 exchanges the user can't articulate a customer or problem, suggest the idea needs brainstorm first:
> "We're not landing on a clear customer yet. Want to run `/aped-brainstorm` first to develop the idea, then come back here?"

### Create Working Document

Create `docs/prfaq.md` with frontmatter:
```yaml
---
stage: 1
concept_type: {commercial|internal|open-source|community}
customer: {persona}
problem: {one-line}
stakes: {why}
solution: {concept}
inputs: [{list of docs/research sources used}]
created: {date}
updated: {date}
---
```

Append coaching notes as HTML comments: `<!-- coaching-notes-stage-1 --> {initial assumptions challenged, why this direction, subagent findings that shaped framing} <!-- / -->`

⏸ **GATE: User validates essentials + research surfaces before proceeding to Stage 2.**

## Phase 2: The Press Release

**Goal:** A press release a real customer would stop scrolling for.

### Structure (each section forces a specific clarity)

| Section | What It Forces |
|---|---|
| Headline | One sentence a customer understands |
| Subheadline | Who benefits, what changes |
| Opening paragraph | What you're announcing + who + why they care |
| Problem paragraph | Make the reader feel the pain — no solution yet |
| Solution paragraph | What changes for the customer (not what you built) |
| Leader quote | Vision beyond the feature list |
| How It Works | Customer's experience, not implementation |
| Customer quote | Would a real person say this? |
| Getting Started | Is the path to value clear? |

### Coaching Loop

For each section: **draft → self-challenge → invite → deepen**.
1. Draft the section yourself
2. Out loud, challenge your own draft (model the critical thinking)
3. Invite user to sharpen it
4. Push one level deeper — specifics over generalities

### Quality Bars (embed in challenges, don't enumerate)

- **No jargon** — if a customer wouldn't use the word, cut it
- **No weasel words** — "significantly", "revolutionary", "best-in-class" are banned
- **Mom test** — could a non-industry person understand why it matters?
- **So what test** — every sentence survives one "so what?"
- **Honest framing** — no overselling (customer FAQ will expose it)

### Headless Mode

If `--headless` is active: draft the full press release, apply quality bars internally, write to doc. No interaction.

### Update

Append the refined press release to `docs/prfaq.md`. Update frontmatter: `stage: 2`, `updated: {date}`. Append `<!-- coaching-notes-stage-2 --> {rejected framings, competitive positioning, differentiators explored, out-of-scope details} <!-- / -->`.

⏸ **GATE: Press release passes all 5 quality bars per user AND drafting agent.**

## Phase 3: Customer FAQ

**Goal:** Devil's advocate questions a skeptical customer would actually ask.

Generate 8-12 questions across these axes:
- **Value:** "Why would I pay for this when {free alternative} exists?"
- **Trust:** "Why should I believe you can deliver this?"
- **Fit:** "I'm not your target — why should I care?"
- **Effort:** "What do I have to change about how I work today?"
- **Risk:** "What happens if this fails or the company disappears?"

For each question, draft a **brutally honest** answer. If the answer is weak, the concept is weak — don't hide it. Surface it as a finding.

Update `docs/prfaq.md`: `stage: 3`. Append coaching notes.

⏸ **GATE: User confirms the answers are honest, not marketing.**

## Phase 4: Internal FAQ

**Goal:** The hard questions a stakeholder (investor, exec, team lead) would ask before committing resources.

Generate 8-12 questions across:
- **Feasibility:** "Can we actually build this? With what team? With what tech?"
- **Unit economics / sustainability:** (commercial) "What's the CAC / LTV?" (non-commercial) "How does this sustain itself?"
- **Competition:** "Why won't {big player} crush us in 6 months?"
- **Timing:** "Why now? Why not 2 years ago or 2 years from now?"
- **Risks:** Top 3 ways this fails, with mitigations
- **Moat:** "What makes this defensible?"

Answer each with the same honesty as Stage 3.

Update `docs/prfaq.md`: `stage: 4`. Append coaching notes.

⏸ **GATE: User confirms the answers would survive a real stakeholder grilling.**

## Phase 5: The Verdict

**Goal:** Synthesize a strength assessment. Either the concept survived the gauntlet or it didn't — both are wins.

### Synthesis

Produce a concise verdict section at the end of `docs/prfaq.md`:

```markdown
## Verdict

**Strength:** {STRONG | PROMISING | WEAK}

**Signals of strength:**
- {specific — cite the PR or FAQ answer}
- {specific}

**Signals of weakness:**
- {specific}
- {specific}

**Recommendation:**
- If STRONG: proceed to `/aped-analyze` — this concept is ready for pipeline entry
- If PROMISING: address {specific gaps} before proceeding
- If WEAK: step back to `/aped-brainstorm` — this concept needs more exploration

**PRD Distillate (for downstream consumption):**
- Customer: {persona}
- Problem: {one sentence}
- Proposed solution: {one sentence}
- Key differentiators: {2-3 bullets}
- Non-negotiable requirements: {2-3 bullets from customer FAQ}
- Known risks to mitigate: {top 2 from internal FAQ}
```

Update frontmatter: `stage: 5`, `strength: {STRONG|PROMISING|WEAK}`, `updated: {date}`.

## State Update

PRFAQ is optional upstream tooling — it does NOT update `docs/state.yaml` phases directly. But if the verdict is STRONG, tell the user:
> "PRFAQ complete (`docs/prfaq.md`). Verdict: STRONG. When you're ready, run `/aped-analyze` — the PRD distillate at the bottom of the PRFAQ is ready to seed it."

## Next Step

**Do NOT auto-chain.** The user decides whether to proceed to `/aped-analyze`, refine the PRFAQ further, or abandon the concept.

## Example

User: "I want to build a SaaS for restaurant inventory"

1. Ignition: redirect from solution to problem — "What does a restaurant owner feel on a Tuesday morning that makes them pay?"
2. User: "Waste tracking — they throw away 30% and don't know why"
3. Capture essentials: Customer = small restaurant owner, Problem = invisible food waste, Stakes = razor-thin margins, Solution = automated waste tracking via photos
4. Research fan-out: Market (competitors like FoodWaste Pro, KitchenTrack), Domain (margins, regulation)
5. Stage 2 — Press release drafted in 6 sections with challenge-invite-deepen on each
6. Stage 3 — Customer FAQ: "Why not a spreadsheet?" "Why should I trust photo recognition?"
7. Stage 4 — Internal FAQ: "What's the moat?" "Why won't Toast acquire this?"
8. Stage 5 — Verdict: PROMISING (strong problem, weak moat) — recommendation: address moat before /aped-analyze

## Common Issues

- **User pitches a solution**: redirect to customer + problem. Repeat as many times as needed.
- **User pitches a technology**: redirect twice. Strip the buzzword.
- **User gives vague answers**: offer 2-3 concrete alternatives, not "be more specific"
- **Research agents return thin data**: retry with different keywords, broaden the search, or note the gap in the verdict
- **User wants to skip stages**: each stage builds on the last. Skipping Stage 2 means Stage 3 has no press release to critique. Don't skip — speed-run if the user wants, but cover each stage.
