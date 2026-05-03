---
name: aped-triage
keep-coding-instructions: true
description: 'Use when user says "triage this issue", "classify this bug", "is this in scope", "out of scope", "should we fix this now", "prioritize", "triage", or invokes aped-triage. Issue triage state machine: intake → classify → route → close/defer. Maintains .out-of-scope/ knowledge base for deferred items. Emits triage-decision.md for downstream skills.'
allowed-tools: "Read Edit Write Bash Grep Glob"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
---

# aped-triage — Issue Triage State Machine

## Purpose

Classify and route incoming issues (bugs, feature requests, questions, regressions) through a deterministic triage pipeline. Reduces hallucinated priority assignments by forcing structured evidence gathering before any classification.

## Iron Laws

1. **Evidence before classification.** Never assign priority/severity until Steps 1-3 complete. "This feels like a P1" is a hallucination — cite the evidence.
2. **Out-of-scope is a destination, not a waste bin.** Items routed to `.out-of-scope/` get a full triage record so they can be reconsidered later without re-investigation.
3. **Scope verification precedes priority.** An issue outside the current sprint/epic scope is OUT regardless of severity. Check scope FIRST.

## Triage Pipeline

### Step 1: Intake — Capture the raw signal

Read the issue/bug/request. Extract:

| Field | Source |
|---|---|
| **Title** | Issue title or user description |
| **Reporter** | Who surfaced this (user, CI, monitor, self) |
| **Reproduction** | Steps to reproduce, or "not applicable" for feature requests |
| **Evidence** | Error output, screenshot, log line, test failure |
| **Affected artefact** | Which file/skill/hook/script is involved |

If ANY field is missing, ask the user before proceeding. Do not infer.

### Step 2: Scope Check

Read the current sprint/epic scope:

1. Read `docs/state.yaml` → extract `pipeline.current_phase`.
2. Read `docs/epics.md` → identify the active epic's file set.
3. If either file is missing, report "scope unknown — ask user" (never assume in-scope).

**Decision gate:**
- If the affected artefact is NOT in the current epic's file set → **OUT OF SCOPE** → Step 5.
- If the affected artefact IS in scope → continue to Step 3.
- If uncertain → ask the user. Never assume scope.

### Step 3: Classify

Assign classification based on evidence (not intuition):

| Classification | Criteria |
|---|---|
| **REGRESSION** | Worked before, broken now. `git bisect` identifies the breaking commit. |
| **BUG** | Never worked as specified. The spec says X, the code does Y. Cite both. |
| **FEATURE** | Not in any spec. The user wants new behavior. |
| **QUESTION** | Ambiguity in spec or docs. No code change needed — docs/spec clarification. |
| **DUPLICATE** | Same root cause as an existing triage record. Cite the original. |

### Step 4: Route

Based on classification + scope:

| Classification | In Scope | Route |
|---|---|---|
| REGRESSION | yes | **BLOCKER** → `aped-debug` immediately. Block current story. |
| BUG | yes | **HIGH** → create story via `aped-story`, add to current epic. |
| BUG | no | **DEFER** → Step 5 (out-of-scope). |
| FEATURE | yes | **MEDIUM** → `aped-brainstorm` → PRD flow. |
| FEATURE | no | **DEFER** → Step 5. |
| QUESTION | any | **LOW** → resolve inline, update docs. No story needed. |
| DUPLICATE | any | **CLOSE** → link to original, no action. |

### Step 5: Out-of-Scope Routing

For DEFER decisions, create a triage record:

```bash
mkdir -p .aped/.out-of-scope
```

Write `.aped/.out-of-scope/<date>-<slug>.md`:

```markdown
# Triage: <title>

- **Date**: <YYYY-MM-DD>
- **Classification**: <BUG|FEATURE>
- **Reporter**: <who>
- **Evidence**: <one-line>
- **Reason deferred**: <out of current sprint scope / low priority / needs design>
- **Reconsider when**: <next sprint planning / when epic X ships / never>
```

### Step 6: Emit Decision

Write `docs/triage-decision.md`:

```markdown
# Triage Decision

- **Issue**: <title>
- **Classification**: <REGRESSION|BUG|FEATURE|QUESTION|DUPLICATE>
- **Priority**: <BLOCKER|HIGH|MEDIUM|LOW|DEFER|CLOSE>
- **Route**: <aped-debug|aped-story|aped-brainstorm|docs|.out-of-scope|closed>
- **Evidence**: <cite>
- **Scope check**: <in-scope (epic X, story Y) | out-of-scope (reason)>
```

## Stop Conditions

- Issue fully classified and routed → emit triage-decision.md → DONE.
- User overrides classification → accept, note the override in the decision, proceed.
- Duplicate confirmed → link to original → DONE.

## Red Flags

| Thought | Problem |
|---|---|
| "This is obviously a P1" | No evidence cited. Do Step 1 first. |
| "I'll just fix it quickly" | Triage first. Quick fixes without triage create scope drift. |
| "It's probably in scope" | Check the epics file. "Probably" is not evidence. |
| "I'll defer this later" | Route to .out-of-scope NOW. "Later" means "never". |
