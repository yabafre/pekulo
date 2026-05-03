---
step: 6
reads:
  - "docs/stories/{story-key}.md"
  - "src/**"
  - "tests/**"
writes:
  - "src/**"
  - "tests/**"
  - "git/commits"
  - ".aped/.last-test-exit"
  - "mcp/react-grab.get_element_context"
mutates_state: false
---

# Step 6: TDD Cycle (RED → GREEN → REFACTOR → GATE)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER write production code before a failing test
- 🛑 The witness token is mandatory at RED: *"Confirmed RED: <test-name> failed at <file:line> — <reason>"*
- 🛑 Schema-identifier grounding: never invent table / column / enum / API path names — grep upstream first
- 🚫 NEVER use `git add .` — stage specific files only
- 🚫 3 consecutive failures = HALT and invoke `aped-debug`, do NOT try fix #4

## CONTEXT BOUNDARIES

- Pre-implementation checklist + frontend setup done.
- One TaskCreate per story task; status `pending`.
- Iterate this step ONCE PER STORY TASK.

## YOUR TASK

Run RED → GREEN → REFACTOR → GATE for each story task. Commit after each GREEN gate, not at the end.

## REFERENCE

Read `.aped/aped-dev/references/tdd-engine.md` for detailed rules (test framework detection, run script, watch mode).

## FR/NFR GROUNDING

Every test you write must trace back to a specific AC in the story file, which itself must trace back to a PRD FR or NFR ID. If a test doesn't cite an AC, it's drift — fix the story or skip the test. If an AC doesn't cite an FR/NFR ID, the story is malformed — surface to the user instead of guessing the requirement.

## VERBATIM SPEC-QUOTE RULE

Above each test you write AND above each non-trivial code block you add for an AC, paste the **literal AC text** as a comment. Format:

```ts
// AC-3 (verbatim from story 1-2-jwt:42):
//   Given a valid JWT, when validateToken() is called, then it returns
//   { ok: true, payload }; given an expired JWT, it returns
//   { ok: false, reason: "expired" }.
test("AC-3 — expired JWT returns ok:false reason:expired", () => {
  ...
});
```

The comment costs 3 lines and prevents the most common drift class: paraphrasing the AC during translation, then writing a test that exercises the *paraphrase* rather than the AC. If the AC cannot be quoted verbatim because it's vague — that's a story bug, not a TDD bug; surface it to the user via re-running `aped-story` rather than inventing your own clearer wording.

## CYCLE PER TASK

For each task in the story (TaskUpdate to `in_progress` when starting):

### RED

Write failing tests first. Run:

```bash
bash .aped/aped-dev/scripts/run-tests.sh
```

**Witness the failure.** After the test run, your next assistant message MUST contain a single line of the form:

> `Confirmed RED: <test-name> failed at <file:line> — <reason>`

Where `<reason>` is the actual error from the test runner (assertion message, stack frame, missing-module hint), not a paraphrase. Skip this token only when you are continuing GREEN on a test that was already RED in a prior cycle of the same session.

The witness token is what makes cheating mechanically harder — without it, you can claim RED without running tests.

### Schema-identifier grounding

Before writing ANY migration / table name / column name / enum value / API path, grep the upstream story file and PRD for that exact identifier (case-sensitive). If the literal name does not appear verbatim in either source, **HALT and ask the user — never invent**. Inventing identifiers is the canonical hallucination mode.

### GREEN

Write minimal code to pass. Run:

```bash
bash .aped/aped-dev/scripts/run-tests.sh
```

**Frontend tasks:** after tests pass, use React Grab to verify the component renders correctly in the layout.

### REFACTOR

Improve structure while green. Run tests again — they must stay green.

### GATE

Mark `[x]` ONLY when:

- Tests exist.
- Pass 100%.
- Implementation matches the story spec.
- ACs satisfied (cross-check verbatim quote vs test assertion).
- No regressions (full suite green, not just the new test).
- **Frontend tasks:** add a 6th condition — React Grab visual check confirms component matches UX spec.

When the GATE passes:

```bash
git add <files-just-changed>
git commit -m "feat({ticket}): <task description> [AC-N]"
```

(Drop `({ticket})` if `ticket_system: none`.)

## HALT CONDITIONS

**STOP and ask user if:** new dependency, 3 consecutive failures, missing config, ambiguity.

### 3-failed-fixes rule

If a task's test has gone red 3 times in a row — **three attempts that did not turn the original failing repro green** — **do not try fix #4**. Invoke `aped-debug`. A "different test broke" counts as not turning the original repro green. The fourth attempt to patch a misunderstood cause costs more than the fifteen minutes of stepping back.

`aped-debug` Phase 1 inherits the failing test as the repro and immediately HALTs to question the architecture/spec/test rather than the fix.

### Parallel-sprint mode — post a `dev-blocked` check-in

In a worktree session, the user is in `aped-lead` in main, not watching this terminal. A silent HALT is invisible to them. Before stopping, post a check-in so `aped-status` surfaces it and `aped-lead` can escalate:

```bash
bash ${project_root}/.aped/scripts/checkin.sh post {story-key} dev-blocked "<one-line reason — e.g. 'new dep needed: foo@^2.0'>"
```

Then HALT and tell the user in this worktree: *"Posted dev-blocked check-in — Lead will see it on next aped-lead or aped-status. Waiting for instruction."*

In classic (non-parallel) mode, just HALT inline — the user is here.

## SUCCESS METRICS

✅ Each task ran RED → GREEN → REFACTOR → GATE in order.
✅ Witness token captured at every RED.
✅ Schema identifiers verified verbatim against story / PRD.
✅ Commit after each GREEN gate.
✅ TaskUpdate flips to `completed` only after GATE passes.

## FAILURE MODES

❌ Skipping RED ("the test would obviously fail").
❌ Inventing a column name not in the PRD.
❌ Batching commits — one per task, not one per story.
❌ Using `git add .` — accidental commits of `.env`, lockfile diffs, debug files.
❌ Trying fix #4 instead of invoking `aped-debug`.

## NEXT STEP

After ALL story tasks have passed their GATE, load `.aped/aped-dev/steps/step-07-verification.md` to walk the verification gate before declaring `review`.
