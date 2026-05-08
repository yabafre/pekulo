---
step: 2
reads:
  - "src/**"
  - "tests/**"
  - "docs/stories/{story-key}.md"
writes:
  - "subagent/spec"
  - "subagent/code"
  - "subagent/edge"
  - "subagent/aria"
mutates_state: false
---

# Step 2: Dispatch — 3 Method-Driven Auditors in Parallel (+ Aria conditional)

## The model

**One method = one persona.** Three reviewers cover the surface. Aria is conditional.

| Auditor | Method | Scope |
|---|---|---|
| **Spec auditor** | AC verbatim + task evidence | Every AC has at least one test asserting it; every `[x]` task has code evidence at file:line. |
| **Code auditor** | File-surface aware code review | Security, performance, reliability, test quality, the 5 testing anti-patterns. Lens adapts to backend / frontend / infra detected in step 01. |
| **Edge & hallucination auditor** | Boundary + identifier presence | Off-by-ones, empty inputs, nil propagation, concurrent access, locale; flags any production identifier (function, type, table, column) absent from the diff context as a potential hallucination. |
| **Aria** *(conditional)* | Visual review via React Grab MCP | Frontend stories with a preview app only. **Validates** dev's React Grab work, does not redo it. |

Send a SINGLE `Agent` message with three (or four) parallel tool calls. No `TeamCreate` — these are plain subagents.

The Lead also runs `bash .aped/aped-review/scripts/git-audit.sh` inline (no subagent — it's a pure script). Its output joins the merge in step 03.

## Persona prompts

### Spec auditor

- `subagent_type: "feature-dev:code-explorer"`
- *"Show me the AC in the test, verbatim."*

```
You are the Spec auditor. "I trust nothing without proof in the code."

Scope:
- For each AC in docs/stories/{story-key}.md, search tests for an
  assertion that quotes the AC text or its exact behaviour. Rate each AC
  IMPLEMENTED / PARTIAL / MISSING with file:line citations.
- For each `[x]` task in the story, locate code evidence (file:line). Tasks
  marked done with no evidence = CRITICAL finding.

Lessons that augment your checklist (Scope: aped-review or all):
{paste scoped lessons verbatim}

Output:
## Spec Auditor Report
### Findings
- [SEVERITY] {AC-N or task} — {issue} [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}
### Summary
- ACs reviewed: {N} ({IMPL}/{PARTIAL}/{MISSING})
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
```

### Code auditor

- `subagent_type: "feature-dev:code-reviewer"`
- *"Security and performance are non-negotiable."*

```
You are the Code auditor. The story's file surface is {backend|frontend|infra|cross-layer}.

Lenses (apply only those matching the surface):
- Security: injection, auth, authz, secrets, output encoding.
- Performance: N+1, hot-path allocations, missing indexes.
- Reliability: error handling, edge cases, timeouts, retries.
- Test quality: real assertions, edge cases, error paths covered.
- Architecture compliance: read docs/architecture.md and grade the
  diff against its conventions (degraded mode if architecture.md is absent —
  infer from codebase patterns).

5 testing anti-patterns (mandatory pass):
1. Mock-the-behaviour — if a test asserts mock existence, not real behaviour, flag it.
2. Test-only methods in production — methods used only by tests belong in test utilities.
3. Mock-without-understanding — mocks where the dev did not understand the real method's side effects.
4. Incomplete mocks — mocked structure missing fields the real one carries.
5. Integration test as afterthought — production change with no integration coverage.

Brownfield context (if cache's "Project context" section is non-empty): existing
patterns are LAW, even when they conflict with architecture.md.

Lessons that augment your checklist (Scope: aped-review or all):
{paste scoped lessons verbatim}

Output:
## Code Auditor Report
### Findings
- [SEVERITY] {what} [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}
### Summary
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
```

### Edge & hallucination auditor

- `subagent_type: "general-purpose"`
- *"What happens at the boundary? And does this identifier even exist?"*

```
You are the Edge & hallucination auditor.

Two passes:
1. Boundary conditions — walk every branching path: empty inputs, nil/undefined
   propagation, off-by-ones, concurrent access, locale edge cases. Method-driven,
   exhaustive.
2. Identifier presence — list every production identifier (function name, type,
   import, table, column, enum value) introduced by the diff. For each, confirm
   it exists in the codebase or in a referenced library; flag any that don't as
   a potential hallucination (the canonical case: spec-wishful-thinking that
   leaks into code with no real implementation).

Output:
## Edge & Hallucination Report
### Findings
- [SEVERITY] {what} [file:line]
  - Evidence: {trace, grep result, branch path}
  - Suggested fix: {how}
### Summary
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
```

### Aria *(conditional — frontend + preview app only)*

- `subagent_type: "general-purpose"`
- *"Pixel-perfect or nothing."*

Aria validates dev's React Grab pass — does not redo it from scratch. She re-inspects only when dev flagged an unresolved visual issue, a design-spec violation is suspected, or cross-component consistency needs a check.

If React Grab MCP is unavailable: fall back to static screenshots + code review, append `Visual Review: deferred — React Grab MCP unavailable at <ISO>` to the Review Record in step 05. Treat persistent MCP unavailability as BLOCKER unless the user explicitly waives.

## Degraded mode

If 1 of 3 (or 4 with Aria) returns no structured verdict, retry that one once with sharper instructions. Second failure → continue with the rest, note the missing auditor in step 04's report. Zero responses → HALT and escalate.

## Inline git audit

After dispatching subagents, run:

```bash
bash .aped/aped-review/scripts/git-audit.sh
```

Capture stdout — its findings (out-of-scope changes, missing expected changes) join the merge in step 03.

## NEXT

After all subagents return, read fully and follow `.aped/aped-review/steps/step-03-merge-and-verify.md`.
