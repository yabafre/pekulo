---
name: aped-elicit
keep-coding-instructions: true
description: 'Use when user says "elicit", "critique this", "stress-test", "deeper review", "pre-mortem", "red team", "socratic", "tree of thoughts", "first principles", or invokes aped-elicit. Horizontal — invokable at any phase.'
when_to_use: 'Use when user says "critique this", "stress-test", "deeper review", "socratic", "pre-mortem", "red team".'
argument-hint: "[method-name | target-file]"
allowed-tools: Read Write Edit Glob Grep Bash TaskCreate TaskUpdate
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.12.5
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Elicit — Deep Critique Toolkit

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Critical Rules

- NEVER apply changes without explicit user consent (y/n per method)
- NEVER batch multiple methods without asking — each method is a separate iteration
- ALWAYS show the enhanced version alongside the original so the user sees what changed
- Stay relevant — tie every critique to the specific section being reviewed
- If the user selects 'x' (proceed), return enhanced content as final — no further methods applied

## Guiding Principles

### 1. Horizontal Tool, Not a Phase
Elicit is invokable from anywhere — inside `aped-prd`, `aped-arch`, `aped-story`, `aped-review`, or standalone. It does NOT appear in the pipeline linearly.

### 2. One Method at a Time
Each method is a distinct lens. Applying two at once muddles the signal. Run them sequentially, show results, re-offer the menu.

### 3. Surface the Invisible
The value of elicitation is revealing what was implicit: unstated assumptions, missing alternatives, unexamined risks, weak reasoning. If the method didn't surface something new, try another.

## Setup

1. Determine the **target**:
   - If user passed a file path: read that file, work on its current top-level content OR ask which section
   - If user passed a method name (e.g., `pre-mortem`): skip selection, apply directly to the conversation's most recent substantive content
   - If neither: ask "What do you want to put through elicitation?" — a file, a recent decision, a draft section
2. Confirm the target before proceeding:
   > "Target: {file/section/decision}. Content being critiqued: {1-line summary}. Correct?"

⏸ **GATE: User confirms the target.**

## Method Registry

Context-aware selection. Pick 5 based on the target's characteristics:

| # | Category | Method | Use For | Output Pattern |
|---|---|---|---|---|
| 1 | core | **Socratic Questioning** | Hidden assumptions, underexamined claims | questions → revelations → understanding |
| 2 | core | **First Principles Analysis** | Received wisdom, conventional solutions | assumptions → truths → new approach |
| 3 | core | **5 Whys Deep Dive** | Symptoms presented as causes | why chain → root cause → solution |
| 4 | risk | **Pre-mortem Analysis** | Pre-launch decisions, plans with hidden failure modes | failure scenario → causes → prevention |
| 5 | risk | **Red Team vs Blue Team** | Security, robustness, competitive threats | defense → attack → hardening |
| 6 | risk | **Failure Mode Analysis** | Component designs, system architectures | components → failures → prevention |
| 7 | risk | **Identify Potential Risks** | Plans and proposals | categories → risks → mitigations |
| 8 | competitive | **Devil's Advocate Challenge** | Groupthink, weakly justified choices | assumptions → challenges → strengthening |
| 9 | competitive | **Shark Tank Pitch** | Business claims, value propositions | pitch → challenges → refinement |
| 10 | advanced | **Tree of Thoughts** | Multiple viable paths, branching decisions | paths → evaluation → selection |
| 11 | advanced | **Self-Consistency Validation** | High-stakes decisions needing verification | approaches → comparison → consensus |
| 12 | advanced | **Meta-Prompting Analysis** | The approach itself may be suboptimal | current → analysis → optimization |
| 13 | creative | **SCAMPER** | Improving existing concepts (substitute/combine/adapt/modify/put/eliminate/reverse) | 7 lenses |
| 14 | creative | **What If Scenarios** | Constraint relaxation, extreme exploration | scenarios → implications → insights |
| 15 | creative | **Reverse Engineering** | Goal is clear, path is unclear | end state → steps backward → path forward |
| 16 | research | **Comparative Analysis Matrix** | Multi-option decisions with weighted criteria | options → criteria → scores → recommendation |
| 17 | retrospective | **Hindsight Reflection** | Imagining future selves evaluating today's choice | future view → insights → application |
| 18 | philosophical | **Occam's Razor Application** | Overengineered solutions, unnecessary complexity | options → simplification → selection |
| 19 | learning | **Feynman Technique** | Complex explanations that may hide gaps | complex → simple → gaps → mastery |

## Smart Selection (Default Menu)

Based on the target, pre-select 5 methods with diverse categories. Always bias batch 1 toward the 2 most relevant for this specific target.

### Selection Heuristics

- **Architectural decision** → Tree of Thoughts, Pre-mortem, First Principles, Failure Mode Analysis, Devil's Advocate
- **Product decision / PRD** → Socratic, Pre-mortem, Shark Tank, What If, Devil's Advocate
- **Technical design** → First Principles, Failure Mode, Tree of Thoughts, Occam's Razor, Red Team
- **User-facing copy / PR** → Feynman, Devil's Advocate, Socratic, What If, Meta-Prompting
- **Risk assessment / plan** → Pre-mortem, Identify Potential Risks, Red Team, Failure Mode, Hindsight
- **Default (mixed content)** → Socratic, First Principles, Pre-mortem, Devil's Advocate, Tree of Thoughts

