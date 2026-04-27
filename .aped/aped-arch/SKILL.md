---
name: aped-arch
description: 'Collaborative architecture decisions with specialist council for high-stakes choices (DB, auth, API, frontend, infra). Use when user says "create architecture", "technical architecture", "solution design", or invokes /aped-arch. Runs between PRD and Epics.'
allowed-tools: Read Write Edit Glob Grep Bash Agent TaskCreate TaskUpdate
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Architecture — Collaborative Solution Design

Create architecture decisions through step-by-step discovery so that all downstream agents (dev, review, story) implement consistently. This is a **partnership** — you bring structured thinking, the user brings domain expertise and product vision.

## Critical Rules

- EVERY decision must have a rationale — no "just because" choices
- Architecture is NOT implementation — define WHAT and WHY, not the code
- Do NOT proceed to next section without user validation
- Decisions made here are LAW for /aped-dev and /aped-review
- For **major decisions** (Database, Auth, API style, Frontend framework, Infra platform) — dispatch an **Architecture Council** of specialist subagents to surface genuine divergent perspectives. Single-brain reasoning converges to groupthink; real subagents disagree.

## Setup

1. Read `.aped/config.yaml` — extract config
2. Read `docs/state.yaml` — check pipeline state
   - If `pipeline.phases.architecture.status` is `done`: ask user — redo or skip?
   - If user skips: stop here
3. Load input documents:
   - PRD from `docs/prd.md` (required)
   - UX spec from `docs/ux/` (if exists)
   - Product brief from `docs/product-brief.md`

## Phase 1: Context Analysis

Analyze loaded documents for architectural implications:
- Extract FRs and NFRs that drive architectural choices
- Identify scale requirements (users, data volume, throughput)
- Note integration points (external APIs, services)
- Flag compliance/security constraints

Present findings to user:
- "Here's what the PRD implies architecturally..."
- Highlight any tensions between requirements

⏸ **GATE: User validates the context analysis.**

## Phase 2: Technology Decisions

Work through each category collaboratively. For each, present options with trade-offs and let the user decide:

### Data Layer
- Database type and choice (SQL, NoSQL, graph...)
- ORM/query builder
- Caching strategy
- Data validation approach

### Authentication & Security
- Auth strategy (session, JWT, OAuth, passkeys...)
- Authorization model (RBAC, ABAC...)
- Secrets management
- CORS / rate limiting

### API Design
- Architecture style (REST, GraphQL, tRPC, gRPC...)
- API versioning strategy
- Error handling conventions
- Pagination pattern

### Frontend
- Framework and rendering strategy (SSR, SPA, hybrid...)
- State management
- Component library / design system
- Form handling and validation

### Infrastructure
- Hosting and deployment (serverless, containers, PaaS...)
- CI/CD pipeline
- Monitoring and logging
- Environment strategy (dev, staging, prod)

For each category:
1. Present 2-3 options with pros/cons
2. Make a recommendation with rationale
3. User decides
4. Record the decision

⏸ **GATE: User validates all technology decisions.**

## Phase 2b: Architecture Council (for major decisions)

**When to invoke:** For any decision in Phase 2 flagged as **high stakes** — the kind that would cost weeks to reverse later (primary database choice, auth model, API paradigm, frontend framework, infra platform). Skip for low-stakes choices (e.g., a logging library).

The Council is a parallel subagent dispatch via the `Agent` tool. Each specialist thinks independently — no shared context, no convergence pressure — and produces a genuine divergent perspective. You orchestrate, the user decides.

### Council Roster (pick 3-4 for each major decision)

**Winston — Systems Architect** (always include)
> `subagent_type: Explore`. Persona: "Boring tech for MVP. Cleverness costs operationally." Focus: scalability, reliability, operational burden, known failure modes.

**Lena — Pragmatic Engineer**
> `subagent_type: Explore`. Persona: "What ships fastest without regret?" Focus: developer ergonomics, iteration speed, ecosystem maturity, hiring pool.

**Raj — Security & Compliance Reviewer**
> `subagent_type: Explore`. Persona: "Assume breach. Assume audit." Focus: threat model, data flows, compliance gaps (GDPR, HIPAA, SOC2 as applicable), supply chain risk.

**Nina — Cost & Ops Analyst**
> `subagent_type: Explore`. Persona: "What does this cost at 10× scale? And when does it page us at 3am?" Focus: unit economics, operational cadence, lock-in, migration cost.

**Maya — Edge Case Hunter**
> `subagent_type: Explore`. Persona: "Where does this break?" Focus: boundary conditions, failure modes, unusual use cases the PRD doesn't mention but will appear.

### Dispatch Pattern

