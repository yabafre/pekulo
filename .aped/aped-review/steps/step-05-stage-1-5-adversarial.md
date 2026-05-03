---
step: 5
reads:
  - "config.yaml#review.parallel_reviewers"
  - "src/**"
  - "tests/**"
  - "docs/stories/{story-key}.md"
writes:
  - "subagent/hannah"
  - "subagent/eli"
  - "subagent/aaron"
mutates_state: false
---

# Step 5: Stage 1.5 — Adversarial Pass (opt-in)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Skip this step entirely if `review.parallel_reviewers` is `false` or absent
- 🛑 Dispatch Hannah / Eli / Aaron in PARALLEL — single Agent message with three tool calls
- 🚫 Stage 1.5 NACK does NOT block Stage 2 — its findings are merged with Stage 2's

## CONTEXT BOUNDARIES

- Eva's verdict was APPROVED or `[O]verride` was chosen.
- Eva's findings are held for the merge step.

## YOUR TASK

If opt-in is enabled, dispatch the three adversarial reviewers in parallel. Otherwise skip.

## OPT-IN CHECK

Read `review.parallel_reviewers` from `.aped/config.yaml`.

- `true` → dispatch the three.
- `false` / absent (default) → SKIP. Continue to step 06.

## DISPATCH (PARALLEL)

Send a SINGLE Agent message with THREE tool calls:

### Hannah — Blind Hunter

- `subagent_type: "general-purpose"`
- *"If I can't find it in the code, it doesn't exist."*
- Reviews the implementation **WITHOUT reading the story spec**. Flags any production-code identifier (function name, type, import, table name, column, enum value) not present in the diff context as a potential hallucination. Catches spec-wishful-thinking that leaks into code (e.g. the canonical `point_events` class never mentioned in any PRD/story).

### Eli — Edge Case Hunter

- `subagent_type: "general-purpose"`
- *"What happens at the boundary?"*
- Walks every branching path and boundary condition: off-by-ones, empty inputs, nil/undefined propagation, concurrent access, locale edge cases. Method-driven, not attitude-driven — exhaustive path analysis.

### Aaron — Acceptance Auditor

- `subagent_type: "general-purpose"`
- *"Show me the AC in the test, verbatim."*
- Verifies that every acceptance criterion from the story spec appears **verbatim** in at least one test assertion. No paraphrasing, no "implied coverage" — if the AC says "returns 404 when not found", a test must assert exactly that.

## REPORT FORMAT (every reviewer)

```markdown
## {Hannah|Eli|Aaron} Report

### Findings
- [SEVERITY] Description [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}

### Summary
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
```

## MERGE PREPARATION

The merge script `.aped/scripts/aped-review/merge-findings.mjs` deduplicates by `file:line:category`, assigns severity (`BLOCKER > MAJOR > MINOR > NIT`), and produces the merged report consumed by step 07.

## DEGRADED-MODE HANDLING

- 1 of 3 fails → continue with the 2 that responded; note the missing reviewer in step 09's summary.
- 0 of 3 respond → skip Stage 1.5 entirely and proceed to step 06 with a warning to the user.

## SUCCESS METRICS

✅ If opt-in disabled: this step skipped explicitly.
✅ If enabled: 3 reviewers dispatched in parallel via a SINGLE Agent message.
✅ Findings collected for the merge.
✅ Degraded mode handled.

## FAILURE MODES

❌ Sequential dispatch of Hannah / Eli / Aaron — wastes wall-clock time.
❌ Treating Stage 1.5 NACK as a HALT — it's a finding source, not a gate.
❌ Forgetting the merge script — duplicate findings end up in the user-visible report.

## NEXT STEP

Load `.aped/aped-review/steps/step-06-stage-2-specialists.md` to dispatch Marcus, Rex, and the conditional specialists.
