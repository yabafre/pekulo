# TDD Engine — Red-Green-Refactor Rules

## Core Cycle

### RED — Write Failing Test First
1. Read the task and its AC reference
2. Write test(s) that verify the expected behavior
3. Run tests — they MUST fail (if they pass, the test is wrong or the feature already exists)
4. If test doesn't fail: re-examine the test, ensure it actually tests new behavior

### GREEN — Minimal Implementation
1. Write the MINIMUM code to make the failing test pass
2. No extra features, no premature optimization
3. Run tests — they MUST pass
4. If tests fail: fix the implementation, not the test (unless the test was wrong)

### REFACTOR — Improve While Green
1. Improve code structure, naming, duplication
2. Run tests after each refactor step — they MUST stay green
3. No new behavior in refactor phase

## Gate Checklist (5 conditions — ALL required before marking `[x]`)

- [ ] **Tests exist** — at least one test covers this task's behavior
- [ ] **Tests pass 100%** — all tests for this task pass
- [ ] **Implementation matches** — code does exactly what the task describes, no more
- [ ] **ACs satisfied** — all linked ACs have code evidence
- [ ] **No regressions** — full test suite passes, not just this task's tests

## HALT Conditions

### Immediate HALT (ask user):
- **New dependency needed** — library, service, or API not in Dev Notes
- **3 consecutive failures** — same test failing after 3 fix attempts
- **Missing config** — environment variable, API key, or service not available
- **Ambiguity** — task or AC interpretation unclear

### Do NOT halt:
- Minor warnings that don't affect functionality
- Style preferences (follow existing patterns)
- Optional improvements not in task scope

## Sprint Status Update Rules

### Story Status Transitions
```
backlog -> ready-for-dev -> in-progress -> review -> done
                                    ^              |
                                    +--------------+
                                   (if review finds issues)
```

### Epic Status Rules
- Epic -> `in-progress` when its first story moves to `in-progress`
- Epic -> `done` when ALL its stories are `done`

## Review Continuation Protocol

When a story returns from review with `[AI-Review]` items:

1. Story status will be `in-progress` (set by aped-review)
2. Look for items formatted as: `[AI-Review][Severity] Description [file:line]`
3. Address ALL `[AI-Review]` items BEFORE continuing with regular tasks
4. For each item:
   - Read the cited file:line
   - Apply the fix following TDD (write test for the issue, fix, verify)
   - Remove the `[AI-Review]` tag once resolved

## Writable Sections in Story File

Only modify these sections during development:
- **Tasks**: Mark checkboxes `[x]` as tasks complete
- **Dev Agent Record**: Fill in model, timestamps, debug log, completion notes, file list

Do NOT modify: User Story, Acceptance Criteria, Dev Notes (these are the spec).

## Definition of Done (25-item checklist)

### Code Quality (5)
- [ ] No commented-out code
- [ ] No TODO/FIXME without linked issue
- [ ] Functions < 50 lines
- [ ] No duplicate logic
- [ ] Consistent naming conventions

### Testing (5)
- [ ] All new code has tests
- [ ] Tests are deterministic (no flaky tests)
- [ ] Edge cases covered
- [ ] Error paths tested
- [ ] Full suite passes

### Security (5)
- [ ] Input validation on all user inputs
- [ ] No hardcoded secrets
- [ ] Authentication checks where needed
- [ ] Authorization checks where needed
- [ ] No SQL/command injection vectors

### Documentation (5)
- [ ] Complex logic has comments
- [ ] Public APIs documented
- [ ] Config changes documented
- [ ] Migration steps documented (if applicable)
- [ ] Dev Agent Record filled

### Integration (5)
- [ ] No breaking changes to existing APIs
- [ ] Database migrations are reversible
- [ ] Environment variables documented
- [ ] Dependencies are pinned
- [ ] CI/CD pipeline passes (if applicable)