1. Frame the decision in one paragraph with the candidate options (e.g., "Primary database: Postgres vs FoundationDB vs managed DynamoDB. PRD context: {summary}. NFR context: {summary}.")
2. Dispatch the selected specialists **in a single message, parallel**, via `Agent` tool calls. Each gets:
   - Their persona (as above)
   - The decision framing
   - The candidate options
   - The relevant PRD / NFR excerpts
3. Each specialist returns a structured verdict: **preferred option**, **one-line rationale**, **top 2 risks**, **disqualifying conditions**.
4. You (the orchestrator) merge the reports — present to the user:
   - Summary table: specialist × option × verdict
   - Areas of consensus
   - Areas of genuine disagreement (these are the important ones)
   - Your own synthesized recommendation with rationale

⏸ **GATE: User reviews the Council verdicts and picks the final option. Document the decision AND the minority view in `docs/architecture.md` — the dissent is signal for future pivots.**

### When to Re-Dispatch

- All specialists agreed on the weakest option: something is wrong with the framing — re-dispatch with sharpened options
- Specialists split 50/50 with equally strong arguments: user must decide based on values, not technical merit — present both paths, let user pick
- A specialist returned a thin report (<3 sentences on rationale): that specialist didn't engage — re-dispatch with clarified framing

### Escape Hatch

For truly MVP-scale decisions where the Council would be overkill, skip Phase 2b and proceed directly to Phase 3. Document in the architecture that the decision was made without Council — this flags it for reconsideration in a later retrospective.

## Phase 3: Implementation Patterns

Define conventions that ensure consistency across agents and stories:

### Naming Conventions
- Files and directories (kebab-case, camelCase...)
- Components, functions, variables
- Database tables, columns
- API endpoints

### Code Structure
- Project directory tree (full layout)
- Module/layer boundaries (where does business logic live?)
- Import conventions
- Test file locations and naming

### Communication Patterns
- Error format (how errors flow from DB to API to UI)
- Logging format and levels
- Event/message patterns (if applicable)

### Process Rules
- Branch naming convention
- Commit message format
- PR/MR requirements
- Required test coverage level

Present each category. Discuss with user. Record decisions.

⏸ **GATE: User validates patterns.**

## Phase 4: Structure & Mapping

Create the concrete project structure:

1. **Directory tree** — full project layout with annotations
2. **FR → File mapping** — which FRs are implemented where
3. **Integration boundaries** — where external systems connect
4. **Shared code inventory** — utilities, types, constants that multiple features share

Present to user for review.

⏸ **GATE: User validates structure.**

## Phase 5: Validation

Check coherence:
- [ ] All technology decisions work together (no conflicts)
- [ ] Every FR/NFR from PRD has a clear implementation path
- [ ] Security requirements are addressed
- [ ] Scale requirements are supported by chosen stack
- [ ] No orphan decisions (every choice connects to a requirement)

Present validation results. Flag any gaps.

⏸ **GATE: User approves the architecture document.**

## Output

Write architecture document to `docs/architecture.md`:
- Project Context Analysis
- Technology Decisions (with rationale for each)
- Implementation Patterns & Conventions
- Project Structure & FR Mapping
- Validation Results

Update `docs/state.yaml`:
```yaml
pipeline:
  current_phase: "architecture"
  phases:
    architecture:
      status: "done"
      output: "docs/architecture.md"
```

## Example

PRD says: SaaS for restaurant inventory, 500 concurrent users, POS integration, HACCP compliance.

Phase 2 discussion:
- Data: "PostgreSQL — relational fits inventory domain, JSONB for flexible item attributes"
- Auth: "Supabase Auth + RLS — multi-tenant per restaurant"
- API: "tRPC — type-safe, fast iteration for SaaS MVP"
- Frontend: "Next.js App Router + shadcn/ui — SSR for SEO, RSC for performance"
- Infra: "Vercel + Supabase — zero-ops for MVP stage"

## Common Issues

- **User unsure about a choice**: Present the simplest option as default — "start with X, migrate to Y if needed"
- **Requirements conflict**: Flag it explicitly — "FR-12 wants real-time but NFR-3 wants minimal infra. Pick one."
- **Over-engineering**: For MVP, prefer boring tech. Save the clever architecture for v2.
- **Council specialists converge on the same answer**: that's valid signal — note it as unusually high consensus in `docs/architecture.md`. If the consensus feels suspicious, re-dispatch with a persona explicitly asked to steel-man the minority option.
- **Council dispatch fails or subagents unavailable**: fallback to a single-brain comparison with explicit trade-off table. Flag in `docs/architecture.md`: "Decision made without Council — revisit in next retro."
- **User wants to skip Council for every decision**: respect it, but document that the architecture was made single-brain. Future retros should catch weak spots.

## Next Step

Tell the user: "Architecture is ready. Run `/aped-epics` to create the epic structure."

**Do NOT auto-chain.** The user decides when to proceed.
