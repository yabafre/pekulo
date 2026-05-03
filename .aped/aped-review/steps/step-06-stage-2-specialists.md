---
step: 6
reads:
  - "src/**"
  - "tests/**"
  - "git/log"
writes:
  - "subagent/marcus"
  - "subagent/rex"
  - "subagent/diego"
  - "subagent/lucas"
  - "subagent/aria"
  - "subagent/kai"
  - "subagent/sam"
mutates_state: false
---

# Step 6: Stage 2 — Marcus, Rex, and Conditional Specialists

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Dispatch all selected Stage 2 specialists in a SINGLE Agent message, in parallel
- 🛑 NO `team_name`, NO `TeamCreate`, NO `SendMessage` — they are plain subagents
- 🚫 Marcus MUST run the 5-anti-pattern testing audit
- 🚫 Rex MUST run the git audit script — never paraphrase

## CONTEXT BOUNDARIES

- Eva PASS or `[O]verride` recorded.
- Stage 1.5 done (or skipped).

## YOUR TASK

Dispatch all remaining selected specialists in parallel. Their findings return as tool results; the Lead handles cross-cutting concerns in step 07.

## ALWAYS DISPATCHED

### Marcus — code-quality, Staff Engineer

- `subagent_type: "feature-dev:code-reviewer"`
- *"Security and performance are non-negotiable."*
- Focus: security (injection, auth, secrets), performance (N+1, memory), reliability (errors, edge cases), test quality.
- **Mandatory: 5-anti-pattern testing audit** (see below).

### Rex — git-auditor, Code Archaeologist

- `subagent_type: "general-purpose"`
- *"Every commit tells a story. Most lie."*
- Runs `bash .aped/aped-review/scripts/git-audit.sh`.
- Reports out-of-scope changes and missing expected changes.

## CONDITIONALS (by file surface from step 03)

- **Diego** — backend-specialist (if backend files). *"Data integrity is sacred."* `subagent_type: "feature-dev:code-reviewer"`. API contracts, validation at boundaries, transaction integrity, DB schema, auth middleware. Compliance with `architecture.md`.
- **Lucas** — frontend-specialist (if frontend files). *"Consistency is kindness."* `subagent_type: "feature-dev:code-reviewer"`. Component hierarchy, state management, accessibility, forms, loading/error/empty states. Compliance with UX spec.
- **Aria** — visual-reviewer (if frontend + preview app). *"Pixel-perfect or nothing. I live in the devtools."* `subagent_type: "general-purpose"`. **Validates** dev's React Grab work — does NOT redo it. Re-inspects via React Grab only when dev flagged an unresolved issue or a design-spec violation is suspected.
- **Kai** — devops-specialist (if infra files). *"If it's not automated, it's not done."* `subagent_type: "feature-dev:code-reviewer"`. CI/CD security, IaC least privilege, container hardening, deployment safety.
- **Sam** — fullstack-specialist (if story spans ≥ 2 layers). *"I see the pipeline, not the layers."* `subagent_type: "feature-dev:code-explorer"`. End-to-end data flow, contract alignment, auth propagation across layers.

## MARCUS'S 5-ANTI-PATTERN AUDIT (MANDATORY)

Marcus must run the artefact through this 5-anti-pattern audit. Each anti-pattern has a gate function — if any check fires, raise as a finding (`HIGH` for layered consequences like incomplete-mocks; `MEDIUM` otherwise unless the affected behaviour is security-critical).

**Iron Laws:**
1. NEVER test mock behavior.
2. NEVER add test-only methods to production classes.
3. NEVER mock without understanding dependencies.

| # | Anti-pattern | Gate function (verbatim Superpowers) |
|---|---|---|
| 1 | **Mock-the-behavior** (testing mock existence, not real behavior) | "Am I testing real component behavior or just mock existence? If testing mock existence: STOP — delete the assertion or unmock the component." |
| 2 | **Test-only methods in production** | "Is this method only used by tests? If yes: STOP — don't add it; put it in test utilities." |
| 3 | **Mock-without-understanding** | "What side effects does the real method have? Does this test depend on any of those side effects? Do I fully understand what this test needs? If unclear: STOP." |
| 4 | **Incomplete mocks** | "Mock the COMPLETE data structure as it exists in reality, not just fields your immediate test uses." |
| 5 | **Integration test as afterthought** | "Tests are part of implementation, not optional follow-up. Reject PRs that defer integration tests to 'next sprint'." |

If Marcus finds even one of these, he raises it as a finding with the exact gate function he applied. Tests that look passing while violating any of these are the most dangerous regressions APED ships.

## ARIA'S OWNERSHIP NOTE

Dev already ran React Grab at each GREEN (see `aped-dev` step 05). Aria's job is to **validate** that work, not redo it from scratch.

- **Validate**: design-spec compliance (tokens, spacing, typography), cross-screen consistency, edge cases dev may have skipped (loading / empty / error / disabled states), responsive behaviour.
- **Re-inspect with React Grab only when**: dev flagged an unresolved visual issue, a design-spec violation is suspected, or a cross-component consistency check is needed.
- **If React Grab MCP is unavailable**: fall back to static screenshots + code review; explicitly note in the report that a deep visual audit wasn't possible (do not silently pass), AND append a `Visual Review: deferred — React Grab MCP unavailable at <ISO timestamp>` line to the story file's Review Record (in step 11) so `aped-status` and `aped-ship` surface that the visual gate is incomplete. In prod, treat persistent MCP unavailability as a BLOCKER for that story until the user explicitly waives.

## DISPATCH

Single message, parallel Agent tool calls. No parallelism cap — subagents don't render in tmux panes, Claude Code streams their progress inline. Each specialist gets the report contract from step 03.

## SUCCESS METRICS

✅ Single Agent message with all selected specialists.
✅ Marcus's 5-anti-pattern audit included in his prompt.
✅ Rex ran the git-audit script.
✅ Aria's "validate, don't redo" framing included in her prompt (frontend stories with preview apps).

## FAILURE MODES

❌ Sequential dispatch — wastes wall-clock time.
❌ Forgetting to include the 5-anti-pattern checklist in Marcus's prompt — he reviews without the testing-anti-pattern lens.
❌ Letting Aria silently re-do the visual check — duplicates dev's work.

## NEXT STEP

Load `.aped/aped-review/steps/step-07-merge-findings.md` to merge all reports.
