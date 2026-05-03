---
step: 7
reads:
  - "subagent/findings"
  - ".aped/scripts/aped-review/merge-findings.mjs"
writes: []
mutates_state: false
---

# Step 7: Merge Findings

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Minimum 3 findings across the team — re-dispatch if fewer
- 🛑 Cross-reference manually — same issue flagged by multiple specialists = ONE entry
- 🚫 NEVER let a finding through without evidence (file:line, command output, or stack trace)

## CONTEXT BOUNDARIES

- All specialist reports collected (Eva from step 04, Stage 1.5 from step 05 if enabled, Stage 2 from step 06).
- The merge script is available at `.aped/scripts/aped-review/merge-findings.mjs`.

## YOUR TASK

Merge specialist reports into a single ranked finding list. Cross-reference duplicates. Re-dispatch if fewer than 3 findings. Route root-cause findings to `aped-debug`.

## MERGE STEPS

### 1. Deduplicate

Same issue flagged by multiple specialists → ONE finding (mention all perspectives in evidence).

Example: backend says *"API returns unknown"* and frontend says *"no type for delete response"* — that's the same issue. Merge into one entry citing both.

### 2. Cross-reference

Domains overlap. The Lead is the human-in-the-loop relay: read every report, cross-link findings that touch each other.

### 3. Prioritize

Severity order: `CRITICAL > HIGH > MEDIUM > LOW`.

If using the merge script's BLOCKER/MAJOR/MINOR/NIT scale (Stage 1.5 sub-agents), normalize to the project's CRITICAL/HIGH/MEDIUM/LOW vocabulary in this step.

### 4. Verify minimum 3

If total findings across the team < 3:

- Re-dispatch the most relevant specialist with stricter instructions:
  > Look harder at edge cases, error handling, security surface. Specifically check: {hint based on what's missing}.
- Wait for the re-dispatch result; merge it in.
- Re-count. If still < 3, re-dispatch a different specialist (do not loop on the same one).

### 5. Check ticket comments

If a team member commented on the ticket about a known limitation, don't re-flag it as a finding; note it as **acknowledged** (not a finding, not a pass — recorded in the report's Ticket sync section).

### 6. Route root-cause findings to `aped-debug`

For any finding whose mechanism is unclear:

- Eva flags a bug whose cause she can't articulate.
- Marcus surfaces a regression with no obvious origin.
- Rex spots a behavioural delta in the git audit that nobody can explain.

Dispatch `aped-debug` rather than letting the specialist guess. `aped-debug` Phase 1 inherits the finding's repro; the verdict is appended to this review's evidence trail. See `aped-debug.md` § Invocation contexts.

## OUTPUT — MERGED FINDING LIST (in memory)

Hold the merged list as a structured object — not yet a user-visible report. The user-visible report is rendered in step 09 after the verification gate (step 08).

Each merged finding:

- ID (assigned in step 09 for stable user reference).
- Severity (CRITICAL / HIGH / MEDIUM / LOW).
- Description.
- file:line citation(s).
- Evidence (verbatim from specialist report — no paraphrase).
- Suggested fix.
- Source(s) — comma-separated specialist names.
- Routed-to-debug? (yes/no, with `aped-debug` verdict if yes).

## SUCCESS METRICS

✅ All specialist reports merged into a single ranked list.
✅ Duplicates collapsed; cross-references annotated.
✅ Minimum 3 findings achieved (re-dispatched if not).
✅ Root-cause-unclear findings routed to `aped-debug`.

## FAILURE MODES

❌ Producing a 1- or 2-finding report — specialists didn't look hard enough, but the Lead validated their laziness.
❌ Letting duplicates through — user sees the same issue 3 times in the report.
❌ Skipping the `aped-debug` route — specialists invent root-cause explanations.

## NEXT STEP

Load `.aped/aped-review/steps/step-08-verification-and-self-review.md` to walk the verification gate and the self-review checklist BEFORE presenting the report.
