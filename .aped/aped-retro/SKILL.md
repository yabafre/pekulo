---
name: aped-retro
description: 'Post-epic retrospective: extracts systemic lessons, assesses readiness, detects significant discoveries.'
when_to_use: 'Use when user says "retro", "retrospective", "review the epic".'
argument-hint: "[epic-number]"
allowed-tools: Read Write Edit Glob Grep Bash Agent TaskCreate TaskUpdate
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Retro — Post-Epic Review & Next-Epic Readiness

## Critical Rules

- NEVER name individuals as failure causes — focus on systems, processes, and patterns
- NEVER mark a retro complete without at least 3 concrete action items with owners
- NEVER skip the readiness assessment — a "done" epic that isn't production-ready blocks the next one
- ALWAYS check if retro discoveries require updates to the next epic's plan
- Persist all lessons to `docs/lessons.md` — retros must be actionable across epics

## Guiding Principles

### 1. Systems Over People
Every "mistake" is a system gap. If the dev struggled with migrations, the doc was insufficient or the review process missed a signal. Root-cause the system, not the human.

### 2. Continuity Matters
Retros without follow-through are theater. Always cross-reference the previous retro's action items — did we do them? Did they help?

### 3. Forward and Backward
Half of a retro is looking back (what did we learn). The other half is looking forward (what does the next epic need). Both halves are mandatory.

### 4. Specific Examples Beat Generalizations
"Testing was hard" is useless. "Story 1-3 had 5 review rounds because the AC wording allowed two valid interpretations" is actionable.

## Setup

1. Read `.aped/config.yaml` — extract `user_name`, `communication_language`
2. Read `docs/state.yaml` — find the target epic:
   - If user passed `{epic-number}`: use it
   - Else: find the highest epic number with all stories at `status: done`
   - If no epic is fully done: ask the user which epic to review (partial retro possible with a warning)
3. Verify epic completeness:
   ```
   For epic N, list all stories matching key prefix "N-"
   Count total vs done
   If not all done: ask user — proceed with partial retro or wait for completion?
   ```

## Phase 1: Deep Story Analysis (parallel specialists)

Dispatch 3 specialists in parallel via `Agent` tool (`subagent_type: Explore`, `run_in_background: false`):

### Specialist A — Struggle Analyzer (Mia)
> You are **Mia**, a systemic analyst reading post-mortem data. Read every story file in `docs/stories/` with prefix `{epic-number}-`. Extract:
> - **Dev Notes / Implementation Notes / Development Log** — where devs struggled, unexpected complexity, failed technical decisions
> - **Review Feedback patterns** — recurring findings across stories
> - **Lessons Learned sections** — explicit takeaways
> - **Technical Debt sections** — shortcuts taken and why
>
> Synthesize: what patterns appear in 2+ stories? What systemic gaps do they reveal? Return a structured report — no blame, no individuals, only patterns.

### Specialist B — Velocity & Quality Analyzer (Leo)
> You are **Leo**, a delivery analyst. Read every story file with prefix `{epic-number}-` and related ticket data (via `gh` CLI if `ticket_system: github`, or `linear-cli` for Linear).
> - Count review rounds per story — which stories needed the most iteration?
> - Classify each story's complexity vs actual effort (tasks count, files touched, commits)
> - Identify quality signals — bugs found in review, regressions caught, test coverage shifts
> - Flag breakthroughs — caching patterns, helper extractions, test strategies that should propagate
>
> Return a structured report of velocity patterns and quality signals.

### Specialist C — Previous-Retro Auditor (Ava)
> You are **Ava**, a continuity auditor. Check if `docs/retros/epic-{N-1}-retro.md` exists.
> - If yes: extract every action item, lesson, and team agreement from the previous retro
> - Cross-reference against `docs/stories/` for epic {N} — was each action item applied? What's the evidence?
> - For each prior action item: mark ✅ Completed / ⏳ In Progress / ❌ Not Addressed with evidence
> - For each prior lesson: note where it was applied successfully OR where the team repeated the same mistake
>
> If no prior retro exists: return a one-line "First retro for this project" note.

Wait for all 3 to complete.

## Phase 2: Next-Epic Preview

Read `docs/epics.md` (or `docs/epics/epic-{N+1}.md` if sharded) to surface the next epic's outline.

Analyze:
- **Dependencies on epic {N}** — what does epic {N+1} rely on that we just built?
- **Technical prerequisites** — APIs, schemas, infra that must be ready
- **Knowledge gaps** — topics the team hasn't touched yet
- **Risk indicators** — unknowns, fragile assumptions

If no epic {N+1} exists: note "final epic — no forward dependencies to check".

## Phase 3: Synthesis & User Discussion

Present to the user, structured:

### Section A — Epic {N} Summary
- Stories completed: {count}/{total}
- Review iterations: avg {N} per story, worst: story {K} with {M} rounds
- Technical debt logged: {count} items
- Key patterns from Mia: {top 3}
- Velocity signals from Leo: {top 3}
- Previous-retro follow-through from Ava: {summary}

### Section B — Discussion Prompts
Ask the user directly (adapt to `communication_language`):
1. "What went well? Cite a specific story or moment."
2. "What didn't go well? Same — cite specifics."
3. "What surprised you? (positive or negative)"
4. "What would you do differently in epic {N+1}?"

⏸ **GATE: Wait for the user's reflections before synthesizing action items.**

## Phase 4: Action Items

Based on Phase 1 specialist reports + Phase 3 user input, draft action items.

Each action item MUST be SMART:
- **Specific:** Clear, unambiguous
- **Measurable:** Can verify completion
- **Achievable:** Realistic given constraints
- **Relevant:** Addresses a real pattern from this retro
- **Time-bound:** Has a deadline tied to epic {N+1}

