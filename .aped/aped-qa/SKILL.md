---
name: aped-qa
keep-coding-instructions: true
description: 'Use when user says "generate tests" (E2E or integration), "E2E tests", "integration tests", "aped qa", or invokes aped-qa. Not for unit tests written during TDD RED — those are owned by aped-dev.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "[story-key]"
license: MIT
metadata:
  author: yabafre
  version: 6.12.5
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED QA — E2E & Integration Test Generation

Generate comprehensive end-to-end and integration tests for completed stories or epics. Complements the unit tests written during aped-dev TDD.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Setup

1. Read `docs/state.yaml` — find completed stories/epics
2. Read `.aped/aped-qa/references/test-patterns.md` for framework selection and test templates

## Input Discovery

Before any work, discover and load the artefacts QA must verify against. Generated tests have to ground in real Acceptance Criteria; without grounding, the agent invents ACs and the wrong framework.

### 1. Glob discovery

Search these locations in order:
- `docs/**`
- `.aped/**`
- `docs/**` (project root)

Look for these artefacts (✱ = required):
- Completed story files — `docs/stories/*.md` ✱ (at least one with status `done` / `review-done` in `state.yaml`, or one explicitly named via `[story-key]` argument)
- PRD — `*prd*.md` or `prd.md`
- Architecture — `*architecture*.md` or `architecture.md`
- UX Spec — `ux/*.md` (sharded) or `*ux*.md`
- Epic Context Cache — `docs/epics-context/epic-{N}-context.md` (where N = epic number)
- Lessons — `docs/lessons.md` (filter entries with `Scope: aped-qa` or `Scope: all`)

### 2. Required-input validation (hard-stop)

For ✱ Completed story files:
- If at least one `*.md` exists under `docs/stories/` (or one was named via `[story-key]` argument): continue
- If none: HALT with this message:
  > "No completed story file found. QA requires at least one story whose ACs it can ground tests in. Run `aped-story` then `aped-dev` first, or pass an explicit `[story-key]` if the file lives elsewhere."

### 3. Framework detection (hard-stop)

Detect the project's test framework before generating any tests. Tests grounded in the wrong framework produce noise.

Search for, in order:
- `package.json` `dependencies` / `devDependencies` for one of: `playwright`, `cypress`, `puppeteer`, `vitest`, `jest`, `mocha`, `supertest`
- `pyproject.toml` / `requirements*.txt` for: `pytest`, `httpx`
- `go.mod` for `testing` (Go test) and HTTP testing libs
- `Cargo.toml` for `reqwest`, `tokio-test`
- A `playwright.config.*` / `cypress.config.*` / `vitest.config.*` / `jest.config.*` file at the project root

If zero matches: HALT and ask the user which framework to scaffold against — do not guess.

### 4. Load + report

Print a discovery report listing what was loaded:

> Discovery report:
> - Stories: {N} files {✓ loaded — ACs extracted | (none)}
> - PRD: {N} files {✓ loaded — user-journey context | (none)}
> - Architecture: {N} files {✓ loaded — integration-point context | (none)}
> - UX Spec: {N} files {✓ loaded | (none)}
> - Lessons: {✓ loaded | (none)}
> - **Framework detected:** {playwright|cypress|vitest|pytest|...} (from {package.json|pyproject.toml|...})
>
> [C] Continue with these inputs
> [Other] Add a file path / paste content — I'll load it and redisplay

⏸ **HALT — wait for `[C]` or additional inputs.**

## Scope Selection

Ask the user:
1. **What to test?** — specific story, full epic, or all completed work
2. **Test type?** — E2E (user journeys), Integration (API/service), or Both

## Story/Epic Analysis

For the selected scope:
1. Read story files from `docs/stories/`
2. Extract all Acceptance Criteria (Given/When/Then)
3. Map user journeys across stories (multi-step flows)
4. Identify integration points (APIs, databases, external services)

## Task Tracking

```
TaskCreate: "Analyze stories and extract ACs"
TaskCreate: "Generate E2E tests"
TaskCreate: "Generate integration tests"
TaskCreate: "Run and verify all tests"
TaskCreate: "Write QA report"
```

## Test Generation

Launch **2 Agent tool calls in parallel**:

### Agent 1: E2E Tests (`subagent_type: "general-purpose"`)

For each user journey that spans one or more stories:

1. Map the full flow: entry → steps → expected outcome
2. Generate test using the project's test framework
3. Each AC's Given/When/Then becomes a test step
4. Include:
   - Happy path (main flow)
   - Error paths (invalid input, unauthorized, not found)
   - Edge cases (empty data, concurrent access, timeouts)

### Agent 2: Integration Tests (`subagent_type: "general-purpose"`)

For each integration point:

1. Test request/response contracts
2. Test error handling (service down, timeout, malformed response)
3. Test data consistency (DB state before/after)
4. Test authentication/authorization boundaries

Once both agents return, update tasks to `completed`.

### Test Naming Convention

```
{test-type}/{epic-slug}/{story-slug}.test.{ext}
```

## Framework Detection

Read project config to auto-detect:
- **Node.js**: Playwright, Cypress, or Puppeteer for E2E; Supertest for API
- **Python**: Pytest + httpx for API; Playwright for E2E
- **Go**: Go test + httptest for API
- **Rust**: reqwest for API tests

Use `bash .aped/aped-dev/scripts/run-tests.sh` to verify tests pass. After the run, **read `.aped/.last-test-exit`** — exit `0` means pass, anything else fails the QA gate. Do NOT report "QA complete" based on a "looks like it passed" reading of stdout; the canonical evidence is `.aped/.last-test-exit`.

## Test Coverage Report

After generation:
- List ACs covered vs uncovered
- List user journeys tested
- List integration points tested
- Flag any untestable ACs (and why)

## Output

1. Write tests to project test directory (detect convention)
2. Write QA report to `docs/qa-report.md`:
   - Stories tested
   - Tests generated (count by type)
   - Coverage gaps
   - Manual test suggestions (for things that can't be automated)

## No State Change

QA doesn't affect pipeline state — it's an additive quality layer.

## Next Steps

Suggest running `aped-status` to view updated sprint status with QA coverage noted.

## Example

Epic 1 completed (3 stories) → generate QA:
- E2E: 5 tests covering registration → login → dashboard journey
- Integration: 3 API tests for auth endpoints
- Report: 8/8 ACs covered, 0 gaps, 1 manual test suggested (email verification)

## Common Issues

- **Test framework not detected**: Check project config — ensure test runner is in dependencies
- **ACs not testable**: Some ACs describe UX behavior — flag as "manual test required" in report
- **Tests fail on generated code**: Review the test — it may assume a specific API shape. Adapt to actual implementation
