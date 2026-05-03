---
step: 1
reads:
  - ".aped/WORKTREE"
  - "git/HEAD"
  - "state.yaml#sprint.stories"
writes:
  - "tasks"
mutates_state: false
---

# Step 1: Initialization, Fresh-Context Check, Mode Detection

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If the implementation transcript is above this skill invocation, ABORT and tell the user to `/clear` first
- 🛑 NEVER reuse summary-of-PRD or cached state — read every artefact fresh in this skill
- 📖 ALWAYS read the complete step file before acting

## CONTEXT BOUNDARIES

- This is the first step of `aped-review`.
- Reviewer must run fresh — no prior implementation context in the same session.

## YOUR TASK

Detect mode (worktree vs solo), enforce fresh-context discipline, set up task tracking, resolve the target story.

## FRESH-READ DISCIPLINE

Read every artefact fresh in this skill — story file, PRD, architecture, UX spec, ticket comments, any prior review record. Never trust a cached or compacted summary; reviewing against a stale summary produces stale findings. If your context shows you a "summary of the PRD" instead of the file content, Read the file from disk.

## FRESH-CONTEXT HARD STOP

If you are running in the same Claude session that just implemented this story (i.e. the implementation transcript is above this skill invocation), abort immediately and surface to the user:

> ❌ Reviewer must run fresh — prior implementation context will bias the review. Run `/clear` then re-invoke `aped-review` for this story.

A reviewer running in the dumb zone (post-100k tokens, post-compaction) reviews dumber than the agent that wrote the code. APED's fresh-read discipline catches summary-vs-file drift, but only a clean session catches reasoning-vs-fresh-eyes drift.

## RED FLAGS — STOP IF YOU CATCH YOURSELF THINKING THESE

| Phrase | Why it's wrong |
|--------|----------------|
| "I checked the diff carefully" | Reading is not running. Run the tests. |
| "The implementation looks reasonable" | "Reasonable" has approved every shipped bug ever. |
| "There's no obvious bug" | "Obvious" bugs were caught by static analysis already. The non-obvious ones are your job. |
| "This is similar to other reviewed stories" | Then look harder — the differences are where bugs live. |
| "The dev agent reported tests passing" | Re-run them yourself. Reports are not evidence. |

## RATIONALIZATIONS — RECOGNIZE AND REJECT

| Excuse | Reality |
|--------|---------|
| "The diff is small enough to verify by reading" | You said this 3 times before and missed something each time. |
| "Re-running the tests is wasteful — they ran during dev" | The cost of one re-run is bounded; the cost of one false-pass is not. |
| "The user is waiting" | The user is waiting *because* they want a real review. A fast pass is worth nothing. |
| "Pattern compliance specialist already covered this" | Specialists check overlapping concerns precisely because each one misses different things. |

## MODE DETECTION

If `.aped/WORKTREE` exists, read the marker:

- Use its `story_key` instead of scanning state.yaml.
- Read the canonical state.yaml from the marker's `project_root`.

Otherwise, **classic mode**.

## STORY RESOLUTION

Read `docs/state.yaml` and resolve the target story:

- If the user passed `{story-key}` as argument, use it.
- Else if in worktree mode, use the marker's story.
- Else find the first story with status `review`.
- If none found: report *"No stories pending review"* and STOP.

## TASK TRACKING

Create one task per major step:

- "Setup + context load"
- "Story classification"
- "Stage 1 — Eva"
- "Stage 1.5 — adversarial (if enabled)"
- "Stage 2 — parallel specialists"
- "Merge findings"
- "Verification gate"
- "Present report to user"
- "Apply fixes"
- "Re-verify"
- "Update remote (ticket + PR)"
- "Update story file (Review Record) + state.yaml"

## SUCCESS METRICS

✅ Fresh-context guard passed (or HALT triggered).
✅ Mode detected.
✅ Story key resolved.
✅ Task tracking initialized.

## FAILURE MODES

❌ Reviewing in the same session as the implementation — produces biased findings.
❌ Skipping the WORKTREE marker check — reviewer reads the wrong state.yaml.
❌ Picking the wrong story (no key passed, no `review`-status story exists) — wastes a dispatch round.

## NEXT STEP

Load `.aped/aped-review/steps/step-02-input-discovery.md` to discover and load every upstream artefact.
