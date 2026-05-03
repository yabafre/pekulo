---
name: aped-design-twice
keep-coding-instructions: true
description: 'Use when user says "design twice", "alternative design", "explore options", "what else could we do", "second opinion on architecture", or invokes aped-design-twice. Generates two competing designs before committing to one. Prevents premature lock-in.'
allowed-tools: "Read Write Bash Grep Glob"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
---

# aped-design-twice — Dual Design Exploration

## Purpose

Generate two genuinely different designs for the same requirement BEFORE committing to one. The first design is rarely the best — it's the most obvious. The second design, forced by constraint, often reveals trade-offs the first hid.

## Iron Laws

1. **Two designs minimum.** One design is a decision. Two designs is a choice. Never skip Design B.
2. **Design B must be structurally different.** Not "same thing with a different name" — different trade-off axis (e.g. Design A optimises for read speed, Design B for write simplicity).
3. **Decision is explicit.** The user picks. The agent does not default to Design A.

## Pipeline

### Step 1: Read the requirement

Read `docs/prd.md` and/or `docs/architecture.md`. Identify the component or decision being designed.

### Step 2: Design A — the obvious solution

Sketch the first design. This is what you'd build if you had 5 minutes to decide:
- Data model
- Key interfaces / API surface
- Dependencies
- Estimated complexity (S/M/L)

### Step 3: Design B — the forced alternative

Now design an alternative that differs on at least ONE structural axis:

| Axis | Design A | Design B |
|---|---|---|
| Data storage | SQL normalized | Document store denormalized |
| API style | REST | GraphQL |
| State management | Server-side sessions | Client-side JWT |
| Architecture | Monolith | Microservices |
| Concurrency | Locks | Event sourcing |

Design B must be VIABLE — not a strawman. If you can't make B viable, you haven't explored the space enough.

### Step 4: Trade-off matrix

| Dimension | Design A | Design B |
|---|---|---|
| Complexity | ... | ... |
| Performance | ... | ... |
| Maintainability | ... | ... |
| Migration risk | ... | ... |
| Team familiarity | ... | ... |

### Step 5: Recommendation + user choice

Present both designs with the trade-off matrix. State your recommendation and WHY, but make it clear the user decides:

"I recommend Design [A/B] because [trade-off reason]. Design [B/A] would be better if [condition]. Which should we proceed with?"

### Step 6: Emit to architecture

Write the chosen design into `docs/architecture.md` (if it doesn't exist yet) or feed it to `aped-arch` as input. Record the rejected design in `docs/design-alternatives.md` for future reference.

## Stop Conditions

- Both designs sketched → trade-off matrix → user chose → written to arch → DONE.
- User says "just go with A" before Step 3 → record the skip → proceed with A → DONE.
