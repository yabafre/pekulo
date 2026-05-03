---
step: 4
reads:
  - "docs/stories/{story-key}.md"
  - "tests/**"
writes:
  - "subagent/eva"
mutates_state: false
---

# Step 4: Stage 1 — Eva (synchronous AC gate)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Eva is the ONLY specialist dispatched in this step
- 🛑 NEVER dispatch Marcus / Rex / conditionals in parallel with Eva — wait for her verdict
- 🚫 An empty `[O]verride` reason is invalid — re-prompt until non-empty

## CONTEXT BOUNDARIES

- Dispatch plan locked in (step 03).
- Stage 1.5 / Stage 2 are deferred to later steps — do NOT pre-empt them.

## YOUR TASK

Dispatch Eva alone via the `Agent` tool. Wait for her verdict. On PASS, advance. On NACK, present the `[F]ix` / `[O]verride` menu to the user.

## RATIONALE — WHY TWO STAGES?

If Eva NACKs the ACs (the story doesn't deliver what was promised), the story will return to dev regardless of what Marcus/Rex find. Running them in parallel with Eva burns tokens on a doomed review. Spec-compliance first, code-quality second.

## DISPATCH

Send a single Agent tool call:

- `subagent_type: "feature-dev:code-explorer"`
- Prompt: Eva's persona + scope.

Eva's prompt template:

```
You are **Eva**, QA Lead. "I trust nothing without proof in the code."

Your scope:
- For each AC in the story file (docs/stories/{story-key}.md): search the
  implementation for evidence. Rate each AC IMPLEMENTED / PARTIAL / MISSING with
  exact file:line citations.
- For each `[x]` task in the story: find proof. Tasks without proof = CRITICAL finding.

Lessons that augment your checklist (Scope: aped-review or all):
{paste scoped lessons here verbatim}

Output format:
## Eva Report

### Findings
- [SEVERITY] AC-N description [file:line]
  - Evidence: {what was inspected / what's missing}
  - Suggested fix: {how}

### Summary
- Total ACs reviewed: {N}
- IMPLEMENTED: {n}
- PARTIAL: {n}
- MISSING: {n}
- Verdict: APPROVED | CHANGES_REQUESTED
- Confidence: HIGH | MEDIUM | LOW
```

Wait for Eva's tool result.

## VERDICT HANDLING

### Eva PASS (verdict: APPROVED)

Proceed to Stage 1.5 (step 05). Eva's findings are kept aside for the merge in step 07.

### Eva NACK (verdict: CHANGES_REQUESTED)

HALT immediately. Do NOT auto-dispatch the other specialists.

Present this menu to the user:

```
Eva flagged AC gap(s):
{list Eva's findings here verbatim — file:line + AC ID per finding}

Options:
[F] Fix — return story to dev (status flips back to in-progress, aped-review exits without dispatching the other specialists)
[O] Override — proceed with Marcus, Rex, and conditional specialists despite the AC gap. You will be asked for a reason; that reason is recorded as the first line of the merged report in step 09.
```

⏸ **HALT — wait for `[F]` or `[O]`.**

#### On `[F]` (fix)

Run:

```bash
bash .aped/scripts/sync-state.sh set-story-status {key} in-progress
```

Exit `aped-review`. The dev will pick this up on next invocation.

#### On `[O]` (override)

Prompt the user for a reason (one line, will appear in the report):

> Override requires a reason. Please state why the AC gap is acceptable to proceed.

**The reason MUST be non-empty.** If the user submits empty, re-prompt. Re-loop until non-empty or the user types `[F]` instead.

Set `OVERRIDE_REASON="<text>"` for use in step 09 (the report opens with an Override callout).

Continue to step 05.

## RETRY ON SUBAGENT FAILURE

If Eva's subagent fails to return a structured verdict (transport error, malformed report), re-dispatch her once with sharper instructions:

> Re-dispatch — your prior response did not return a structured verdict. Re-read the prompt's output format. Output exactly the format requested, no extra prose.

If the second attempt also fails, HALT and escalate to the user — the gate cannot pass on a missing verdict.

## SUCCESS METRICS

✅ Eva dispatched as a single subagent (no parallel team).
✅ Verdict received (APPROVED or CHANGES_REQUESTED).
✅ NACK path triggered the user menu and recorded a non-empty `[O]verride` reason if applicable.

## FAILURE MODES

❌ Dispatching Marcus / Rex / conditionals in parallel with Eva — burns tokens on doomed reviews.
❌ Treating an empty `[O]verride` reason as valid — defeats the gate's audit purpose.
❌ Skipping the structured-verdict retry on transport failure — leaves the workflow in an undefined state.

## NEXT STEP

After Eva PASS (or `[O]verride`), load `.aped/aped-review/steps/step-05-stage-1-5-adversarial.md` to run the adversarial pass (opt-in).
