---
step: 4
reads: []
writes: []
mutates_state: false
---

# Step 4: Collaborative Story Design

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for explicit user validation before writing the file (load-bearing gate)
- 🛑 NEVER finalize the story without the Reader-persona check
- 🚫 Snippets in tasks = forbidden; full code blocks only

## CONTEXT BOUNDARIES

- Story key, ticket, and feature branch are set.
- Upstream artefacts are loaded.
- The story file does NOT yet exist on disk.

## YOUR TASK

Present a draft story to the user, discuss, refine. Lock in the file structure and tasks BEFORE step 05 writes the file.

## READER PERSONA — THE TESTABLE TARGET

> Stories must be readable by an **enthusiastic junior engineer with poor taste, no judgement, no project context, and an aversion to testing**. If the story leaves room for interpretation, that junior will pick the wrong path. Granularity, exactness of file paths, and explicit test commands are non-negotiable.

This persona is the canonical reader of every story you produce. When in doubt about whether a detail is necessary, ask: **would the junior produce the right code from this without it?** If no, write it.

| Failure | What the junior does |
|---------|---------------------|
| No file path | Creates a new file in the wrong directory. |
| Snippet instead of full code | Fills the gap from training-data templates and misses the project's conventions. |
| No test command | Skips testing. |
| "Similar to story X" | Copies the wrong differences. |
| "Add appropriate error handling" | Catches every exception and `console.log`s it. |

## RED FLAGS — STOP IF YOU CATCH YOURSELF THINKING THESE

| Phrase | Why it's wrong |
|--------|----------------|
| "Implement the validation logic similar to story X" | "Similar to" loses the differences that matter. Write what *this* story needs. |
| "Add appropriate error handling" | "Appropriate" is the agent's escape hatch. Specify the error cases. |
| "Follow the existing pattern" | If the pattern is load-bearing, name it and link to one example. |
| "The dev will figure it out from the architecture doc" | The dev has fresh context per task — assume zero memory. |
| "I'll list the files affected, the dev will know which functions" | List the functions. List the line numbers if they exist. |

## RATIONALIZATIONS — RECOGNIZE AND REJECT

| Excuse | Reality |
|--------|---------|
| "This would be too verbose if I wrote it all out" | The cost of verbosity is bytes. The cost of ambiguity is rework. |
| "The dev agent has the project context" | Fresh subagents per task. No inherited context. None. |
| "Tests are obvious from the AC" | If they are, write them. If they aren't, write them anyway. |
| "I'll add the missing details when the dev asks" | The dev won't ask — it'll guess and ship. |

## Step 0 — Quote current symbols (before designing)

For any task that modifies existing code:

1. Read the file(s) being modified first.
2. Quote the current state of every symbol you intend to change verbatim.
3. Drop the quoted block into the story's Dev Notes (you'll write it in step 05) — function signature, type definition, exported constant, current return shape, current error path.

The most common plan-vs-reality mismatch is the writer's mental model of the code differing from the actual code at write time. The verbatim quote is the only mechanism that catches this *before* the dev agent burns three RED cycles.

Example block (will go into Dev Notes in step 05):

```markdown
### Existing code at write time

`src/auth/jwt.ts:45-58` (current):
```ts
export function signToken(payload: Payload): string {
  // current implementation
  ...
}
```

This story modifies the return shape from `string` to `{ token: string; expiresAt: number }`.
```

If the file does not exist yet (greenfield story), say so explicitly: `### Existing code: none — this is a new file.` Do not skip Step 0 silently.

## File structure design (upfront)

Before defining tasks, map out which files this story will create or modify and what each one is responsible for. **This is where decomposition decisions get locked in** — a story with eight tasks but no file map produces eight tasks that each end up touching three files apiece.

Design units with clear boundaries. Each file should have **one clear responsibility**. Files that change together should live together — split by responsibility, **not by technical layer**. (A "controller / service / repository" trio that only ever changes together for a single feature is one responsibility split into three files; a single auth file that handles both registration and authorization is two responsibilities crammed into one.)

