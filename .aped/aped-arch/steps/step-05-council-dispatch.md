---
step: 5
reads:
  - ".aped/templates/adr.md"
writes:
  - "subagent/winston"
  - "subagent/lena"
  - "subagent/raj"
  - "subagent/nina"
  - "subagent/maya"
  - "docs/architecture.md"
  - "docs/adr/*.md"
mutates_state: false
---

# Step 5: Phase 2b — Architecture Council (major decisions only)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Council only for major decisions (DB, auth, API paradigm, FE framework, infra)
- 🛑 Specialists dispatched in PARALLEL via single Agent message — no convergence pressure
- 🛑 Each Council writes its own subsection of `## Phase 2b` IMMEDIATELY after validation
- 🚫 Skip Council for low-stakes choices

## CONTEXT BOUNDARIES

- Step 04 routed at least one major decision here.
- Phase 1 + Phase 2 prior categories validated.

## YOUR TASK

For each major decision pending: dispatch the Council, merge verdicts, present to user, record the validated final pick + minority view.

## COUNCIL ROSTER (pick 3–4 per major decision)

**Winston — Systems Architect** *(always include)*
> `subagent_type: Explore`. *"Boring tech for MVP. Cleverness costs operationally."* Focus: scalability, reliability, operational burden, known failure modes.

**Lena — Pragmatic Engineer**
> `subagent_type: Explore`. *"What ships fastest without regret?"* Focus: developer ergonomics, iteration speed, ecosystem maturity, hiring pool.

**Raj — Security & Compliance Reviewer**
> `subagent_type: Explore`. *"Assume breach. Assume audit."* Focus: threat model, data flows, compliance gaps (GDPR, HIPAA, SOC2 as applicable), supply chain risk.

**Nina — Cost & Ops Analyst**
> `subagent_type: Explore`. *"What does this cost at 10× scale? When does it page us at 3am?"* Focus: unit economics, operational cadence, lock-in, migration cost.

**Maya — Edge Case Hunter**
> `subagent_type: Explore`. *"Where does this break?"* Focus: boundary conditions, failure modes, unusual use cases the PRD doesn't mention but will appear.

## DISPATCH PATTERN (per major decision)

1. **Frame** the decision in one paragraph with the candidate options:
   > Primary database: Postgres vs FoundationDB vs managed DynamoDB. PRD context: {summary}. NFR context: {summary}.

2. **Dispatch** the selected specialists in a SINGLE message, in parallel, via `Agent` tool calls. Each gets:
   - Their persona.
   - The decision framing.
   - The candidate options.
   - The relevant PRD / NFR excerpts.

3. Each specialist returns a structured verdict: **preferred option**, **one-line rationale**, **top 2 risks**, **disqualifying conditions**.

4. **Merge** the reports — present to the user:
   - Summary table: specialist × option × verdict.
   - Areas of consensus.
   - Areas of genuine disagreement (these are the important ones).
   - Your synthesized recommendation with rationale.

⏸ **GATE: User reviews the Council verdicts and picks the final option.**

## RECORD IN PLACE

After validation, append a new `### {Decision name}` subsection of `## Phase 2b — Council Dispatches` in `architecture.md`:

- Council framing.
- Specialist verdicts table.
- Consensus / disagreement areas.
- Final pick + rationale.
- Minority view (kept as future-pivot signal).

**Also write an ADR** at `docs/adr/000N-{slug}.md` using `.aped/templates/adr.md` — every Council-dispatched decision passes the three ADR criteria by definition (Council is reserved for hard-to-reverse, surprising, trade-off-laden choices). The ADR captures the verdict in a stable artefact independent of `architecture.md`'s rolling structure.

Bump `last_updated`. Do **NOT** advance `current_subphase` until *all* major decisions have been dispatched; only then push `council-dispatches` to `completed_subphases` and advance to `implementation-patterns`. Mirror in `state.yaml`.

## RE-DISPATCH CONDITIONS

- All specialists agreed on the weakest option → something is wrong with the framing; re-dispatch with sharpened options.
- Specialists split 50/50 with equally strong arguments → user must decide on values, not technical merit; present both paths.
- A specialist returned a thin report (<3 sentences on rationale) → that specialist didn't engage; re-dispatch with clarified framing.

## ESCAPE HATCH

For truly MVP-scale decisions where Council is overkill, skip Phase 2b and proceed directly to step 06. Document in architecture.md that the decision was made without Council — flags it for reconsideration in retro.

## SUCCESS METRICS

✅ Each major decision has its own `### {Decision name}` subsection in `## Phase 2b`.
✅ Specialists dispatched in parallel (single Agent message).
✅ Minority view recorded in every dispatch.
✅ `current_subphase` advances only after ALL major decisions are dispatched.

## FAILURE MODES

❌ Sequential dispatch of Council members — defeats convergence-resistance.
❌ Forgetting the minority view — loses signal for future pivots.
❌ Advancing `current_subphase` after the first major decision — leaves later majors unrouted.

## NEXT STEP

Load `.aped/aped-arch/steps/step-06-implementation-patterns.md`.
