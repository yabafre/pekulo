---
name: aped-pre-mortem
keep-coding-instructions: true
description: 'Use when user says "pre-mortem", "what could go wrong", "risk analysis", "failure modes", "anticipate problems", or invokes aped-pre-mortem. Structured pre-mortem before implementation starts. Not for post-incident (see aped-retro).'
allowed-tools: "Read Write Bash Grep Glob"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
---

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# aped-pre-mortem — Structured Pre-Mortem

## Purpose

Before implementation begins, assume the project HAS ALREADY FAILED. Work backwards from the failure to identify what went wrong. This inverts the usual optimism bias and surfaces risks that "everything will work out" thinking misses.

## Iron Laws

1. **The project has failed.** This is not a question — it's the premise. Start from failure, not from "what might go wrong."
2. **Every risk must have a mitigation or an explicit acceptance.** "We'll deal with it" is not a mitigation.
3. **Pre-mortem runs BEFORE implementation, not during.** If you're already coding, use `aped-checkpoint` instead.

## Pre-Mortem Pipeline

### Step 1: Set the failure scenario

Read the current artefacts:
1. Read `docs/prd.md` — what are we building?
2. Read `docs/architecture.md` — how are we building it?
3. Read `docs/epics.md` — what's the scope?

Then state: "It is [DATE + 2 weeks]. The project has shipped but is considered a failure. Here's what happened:"

### Step 2: Independent failure brainstorm (5 categories)

For EACH category, generate 2-3 specific failure scenarios:

| Category | Examples |
|---|---|
| **Technical** | Wrong database choice, API design doesn't scale, missing migration path |
| **Scope** | Feature creep, underestimated complexity, wrong abstraction level |
| **Integration** | Third-party API changes, auth provider incompatibility, data format mismatch |
| **Process** | No tests for critical path, review skipped under pressure, state.yaml drift |
| **User** | UX assumption wrong, edge case not handled, error messages unhelpful |

### Step 3: Rank by likelihood × impact

For each failure scenario:
- **Likelihood**: HIGH (>50%) / MEDIUM (20-50%) / LOW (<20%)
- **Impact**: CRITICAL (blocks ship) / MAJOR (degrades quality) / MINOR (cosmetic)
- **Score**: L×I priority matrix

### Step 4: Mitigation table

For each HIGH×CRITICAL or HIGH×MAJOR scenario:

| Failure | Mitigation | Owner | Verification |
|---|---|---|---|
| API doesn't scale past 1k RPM | Load test in staging before ship | Dev | `aped-qa` with load test AC |
| Missing migration for existing users | Add upgrade path to epic, test with `--update` | Dev | oracle-dev E035 catches missing migration |

### Step 5: Emit pre-mortem report

Write `docs/pre-mortem.md`:

```markdown
# Pre-Mortem Report

**Date**: YYYY-MM-DD
**Scope**: [PRD title]
**Premise**: The project shipped and failed. Here's what we found.

## Top Risks (ranked)
1. [CRITICAL] ...
2. [MAJOR] ...

## Mitigation Plan
| Risk | Mitigation | Verification |
|---|---|---|

## Accepted Risks (no mitigation, explicit decision)
- ...

## Signals to watch during implementation
- ...
```

### Step 6: Feed downstream

Recommend specific additions to the current artefacts:
- New ACs in `epics.md` stories that cover the top mitigations
- New Red Flag rows in `aped-dev.md` for failure patterns specific to this project
- Oracle checks for project-specific invariants

## Stop Conditions

- All 5 categories analyzed → mitigation table complete → report emitted → DONE.
- User says "enough" → emit what you have → DONE.
