---
step: 4
reads: []
writes: 
  - "subagent/mary"
  - "subagent/derek"
  - "subagent/tom"
mutates_state: false
---

# Step 4: Phase 2 — Parallel Research (Mary / Derek / Tom)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Dispatch all 3 agents in a SINGLE Agent message (parallel)
- 🛑 ALL 3 must complete before synthesis — no partial results
- 🚫 NEVER let an agent run alone — single-agent research anchors on the first plausible angle

## YOUR TASK

Launch Mary + Derek + Tom in parallel. Each agent has a persona — include in prompt.

## TASK TRACKING

```
TaskCreate: "Parallel research — Market, Domain, Technical"
TaskCreate: "Present research findings to user"
TaskCreate: "Synthesize into product brief"
TaskCreate: "Validate brief with user"
```

Read `.aped/aped-analyze/references/research-prompts.md` for detailed agent prompts.

## DISPATCH (single message, 3 parallel Agent calls)

### Agent 1 — Mary (Strategic Business Analyst)

> *"Show me the data, not opinions."*

- `subagent_type: "Explore"`
- Customer behavior and pain points in target segment.
- Competitive landscape: direct + indirect competitors (names, pricing, strengths, weaknesses).
- Market size and growth trajectory.
- Pricing models and monetization patterns.
- Use WebSearch for current data.

### Agent 2 — Derek (Domain Expert, industry veteran)

> *"I know where the bodies are buried."*

- `subagent_type: "Explore"`
- Industry analysis and key trends.
- Regulatory requirements and compliance needs.
- Technical trends shaping the domain.
- Standards, certifications, legal requirements.
- Use WebSearch.

### Agent 3 — Tom (Technical Architect, pragmatist)

> *"Boring tech for MVP. Cleverness costs."*

- `subagent_type: "Explore"`
- Technology stack options with trade-offs.
- Integration patterns and APIs.
- Architecture patterns for similar products.
- Open-source tools and frameworks.
- Use WebSearch.

## WAIT FOR ALL 3

Once every parallel research agent returns, update task: `TaskUpdate: "Parallel research" → completed`.

## NEXT STEP

Load `.aped/aped-analyze/steps/step-05-synthesis.md`.
