---
step: 4
reads:
  - ".aped/templates/adr.md"
writes:
  - "docs/architecture.md"
  - "docs/adr/*.md"
mutates_state: false
---

# Step 4: Phase 2 — Technology Decisions (5 categories)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 EVERY decision cites the PRD FR/NFR IDs it satisfies — no vibes
- 🛑 Record each decision in place IMMEDIATELY (do not buffer until end of phase)
- 🛑 For major decisions (DB, auth, API style, FE framework, infra), branch to step 05 (Council)

## CONTEXT BOUNDARIES

- Phase 1 validated and written.
- Brownfield context (if any) is the default for each category.

## YOUR TASK

Walk through the 5 technology categories collaboratively. Present options with trade-offs. Record each decision with FR/NFR citations as it's made.

## CATEGORIES

### Data Layer
- Database type and choice (SQL, NoSQL, graph, …).
- ORM/query builder.
- Caching strategy.
- Data validation approach.

### Authentication & Security
- Auth strategy (session, JWT, OAuth, passkeys, …).
- Authorization model (RBAC, ABAC, …).
- Secrets management.
- CORS / rate limiting.

### API Design
- Architecture style (REST, GraphQL, tRPC, gRPC, …).
- API versioning strategy.
- Error handling conventions.
- Pagination pattern.

### Frontend
- Framework and rendering strategy (SSR, SPA, hybrid).
- State management.
- Component library / design system.
- Form handling and validation.

### Infrastructure
- Hosting and deployment (serverless, containers, PaaS, …).
- CI/CD pipeline.
- Monitoring and logging.
- Environment strategy (dev, staging, prod).

## PER-CATEGORY LOOP

For each category:

1. **Present 2–3 options** with pros/cons.
2. **Make a recommendation** with rationale **citing the specific PRD FR/NFR IDs** the choice satisfies. Example:
   > Postgres recommended — satisfies NFR-3 (ACID), NFR-7 (relational analytics), FR-12 (audit log integrity).

   Decisions without FR/NFR citations are vibes, not architecture; surface that gap to the user instead of inventing one.
3. **User decides**.
4. **Record in place** — append the decision to its `### {Category}` subsection inside `## Phase 2 — Technology Decisions` of `architecture.md` IMMEDIATELY, before moving on. Do not buffer.
5. **Bump `last_updated` in frontmatter** (no subphase advance until full Phase 2 gate clears).

## MAJOR-DECISION ROUTING

For decisions flagged as **high-stakes** (kind that would cost weeks to reverse — primary database, auth model, API paradigm, frontend framework, infra platform):

→ **Branch to step 05 (Architecture Council)** before recording the decision.

The Council dispatches specialist subagents in parallel for divergent perspectives. Skip for low-stakes choices (e.g., a logging library).

## ADR SHARDING (v6.0.0+)

For each decision that passes **all three** of:

1. **Hard to reverse** — cost of changing your mind later is meaningful (database, auth, API paradigm, infra).
2. **Surprising without context** — a future reader will look at the code and wonder "why this way?"
3. **Real trade-off** — there were genuine alternatives and you picked one for specific reasons.

→ **ALSO write a separate ADR file** at `docs/adr/000N-{slug}.md` using the template at `.aped/templates/adr.md`. ADRs persist the *that* and *why* of the decision in a stable, citable artefact — `architecture.md` may be rewritten section-by-section over the project's life, but ADRs survive.

Numbering: scan `docs/adr/` for the highest existing `NNNN-` prefix and increment. The directory ships with a `.gitkeep` from the scaffolder; create the first ADR lazily on the first qualifying decision.

Skip the ADR for easy-to-reverse choices (e.g., logging library, error format) — they don't need the audit trail. The `adr/` directory will stay empty until a decision warrants it; that's fine.

## PHASE 2 GATE

⏸ **GATE: User validates ALL technology decisions.**

After validation, run the Incremental Tracking Contract writes:
- Confirm all 5 `### {Category}` subsections are populated.
- Advance `current_subphase` → `council-dispatches` (or directly → `implementation-patterns` if no Council needed).
- Push `technology-decisions` onto `completed_subphases`.
- Mirror in `state.yaml`.

## SUCCESS METRICS

✅ Each of the 5 categories has a decision with FR/NFR citations.
✅ Major decisions routed through step 05 before being recorded.
✅ All 5 subsections populated in architecture.md before the gate clears.

## FAILURE MODES

❌ Recommending a database without citing NFRs — that's a vibe.
❌ Buffering all 5 categories until the end and writing in bulk — defeats incremental tracking.
❌ Routing a low-stakes decision through Council — wastes specialist budget.

## NEXT STEP

If any major decisions are pending: load `.aped/aped-arch/steps/step-05-council-dispatch.md`.
Else load `.aped/aped-arch/steps/step-06-implementation-patterns.md`.
