---
step: 5
reads: []
writes:
  - "subagent/sam"
  - "subagent/eva"
  - "subagent/pm"
mutates_state: false
---

# Step 5: A/P/C Discussion Gate

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the user's choice — do NOT write epics.md or seed tickets before `[C]` is selected
- 🛑 Direct feedback is always accepted as a fallback — re-loop the menu after applying

## CONTEXT BOUNDARIES

- Epic structure draft + story list ready.
- FR coverage matrix surfaced.

## YOUR TASK

Present the draft to the user, offer the A/P/C menu, react to the choice.

## PRESENT THE DRAFT

Show:

- The epic structure with story titles.
- The FR coverage map.
- The implementation sequence (DAG → ordered list).
- Stories that look too large (likely needs splitting) or too granular (likely merge candidates).

## A/P/C MENU

```
Epic structure draft ready ({E} epics, {S} stories, {N} dependencies tracked).

Choose your next move:
[A] Advanced elicitation — invoke aped-elicit on the decomposition
    (Tree of Thoughts to compare alternative groupings; Pre-mortem to find
    sequencing risks; Occam's Razor to spot over-engineering)
[P] Party / Council — convene a 3-specialist sub-team to challenge the structure:
      • Sam (Fullstack Tech Lead) — story sizing, hidden coupling, cross-layer touches
      • Eva (QA Lead) — testability per story, AC coverage, integration test seams
      • A Product Manager persona — user-value coherence per epic, MVP boundary
    Each returns 2-4 findings; merge and present to the user.
[C] Continue — accept the structure, write epics.md + run coverage validation
[Other] Direct feedback — split a story, merge two, reorder, rename; type the change,
        I apply it and redisplay this menu
```

⏸ **HALT — wait for the user's choice. Do NOT write `epics.md` or seed the ticket system before `[C]` is selected.**

## BEHAVIOUR BY CHOICE

- `[A]` → invoke `aped-elicit` with the epic structure as target. When elicit returns enhanced content (e.g. *"Story 3 should be split — too many ACs touching different layers"*), apply the change and redisplay the menu.
- `[P]` → dispatch Sam + Eva + the PM persona in parallel via the `Agent` tool, each with the epic structure + PRD excerpt + their persona's brief. Merge findings, present as *"Council says: …"*, ask *"Apply any of these? (numbers / all / none)"*. On selection, integrate; redisplay the menu.
- `[C]` → mark the discussion task `completed`; proceed to step 06.
- Direct feedback → apply the user's edit; redisplay the menu.

## SUCCESS METRICS

✅ Draft presented with FR coverage map + DAG.
✅ A/P/C menu offered exactly once per loop iteration.
✅ User's `[C]` confirms before any output write.
✅ Direct feedback re-loops the menu.

## FAILURE MODES

❌ Auto-advancing without `[C]` — bypasses the user gate.
❌ Sequential dispatch in `[P]` — Sam/Eva/PM are parallel.
❌ Writing `epics.md` before `[C]` — premature and impossible to reverse cleanly.

## NEXT STEP

After `[C]`, load `.aped/aped-epics/steps/step-06-validate-and-spec-review.md`.
