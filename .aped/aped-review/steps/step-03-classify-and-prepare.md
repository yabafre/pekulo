---
step: 3
reads:
  - "git/diff"
  - "ticket/{provider}"
  - "state.yaml#sprint.review_limit"
writes: []
mutates_state: false
---

# Step 3: Story Classification, Capacity Check, Ticket Refresh

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Refresh the ticket — comments may have decisions added during dev
- 🛑 Respect `sprint.review_limit` — queue if exceeded
- 🚫 NEVER change status before Stage 1 — it stays `review`

## CONTEXT BOUNDARIES

- Story file + upstream artefacts loaded.
- Lessons mapped to specialist scopes.

## YOUR TASK

Refresh the ticket, check parallel-review capacity, classify the story by file surface, and decide which specialists to dispatch.

## TICKET REFRESH (live source)

If `ticket_system` ≠ `none`:

1. **Prefer MCP** — `mcp__aped_ticket__get_status(ticket_id)` returns the current title, body, labels, and **all comments**.
2. **Fallback** — provider CLI (gh / glab / linear / jira).

Read all comments — they may contain clarifications or decisions made during dev. If the ticket body diverges from the story ACs, flag it to the user before proceeding to Stage 1.

## CAPACITY CHECK

Before spinning up specialists, check `sprint.review_limit` (default 2) against current reviews:

```
reviews_running = count(stories where status == "review" AND story_key != this one)
```

If `reviews_running >= review_limit`:

- Update this story's status to `review-queued` in `state.yaml`.
- Post a comment on the ticket (if applicable): *"Review capacity reached — queued."*
- Tell the user: *"Review queue is full ({running}/{limit}). This story is `review-queued`. Re-run `aped-review {story-key}` when a slot frees (see `aped-status`)."*
- STOP — do not dispatch specialists.

Otherwise, continue. Do NOT change status yet; it stays `review` until either `done` or queued again.

## STORY CLASSIFICATION

Analyze the story's File List to determine which specialists to dispatch.

Detect categories:

- **backend** — `apps/api/`, `apps/server/`, `services/`, `packages/*/src/`, `.py`, `.go`, `.rs`, `.java`, business logic files.
- **frontend** — `.tsx`, `.jsx`, `.vue`, `.svelte`, `apps/web/`, `src/pages/`, `src/components/`.
- **devops** — `.github/workflows/`, `Dockerfile`, `docker-compose`, `terraform/`, `k8s/`, `cdk/`, infra code.
- **fullstack** — story spans 2+ layers (e.g., an API + its consumer UI).

A story can trigger multiple specialists.

## DISPATCH PLAN

### Always dispatched (Stage 1 + Stage 2)

- **Eva** — ac-validator, *"I trust nothing without proof in the code."* Stage 1 alone (synchronous gate).
- **Marcus** — code-quality, *"Security and performance are non-negotiable."* Stage 2.
- **Rex** — git-auditor, *"Every commit tells a story."* Stage 2.

### Conditionals (Stage 2)

- backend files present → **Diego** (backend-specialist).
- frontend files present → **Lucas** (frontend-specialist) AND **Aria** (visual reviewer if a preview app is present).
- infra files present → **Kai** (devops-specialist).
- story spans ≥ 2 layers → **Sam** (fullstack-specialist).

### Stage 1.5 (opt-in)

If `review.parallel_reviewers: true` is set in `config.yaml`:

- **Hannah** — Blind Hunter (reviews diff WITHOUT the spec).
- **Eli** — Edge Case Hunter (walks every branching path and boundary condition).
- **Aaron** — Acceptance Auditor (verifies each test cites a verbatim AC line).

If `false` or absent (default), skip Stage 1.5.

## SPECIALIST REPORT CONTRACT

Every specialist must return findings in this exact shape so the merge step can deduplicate cleanly:

```markdown
## {specialist-name} Report

### Findings
- [SEVERITY] Description [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}

### Summary
- Checked: {scope}
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
- Open questions for Lead: {if any}
```

The Lead's job in step 07 is to merge these reports — not to coordinate them in real-time.

## SUCCESS METRICS

✅ Ticket refreshed; divergence with story ACs flagged.
✅ Capacity checked; queued if `review-queued`, otherwise proceed.
✅ File surface classified; dispatch plan locked in.
✅ Stage 1.5 enabled / disabled per config.

## FAILURE MODES

❌ Skipping the ticket refresh — review against stale ACs.
❌ Bypassing capacity — overlapping reviews thrash specialists.
❌ Dispatching all specialists at once (1-stage parallel) — wastes tokens if Eva NACKs.

## NEXT STEP

Load `.aped/aped-review/steps/step-04-stage-1-eva.md` to dispatch Eva alone as the synchronous AC gate.
