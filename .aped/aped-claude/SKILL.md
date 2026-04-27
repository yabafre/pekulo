---
name: aped-claude
description: 'Updates CLAUDE.md with APED working rules, project config, and session patterns. Merges with existing content — never overwrites user customizations. Use when user says "update CLAUDE.md", "sync claude rules", "aped claude", or invokes /aped-claude.'
license: MIT
metadata:
  author: yabafre
  version: 3.7.6
---

# APED Claude — CLAUDE.md Sync

Inject and maintain APED working rules in the project's `CLAUDE.md`. Smart merge — never overwrites user customizations.

## Critical Rules

- NEVER overwrite the entire CLAUDE.md — always merge
- Use marker comments to delimit APED-managed sections: `<!-- APED:START -->` and `<!-- APED:END -->`
- User content outside markers is sacred — never touch it
- Discuss with the user before applying changes if CLAUDE.md is non-trivial

## Setup

1. Read `.aped/config.yaml` — extract `project_name`, `user_name`, `communication_language`
2. Check if `CLAUDE.md` exists at the project root

## Mode Detection

### Case A: No CLAUDE.md exists
- Create one from scratch with the full APED block (see Template below)
- Wrap the entire APED content in `<!-- APED:START -->` ... `<!-- APED:END -->` markers
- Add a header line and brief project description above the markers

### Case B: CLAUDE.md exists with APED markers
- Locate the `<!-- APED:START -->` and `<!-- APED:END -->` block
- Replace ONLY the content between markers with the latest APED block
- Leave everything else untouched

### Case C: CLAUDE.md exists WITHOUT APED markers
- Show the user the current CLAUDE.md content
- Ask: "Where should I inject the APED section? Options:"
  - **Top** — before existing content
  - **Bottom** — after existing content
  - **Custom** — point to a specific heading to insert before/after
- ⏸ GATE: Wait for user choice
- Insert the APED block (wrapped in markers) at the chosen location

## APED Block Template

The block to inject (between `<!-- APED:START -->` and `<!-- APED:END -->`) contains:

### Section 1: Project Header
- Project name from config
- One-line description: "Uses the APED Method — disciplined user-driven dev pipeline"
- Pipeline diagram: `Analyze → PRD → UX → Architecture → Epics → Story → Dev → Review`

### Section 2: Working Rules

**1. Plan Mode Default**
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

**2. Subagent Strategy**
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

**3. Self-Improvement Loop**
- After ANY correction from the user: update `docs/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Review lessons at session start

**4. Verification Before Done**
- Never mark a task complete without proving it works
- Run tests, check logs, demonstrate correctness
- Ask: "Would a staff engineer approve this?"

**5. Demand Elegance (Balanced)**
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: implement the elegant solution
- Skip for simple, obvious fixes — don't over-engineer

**6. Autonomous Bug Fixing**
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them

### Section 3: APED-Specific Rules

**7. Never Auto-Chain Phases** — Each APED skill ends with "Run /aped-X when ready". STOP. Wait for user.

**8. Validate Before Persisting** — Never write artifacts to `docs/` until the user has explicitly validated.

**9. Story-Driven Dev** — Never code without a story file. Use `/aped-story` first. Use the epic context cache.

**10. Frontend = Visual Verification** — Detect frontend stories. Use `mcp__react-grab-mcp__get_element_context` at every GREEN pass.

### Section 4: Task Management
1. **Plan First** — TaskCreate with checkable items
2. **Verify Plan** — Check in with user before implementation
3. **Track Progress** — TaskUpdate as you complete items
4. **Document Results** — Update story file's Dev Agent Record
5. **Capture Lessons** — Update `docs/lessons.md` after corrections

### Section 5: Core Principles
- **Simplicity First** — minimal code impact
- **No Laziness** — root causes, no temporary fixes
- **User Controls Pace** — collaborative, not automated
- **Quality > Speed** — validation gates exist for a reason

### Section 6: Project State
- Engine: `.aped/` (immutable after install)
- Artifacts: `docs/` (evolves during project)
- State machine: `docs/state.yaml`
- Lessons: `docs/lessons.md`
- Project: {{project_name}} ({{user_name}}, {{communication_language}})

### Section 7: Slash Commands Cheat Sheet

| Pipeline | Utility |
|----------|---------|
| /aped-analyze | /aped-status |
| /aped-prd | /aped-course |
| /aped-ux | /aped-context |
| /aped-arch | /aped-qa |
| /aped-epics | /aped-quick |
| /aped-story | /aped-check |
| /aped-dev | /aped-claude |
| /aped-review | |

## Lessons File

Also ensure `docs/lessons.md` exists. If missing, create it with the template:

```markdown
# Lessons Learned

Patterns from user corrections — so the same mistake isn't made twice.

## Format
- **Date:** YYYY-MM-DD
- **Mistake:** What I did wrong
- **Correction:** What the user told me
- **Rule:** The pattern to apply going forward

## Entries

<!-- Add new entries at the top -->
```

## Discussion with User

Before writing, present a summary:
- "Will create CLAUDE.md from scratch" (Case A)
- "Will update existing APED block (lines X-Y)" (Case B)
- "Will inject APED block at the {location}" (Case C)

⏸ **GATE: User confirms before any write.**

## Output

1. Write/update `CLAUDE.md` with the APED block in markers
2. Ensure `docs/lessons.md` exists
3. Report what changed (lines added/updated)

## Common Issues

- **CLAUDE.md has conflicting rules**: Discuss with user — APED rules vs existing rules. User decides which wins.
- **CLAUDE.md is huge (>500 lines)**: Show only the diff, not the full file. Confirm before write.
- **User wants to remove APED block**: Just delete the markers and content between them. The skill won't re-add unless explicitly invoked.

## Next Step

Tell the user: "CLAUDE.md updated. APED block is now at lines X-Y. Re-run `/aped-claude` anytime to refresh after APED updates."
