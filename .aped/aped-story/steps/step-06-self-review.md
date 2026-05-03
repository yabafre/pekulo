---
step: 6
reads:
  - "docs/stories/{story-key}.md"
writes:
  - "docs/stories/{story-key}.md"
mutates_state: false
---

# Step 6: Self-Review (run before user gate)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Each `[ ]` must flip to `[x]` or HALT — no item silently passes
- 🛑 If lint exits 1, present its output verbatim and ask the user `[F]ix` / `[O]verride`
- 🚫 NEVER present a story to the user with unchecked items

## CONTEXT BOUNDARIES

- Story file written to disk (step 05).
- `state.yaml` flipped to `ready-for-dev`.
- Feature branch checked out, no commit yet.

## YOUR TASK

Walk the self-review checklist. Each item below maps to a Reader-persona failure mode this step exists to catch.

## CHECKLIST

- [ ] **Placeholder lint** — run `bash .aped/scripts/lint-placeholders.sh docs/stories/{story-key}.md`. If exit 1, present output verbatim and ask the user `[F]ix` / `[O]verride`.

- [ ] **Exact file paths** — every Execution task references a real file path (not "the auth module"). Persona check: the junior should not have to grep.

- [ ] **Test commands** — every task with verifiable behaviour has an exact test command and expected output (not "run the tests").

- [ ] **Given/When/Then ACs** — every Acceptance Criterion follows the Given/When/Then form. No bare "make it work" lines.

- [ ] **AC behavioural discipline** — Acceptance Criteria describe user-visible behaviour or interface contracts, not implementation paths. No file paths, no line numbers, no internal helper names in ACs. ("The system rejects expired tokens" — yes. "The validateToken function in src/auth/jwt.ts:42 throws TokenExpiredError" — no.) File paths and code blocks belong in Tasks, not ACs.

- [ ] **Dependencies done** — every entry in `depends_on:` is a story whose status is `done` in `state.yaml`.

- [ ] **Reader-persona check** — re-read the story top-to-bottom asking *"would the junior produce the right code from this?"* If any answer is "probably not", fix.

- [ ] **Task granularity contract** — every Execution task has all five must-haves (exact path, full code, exact test command, expected output, literal commit step) and is estimated 2–5 min for the junior persona. Split anything bigger; rewrite anything that matches a Forbidden pattern from the contract.

- [ ] **Branch coherence** — `git symbolic-ref --short HEAD` matches `feature/{ticket}-{slug}`. The story file's `**Branch:**` field equals that value.

- [ ] **State.yaml coherence** — `sprint.stories.{key}.status` is `ready-for-dev`. In worktree mode, this is the worktree-local copy.

## SUCCESS METRICS

✅ All checkboxes flipped to `[x]`.
✅ Lint passed (or override recorded with reason).

## FAILURE MODES

❌ Silent pass on any item — the rationalization is *"close enough"*; reality is *"junior misreads"*.
❌ Override without recording the reason — future debugging will find the override but not the why.
❌ Marking branch coherence ✓ while on `main` — that's the gate this whole skill exists to prevent.

## NEXT STEP

Load `.aped/aped-story/steps/step-07-finalize.md` to commit (worktree mode), sync the ticket, and post the check-in.
