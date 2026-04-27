---
name: aped-analyze
description: 'Analyzes a new project idea through parallel market, domain, and technical research. Use when user says "research idea", "aped analyze", or invokes /aped-analyze. Not for existing codebases — use aped-context for brownfield projects.'
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Analyze — Parallel Research to Product Brief

## Critical Rules

- NEVER skip Discovery — research quality depends on clear, detailed inputs
- NEVER proceed to the next step without explicit user validation
- ALL 3 agents must complete before synthesis — do not proceed with partial results
- Take your time with synthesis — quality is more important than speed
- Do not skip validation steps

## Guiding Principles

### 1. Discovery Is the Foundation
The quality of the entire pipeline depends on how well the project is understood upfront. A vague brief produces a vague PRD, which produces vague stories. Invest time here — it pays for itself 10x downstream.

### 2. Help the User Think, Don't Just Ask
Many users know what they want but struggle to articulate it clearly. Your job is to guide them through structured thinking — probe deeper on vague answers, suggest angles they haven't considered, and reflect back what you understood so they can correct it.

### 3. Research Informs, User Decides
The 3 research agents bring data. The user brings vision and judgment. Present research findings clearly, highlight conflicts or surprises, and let the user make the final call on scope and direction.

## Setup

1. Read `.aped/config.yaml` — extract `user_name`, `communication_language`, `ticket_system`, `git_provider`
2. Read `docs/state.yaml` — check `pipeline.phases.analyze`
   - If status is `done`: ask user — redo analysis or skip to next phase?
   - If user skips: stop here (user will invoke next phase manually)

## Phase 1: Guided Discovery

This is a **conversation**, not a questionnaire. Adapt to `communication_language`. Ask one category at a time, wait for the answer, then ask follow-ups based on what the user said. Do NOT dump all questions at once.

### Round 1 — The Vision
Start with the big picture. Ask:
- **What are we building?** — The product/service in the user's own words
- **What problem does it solve?** — The specific pain point, not a generic category
- **What exists today?** — How do people currently solve this problem (even imperfectly)?

Listen to the answers. If they're vague ("a platform for X"), probe:
- "Can you walk me through a specific scenario where a user would use this?"
- "What's the most frustrating thing about the current alternatives?"

### Round 2 — The Users
Once the vision is clear, dig into the audience:
- **Who is the primary user?** — Role, context, technical level
- **Who pays?** — Sometimes the user and the buyer are different
- **What does success look like for them?** — What outcome makes them come back?

Probe deeper if needed:
- "Is this for individuals or teams? Small businesses or enterprise?"
- "What's their budget sensitivity? Is this a must-have or a nice-to-have?"

### Round 3 — The Constraints
Now understand the boundaries:
- **Why now?** — Market timing, technology enabler, competitive gap
- **What's the MVP scope?** — If you had to launch in 2 weeks, what's the one thing it MUST do?
- **Any technical constraints?** — Platform preferences, existing systems to integrate with, compliance needs

### Round 4 — Validation
Summarize what you understood back to the user in a structured format:
- **Product:** one-line description
- **Problem:** the pain point
- **Users:** primary audience
- **MVP core:** the one essential feature
- **Constraints:** platform, integrations, compliance

**Ask the user to confirm or correct this summary before proceeding.**

⏸ **GATE: Do NOT proceed to research until the user explicitly validates the discovery summary.**

## Phase 2: Parallel Research

### Task Tracking

```
TaskCreate: "Parallel research — Market, Domain, Technical"
TaskCreate: "Present research findings to user"
TaskCreate: "Synthesize into product brief"
TaskCreate: "Validate brief with user"
```

Read `.aped/aped-analyze/references/research-prompts.md` for detailed agent prompts.

Launch **3 Agent tool calls in a single message** (parallel execution) with `run_in_background: true`.

Each agent has a persona — include it in the prompt to keep them in character.