Categorize:
- **Process improvements** (review process, story splitting, ticket format)
- **Technical debt** (items to address before epic {N+1} to avoid blockers)
- **Documentation** (missing docs that caused struggle)
- **Team agreements** (rules the team commits to follow)

Minimum 3 action items across categories. If fewer: the specialists missed something — re-dispatch.

Present to user, refine with their input.

⏸ **GATE: User validates the action item list + owners + deadlines.**

## Phase 5: Significant Discovery Detection

Check against these triggers (be honest — don't suppress to avoid scope change):

- Architectural assumption from planning proven wrong during epic {N}
- Major scope change or descope that affects epic {N+1}
- Technical approach needs fundamental change
- Dependencies discovered that epic {N+1} doesn't account for
- User needs significantly different than originally scoped
- Performance / security / compliance issue that changes the approach
- Integration assumption proven incorrect

If ANY trigger fires:
- Present to the user as `🚨 Significant Discovery`
- Recommend: update epic {N+1} definition, hold a planning-review session, OR invoke `/aped-course` to formally pivot
- Add "Epic {N+1} planning review" to the critical path

## Phase 6: Readiness Assessment

Before closing, check epic {N} is truly production-ready:

- **Testing:** All tests passing? Coverage sufficient?
- **Deployment:** Shipped to production, or staged?
- **Acceptance:** Stakeholders signed off?
- **Technical health:** Codebase stable, or fragile?
- **Blockers carried forward:** Any unresolved issues affecting epic {N+1}?

For each, ask the user directly. Any concern → add to critical path before epic {N+1} kickoff.

⏸ **GATE: User confirms the readiness assessment.**

## Phase 7: Persist Outputs

### 1. Retro file

Write `docs/retros/epic-{N}-retro-{date}.md`:

```markdown
# Epic {N} Retrospective — {date}

## Summary
- Stories: {count}
- Duration: {span from first to last merge}
- Patterns: {top 3 from Mia}
- Velocity signals: {top 3 from Leo}
- Previous retro follow-through: {summary from Ava}

## What Went Well
{bullet list — cite stories}

## What Didn't
{bullet list — cite stories}

## Key Lessons
{distilled — 3-5 bullets}

## Action Items
| # | Action | Owner | Deadline | Category | Success Criteria |
|---|---|---|---|---|---|
| 1 | ... | ... | ... | ... | ... |

## Significant Discoveries
{none | list + impact on epic N+1}

## Readiness Assessment — Epic {N}
| Dimension | Status | Notes |
|---|---|---|
| Testing | ✅/⚠️/❌ | ... |
| Deployment | ... | ... |
| Acceptance | ... | ... |
| Technical health | ... | ... |
| Blockers forward | ... | ... |

## Critical Path Before Epic {N+1}
{ordered list with owners + deadlines — empty if none}
```

Ensure output directory:
```bash
mkdir -p docs/retros
```

### 2. Lessons file

Append distilled lessons to `docs/lessons.md`:

```markdown
---
## Epic {N} — {date}

### Mistake: {systemic pattern from retro}
**Correction:** {what should change}
**Rule:** {pattern to apply going forward}
**Scope:** {affects /aped-dev | /aped-review | /aped-story | all}

(repeat for each significant lesson)
```

## State Update

Update `docs/state.yaml`:

```yaml
pipeline:
  phases:
    sprint:
      active_epic: {N+1 if exists, else null}
      retros:
        epic_{N}:
          status: done
          file: docs/retros/epic-{N}-retro-{date}.md
          action_items_count: {N}
          critical_path_count: {N}
          significant_discoveries: {bool}
          completed_at: {date}
```

## Next Step

Tell the user (adapt to `communication_language`):
> "Retro saved at `docs/retros/epic-{N}-retro-{date}.md`. Lessons appended to `docs/lessons.md`.
>
> Next: {depending on outcomes}
> - No significant discoveries + no critical path → `/aped-story` to start epic {N+1}'s first story
> - Critical path items → address them in order, then `/aped-story`
> - Significant discoveries → `/aped-course` to formally pivot OR re-run `/aped-epics` to update the epic plan"

**Do NOT auto-chain.** The user decides the next move.

## Example

User: "retro on epic 1"

1. Setup: epic 1 found in state.yaml, all 5 stories done
2. Phase 1: dispatch Mia + Leo + Ava in parallel
   - Mia: 3 stories had review rounds >3, all flagging unclear error handling
   - Leo: velocity trend improved story 3 onward after helper extraction
   - Ava: no prior retro (first epic)
3. Phase 2: epic 2 exists, depends on auth middleware from epic 1
4. Phase 3: user reflects on what went well/didn't
5. Phase 4: 4 action items (error handling convention, review checklist, helper library, TDD gate tweak)
6. Phase 5: no significant discoveries
7. Phase 6: readiness assessment — all green except "deployment not yet scheduled"
8. Phase 7: retro file written, lessons appended, state.yaml updated
9. Next step: "Schedule the deploy, then /aped-story for epic 2 first story"

## Common Issues

- **Partial epic (not all stories done)**: warn the user, allow partial retro but flag it in the retro file's header.
- **Specialists return thin data**: retry with broader scope or merge inline if 2 out of 3 have enough signal.
- **User resists negative findings**: hold the line — retros without honest findings are theater. Reframe as "the system failed you, let's fix the system".
- **Action items without owners**: push back. Every action needs a human or a role. "The team" is not an owner.
- **Repeated lesson from previous retro**: this is the most important finding. Flag it explicitly: "We committed to X in epic {N-1}, didn't do it, and paid for it here".