## The Loop

### Display

```
**APED Elicitation Options**
Target: {what's being critiqued}

Choose a number (1-5), [r] reshuffle, [a] list all, or [x] proceed:

1. {Method Name} — {one-line summary}
2. {Method Name} — {one-line summary}
3. {Method Name} — {one-line summary}
4. {Method Name} — {one-line summary}
5. {Method Name} — {one-line summary}
r. Reshuffle with 5 new options
a. List all methods
x. Proceed / no more critique
```

### Case Handling

**1-5 (numbered selection)**
1. Execute the method against the target content
2. Show the enhanced / critiqued version alongside what changed
3. Ask: "Apply these changes to the source? (y/n/other)" — HALT
4. On `y`: apply changes to the file/content. On `n`: discard. On other: follow the user's instruction.
5. Re-present the same 1-5,r,a,x menu for another iteration

**r (reshuffle)**
- Pick 5 new methods from different categories than the previous menu
- Present the same menu format

**a (list all)**
- Show the full method registry in a compact table
- Let user select by name or number
- Execute as in case 1-5

**x (proceed)**
- Return the fully enhanced content as final
- If invoked from another skill: signal completion back and return control
- If standalone: write the final content to the target file if applicable, summarize what was applied

**Direct feedback (user types a critique instead of a number)**
- Apply the user's change directly, re-present the menu

**Multiple numbers (e.g., "1 and 4")**
- Execute them sequentially, show the compounding result, then re-offer the menu

## Execution Guidelines

- Stay relevant: every critique must tie to THE SPECIFIC CONTENT, not generic advice
- Scale complexity to the target: a one-paragraph decision doesn't need 10 Socratic rounds
- Identify personas: for multi-persona methods (Devil's Advocate, Shark Tank, Red Team), clearly name and separate viewpoints
- Preserve prior enhancements: each iteration builds on the current enhanced version, not the original
- Halt immediately when the user says "x" or expresses satisfaction — don't push more critique than wanted

## Integration (invoked from another skill)

When another APED skill invokes `aped-elicit` mid-workflow:

1. Receive the current section content as target
2. Apply elicitation iteratively until user selects 'x'
3. Return the final enhanced version back to the invoking skill
4. The invoking skill continues its workflow with the enhanced content

Example use from `aped-prd`:
> "Section 3 draft complete. Run `aped-elicit` to stress-test before user review? (y/n)"
> If yes: hand off to `aped-elicit`, receive enhanced draft back, present to user for validation.

## State Update

Elicit does NOT update `docs/state.yaml`. It's a horizontal tool.

If elicit produced material changes to a document that feeds `state.yaml` phases, it's the invoking skill's responsibility to update state, not elicit's.

## Next Step

When 'x' is selected:
- Standalone mode: summarize what was applied, return control to user
- Integration mode: return enhanced content to invoking skill

**Do NOT chain to another skill automatically.**

## Example (standalone)

User: "aped-elicit docs/architecture.md"

1. Setup: confirm target = `docs/architecture.md`, section = "Database choice (Postgres vs Foundation)"
2. Smart selection: First Principles, Tree of Thoughts, Pre-mortem, Occam's Razor, Shark Tank
3. User picks 3 (Pre-mortem): "It's 1 year from now and we regret the DB choice — why?"
4. Generate 4 failure scenarios tied to the specific trade-offs in the arch doc
5. Show diff: added "Failure Scenarios" subsection with mitigations
6. User: "y" — applied to the file
7. Re-present menu: user picks 2 (Tree of Thoughts)
8. Explore 3 branching paths (Postgres-only, FoundationDB-only, hybrid) with pros/cons
9. Show diff: rewrote the "Decision" paragraph to acknowledge all 3 paths and why hybrid won
10. User: "y" then "x"
11. Summary: "Applied Pre-mortem + Tree of Thoughts to docs/architecture.md. 2 subsections enhanced."

## Example (integrated from aped-prd)

`aped-prd` Section 4 is complete. Auto-prompt: "Run `aped-elicit` on this section? (y/n)"

User: y

Elicit runs: Socratic → user picks → "What if the constraint you listed as 'must-have' is actually a 'should-have'?" exposes a hidden assumption.

User iterates: Pre-mortem → finds 2 new risks → added to the PRD.

User: x → enhanced content returns to `aped-prd`, which presents to user for final validation before writing to `docs/prd.md`.

## Common Issues

- **User overwhelmed by options**: pick 2 methods and start — less menu friction
- **Method produces thin critique**: try another method. Not every lens works on every content.
- **Method loops without new insight**: signal to move on — don't pad
- **User applies changes then changes mind**: support undo by showing the diff clearly before apply, and keep a 1-step history of the previous version
- **User wants a method not in the registry**: ask them to describe it, run it ad-hoc, add it to the menu for the session
