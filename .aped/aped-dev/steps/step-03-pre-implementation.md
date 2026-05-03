---
step: 3
reads:
  - "docs/stories/{story-key}.md"
  - "docs/lessons.md"
writes: []
mutates_state: false
---

# Step 3: Pre-Implementation Checklist & Review Continuation

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Each `[ ]` must flip to `[x]` or HALT — no item silently passes
- 🛑 If story has `[AI-Review]` items, invoke `aped-receive-review` BEFORE touching code
- 🚫 NEVER add a dependency silently — every new package is a HALT condition

## CONTEXT BOUNDARIES

- Story file + upstream artefacts loaded.
- Branch verified.
- TaskCreate not yet called for individual tasks (that's step 06's job).

## YOUR TASK

Walk the Pre-Implementation Checklist. If any item is unsatisfied, gather more context before continuing.

## GUIDING PRINCIPLES (apply to every TDD cycle)

### 1. Understand Before You Code

Read the story, its ACs, and the existing code BEFORE writing anything. If the story references files, read them. If it mentions a pattern, find an existing example in the codebase. The most expensive mistake is building the wrong thing correctly.

### 2. Small Increments, Verified Progress

Each task is one RED→GREEN→REFACTOR cycle. Do not batch multiple tasks into one implementation pass. A task that touches more than 3 files is suspicious — it may need splitting. Commit after each GREEN gate, not at the end.

### 3. The Test Proves the Behavior, Not the Implementation

Write tests that assert WHAT the code does, not HOW it does it. `expect(result).toBe(42)` is good. `expect(mockDb.query).toHaveBeenCalledWith("SELECT...")` is fragile. Test the contract, not the wiring.

### 4. Existing Patterns Are Law

If the codebase uses a specific pattern (repository pattern, service layer, naming convention), follow it exactly — even if you know a "better" way. Consistency across the codebase matters more than local perfection. Deviate only if the story explicitly requires it.

### 5. Fail Fast, Ask Early

Three consecutive test failures on the same task means your approach is wrong, not that you need to try harder. HALT and ask the user. A 2-minute conversation saves 30 minutes of brute-forcing.

## RED FLAGS — STOP IF YOU CATCH YOURSELF THINKING THESE

| Phrase | Why it's wrong |
|--------|----------------|
| "Test framework unavailable, I'll add tests after" | Tests-after is a different skill from TDD. The 5-gate is non-negotiable. |
| "This change is too small to need a test" | Small changes are where untested regressions hide. |
| "The existing code has no tests so it's fine" | The deficit is the bug. Add tests for what you touch. |
| "I'll just add a `// TODO: test this`" | TODO is a banned placeholder, not a plan. |
| "I already manually tested it" | Manual testing is not regression coverage. |
| "Tests pass on first run" | First-run pass means no RED was witnessed — likely tests-after dressed up as TDD. Re-read the test, intentionally break the implementation it covers, and re-run; you must see it go RED before you trust GREEN. |
| "I'll create a helper to handle this" | Capability substitution: absorbing target-system responsibility into a helper instead of forcing structure into schema/state/policy. If the spec says "the database enforces X", write a migration — don't wrap it in a helper. |
| "Let me check the codebase first" | Frozen-codebase risk: if you haven't run `git pull` or `git log -1` since session start, your mental model may be stale. Run a freshness probe before any file read. |

## RATIONALIZATIONS — RECOGNIZE AND REJECT

| Excuse | Reality |
|--------|---------|
| "Tests after achieve the same goal" | Tests-after rarely fail on the right path the first time. |
| "I'll fix the test in the next task" | You won't. Next-task you is busy with next-task work. |
| "The dev agent reported tests passing" | If you didn't capture the output in this message, it's not evidence. |
| "Just this once, I'll skip the RED step" | "Just this once" appears every time and erodes the discipline. |

## PRE-IMPLEMENTATION CHECKLIST

Verify you can check every box. If you can't, go back and gather more context.

- [ ] **Story file read** — all ACs, tasks, and Dev Notes understood.
- [ ] **Existing code explored** — files listed in Dev Notes are read and understood.
- [ ] **Dependencies identified** — libraries needed are installed and documented.
- [ ] **Test strategy clear** — you know WHERE to put tests and WHAT to assert for each AC.
- [ ] **No ambiguity** — if anything is unclear, HALT and ask before proceeding.
- [ ] **Branch verified** — feature branch checked out (verified in step 01), clean working tree confirmed via `git status --porcelain | grep -v '^??' | head -1` empty.
- [ ] **Lessons applied** — each loaded lesson with scope `aped-dev` or `all` is reflected as a check above (e.g. *"Per Epic 1's lesson, error states test exists?"*).

## REVIEW CONTINUATION CHECK

If story has `[AI-Review]` items: address them BEFORE regular tasks.

When `aped-review` has reported findings and handed control back to `aped-dev`, **invoke `aped-receive-review`** to process the feedback before touching code. The `aped-receive-review` skill enforces the "no performative agreement, technical verification first" discipline:

- verify each item against the codebase,
- ask for clarification on any unclear item,
- push back on technically wrong feedback with evidence,
- run a YAGNI grep before "implementing properly" on possibly-unused features.

Skipping this step typically produces partial fixes plus rework.

## STATE UPDATE (start)

Once the checklist is satisfied, advance the state:

1. **Prefer MCP**: `aped_state.advance(phase: "dev", status: "in-progress")`.
2. **Fallback** (MCP unavailable): edit `docs/state.yaml` directly — story `in-progress`, epic `in-progress` if first story.

## TASK TRACKING

Create a task for each story task checkbox:

```
For each "- [ ] task description [AC: AC#]" in story:
  TaskCreate: "task description" (status: pending)
```

You will flip each to `in_progress` when starting RED, and `completed` when the GATE passes (step 06).

## SUCCESS METRICS

✅ All checklist items `[x]`.
✅ `[AI-Review]` items routed through `aped-receive-review` (or none present).
✅ State advanced to `in-progress`.
✅ Per-task `TaskCreate` calls done.

## FAILURE MODES

❌ Skipping the checklist — leads to story interpretation drift.
❌ Touching code on `[AI-Review]` items without `aped-receive-review` — produces performative fixes.
❌ Advancing state before the checklist passes — `in-progress` without context.

## NEXT STEP

Load `.aped/aped-dev/steps/step-04-epic-context.md` to compile (or load) the epic-context cache.