In existing codebases, follow established patterns. Do not unilaterally restructure as part of a story; if the file you're touching has grown unwieldy, including a targeted split in this story's File List is reasonable.

For each file the story creates or modifies, prepare a 3-bullet decision template (you'll drop it into Dev Notes in step 05):

- **File name + path** — exact relative path from repo root.
- **Single responsibility** — one sentence stating what this file is for. If the sentence needs an "and", split the file.
- **Inputs + outputs** — what this file imports / depends on, and what it exports / returns.

This file map is the input to the Task granularity contract — every task references one of these files by exact path.

## DRAFT THE STORY

Present a draft to the user (in `communication_language`):

### Story structure

- **Title** — user-facing outcome.
- **As a** [role], **I want** [capability], **so that** [benefit].
- **Acceptance Criteria** — detailed Given/When/Then (refine from `epics.md` high-level ACs).
- **File List** — drawn from the file structure design above.
- **Tasks** — produced from the granularity contract (next section).

### Discussion points (ask the user)

- "Does this scope feel right for one dev session?"
- "Any technical constraints I should know about?"
- "Should we split this differently?"
- "Any edge cases you're thinking about?"
- "Per Epic {N}'s retro lesson on `{topic}`, I'd suggest {adjustment}. Override?"

⏸ **GATE: User must validate the story scope and ACs before step 05 writes the file.**

## TASK GRANULARITY CONTRACT

Every task in the Execution list MUST satisfy all five conditions below.

### Five must-haves per task

1. **Exact file path** — repository-relative or absolute. Not "the auth module".
2. **Full code block** — complete code to add or replace, not a snippet.
3. **Exact test command** — the literal command to run (e.g. `pnpm vitest run tests/auth.test.ts`).
4. **Expected output** — at minimum, the pass line the test produces (`✓ should reject expired tokens`, `Tests: 4 passed`, exit 0).
5. **Commit step** — literal `git add <files> && git commit -m "<message>"`.

### Estimated runtime: 2–5 minutes per task

A task longer than 5 minutes is too coarse — split it.

### Forbidden patterns (audit during step 06 self-review)

| Pattern | Why it fails | What to write instead |
|---------|--------------|----------------------|
| "see line X of file Y" | Line numbers drift; the junior won't open the file at the right time. | Inline the relevant code in the task. |
| "snippet only" / "..." inside code | Forces the junior to invent the missing parts. | Full code block, even if 30 lines. |
| "commit when done" | "Done" is the junior's judgment call — they always say yes. | Literal `git add ... && git commit -m "..."`. |
| "fill in error handling" | "Appropriate" is the agent's escape hatch. | Specify the error cases, the response codes, the retry policy. |
| "similar to task N" | Loses the differences that matter. | Write what *this* task needs in full. |

### Good task example

```markdown
- [ ] **Add `validateToken` to `src/auth/jwt.ts`**
  Add the function below to `src/auth/jwt.ts` (alongside `signToken`):
  ```ts
  export function validateToken(token: string): { sub: string; exp: number } {
    const { sub, exp } = jwt.verify(token, JWT_SECRET) as { sub: string; exp: number };
    if (Date.now() / 1000 > exp) throw new TokenExpiredError();
    return { sub, exp };
  }
  ```
  Run: `pnpm vitest run tests/auth/jwt.test.ts`
  Expected: `Tests: 4 passed`, exit 0.
  Commit: `git add src/auth/jwt.ts tests/auth/jwt.test.ts && git commit -m "feat(auth): add validateToken (FR-12)"`
```

## SUCCESS METRICS

✅ Story 0-quote completed for every modified file.
✅ File structure mapped (3-bullet template per file).
✅ Draft presented to the user with Discussion Points.
✅ User validated scope + ACs.
✅ Every task in the draft satisfies all 5 granularity must-haves.

## FAILURE MODES

❌ Writing the story file before the user validates scope.
❌ Skipping Step 0 silently for modified files.
❌ Tasks containing forbidden patterns ("similar to", "appropriate", "commit when done").
❌ Forgetting to surface the lesson-driven adjustment.

## NEXT STEP

After user validation, load `.aped/aped-story/steps/step-05-write-story.md` to write the story file.