### Agent 1: Market Research — **Mary**, Strategic Business Analyst — "Show me the data, not opinions."
- `subagent_type: "Explore"`
- Customer behavior and pain points in the target segment
- Competitive landscape: direct and indirect competitors (names, pricing, strengths, weaknesses)
- Market size and growth trajectory
- Pricing models and monetization patterns in the space
- Use WebSearch for current data

### Agent 2: Domain Research — **Derek**, Domain Expert, industry veteran — "I know where the bodies are buried."
- `subagent_type: "Explore"`
- Industry analysis and key trends
- Regulatory requirements and compliance needs
- Technical trends shaping the domain
- Standards, certifications, and legal requirements
- Use WebSearch for current data

### Agent 3: Technical Research — **Tom**, Technical Architect, pragmatist — "Boring tech for MVP. Cleverness costs."
- `subagent_type: "Explore"`
- Technology stack options with trade-offs
- Integration patterns and APIs available
- Architecture patterns for similar products
- Open-source tools and frameworks relevant
- Use WebSearch for current data

Once all 3 agents return, update task: `TaskUpdate: "Parallel research" → completed`

## Phase 3: Research Review

**Present the research findings to the user** in a structured summary:
- Key competitors found and how they compare
- Market size and opportunity
- Regulatory or compliance concerns discovered
- Recommended technical approach and why
- Any surprises or conflicts between research areas

Highlight anything that might change the user's original vision:
- "Research shows the market is more crowded than expected — here are 3 direct competitors..."
- "There's a compliance requirement you may not have considered..."
- "The technical approach X is more mature than Y for this use case..."

⏸ **GATE: Ask the user if the research changes their vision. Wait for confirmation before synthesizing.**

## Phase 4: Synthesis

Ensure output directory exists:
```bash
mkdir -p docs
```

1. Fuse discovery answers + research results into a product brief
2. Use template from `.aped/templates/product-brief.md`
3. Fill all 5 sections: Executive Summary, Core Vision, Target Users, Success Metrics, MVP Scope
4. Write output to `docs/product-brief.md`

## Phase 5: Validation

```bash
bash .aped/aped-analyze/scripts/validate-brief.sh docs/product-brief.md
```

If validation fails: fix missing sections and re-validate.

**Present the completed brief to the user.** Summarize the 5 sections and ask:
- "Does this accurately capture your project?"
- "Anything to add, remove, or change?"

⏸ **GATE: Do NOT update state until the user explicitly approves the brief.**

If user requests changes: apply them, re-validate, re-present.

## State Update

Only after user approval:

Update `docs/state.yaml`:
```yaml
pipeline:
  current_phase: "analyze"
  phases:
    analyze:
      status: "done"
      output: "docs/product-brief.md"
```

## Next Step

Tell the user: "Product brief is ready. When you're ready, run `/aped-prd` to generate the PRD."

**Do NOT auto-chain.** The user decides when to proceed.

## Example

User says: "I want to build a SaaS for restaurant inventory management"
1. Discovery Round 1: "What specific problem? Manual counting? Waste tracking? Supplier ordering?"
2. User clarifies: "Waste tracking — restaurants throw away too much and don't know why"
3. Discovery Round 2: "Who uses it? Kitchen manager? Owner? Both?" → user answers
4. Discovery Round 3: "Any POS system to integrate with? Compliance needs?" → user answers
5. Discovery Round 4: summary → user confirms
6. Launch 3 agents: market, domain, technical
7. Present findings: "Found 2 direct competitors (FoodWaste Pro, KitchenTrack)..."
8. User confirms direction
9. Synthesize → validate → present brief → user approves
10. "Run /aped-prd when ready."

## Common Issues

- **User gives vague answers**: Don't accept "a platform for X." Probe with scenarios: "Walk me through a Tuesday morning for your target user."
- **Agent returns empty results**: WebSearch may fail — retry with different keywords, broaden search terms
- **Brief validation fails**: Check which section is missing, fill it from agent results, re-validate
- **User changes direction after research**: This is normal and expected. Update the discovery summary, re-run research if needed, re-synthesize.
