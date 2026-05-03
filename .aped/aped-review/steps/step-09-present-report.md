---
step: 9
reads: []
writes: []
mutates_state: false
---

# Step 9: Present Report to User

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The report is rendered INLINE in this conversation — NO file is ever written
- 🛑 If `[O]verride` was chosen in step 04, the report opens with the Override callout
- 🚫 NEVER change story status here — the gate is `[Fix now]` / `[Dismiss]` per finding

## CONTEXT BOUNDARIES

- Verification gate + self-review passed (step 08).
- Merged findings ready, ranked.
- Override reason captured in step 04 (if applicable).

## YOUR TASK

Format the consolidated report as inline markdown and show it to the user. Wait for per-finding decisions.

## THE REPORT MUST NEVER BE PERSISTED AS A SEPARATE FILE

The Review Record will be appended to the story file in step 11. **No file is created at `docs/reviews/...` or any other location.** The story file is the single canonical home for both Dev Agent Record and Review Record.

If a habit pulls you toward writing a separate file, STOP. The user explicitly asked for the review to live in the story file in v6.0.0 (this is the bug fix this skill exists to address).

## FORMAT

If Eva NACKed and the user chose `[O]verride` in step 04, open with:

```markdown
> **Override:** AC gap accepted — reason: "{OVERRIDE_REASON}"
```

(Omit this line entirely on the normal Eva-PASS path.)

Then the report:

```markdown
## Review Report — {story-key}

**Ticket:** {ticket-id}
**Specialists dispatched:** {comma-separated list, e.g. Eva, Marcus, Rex, Diego, [+ Hannah, Eli, Aaron if Stage 1.5]}
**Total findings:** {N} ({critical}/{high}/{medium}/{low})
**Verdict:** APPROVED | CHANGES_REQUESTED

### Findings

#### Critical / High

- [SEVERITY] {description} [file:line]
  - **Evidence:** {summary}
  - **Suggested fix:** {approach}
  - **Source:** {specialist name(s)}

#### Medium / Low

- ...

### Test verification

```{output of the test re-run from step 08}```

### Ticket sync

- {summary of ticket comments referenced or new info added}

### Visual verification (frontend stories only)

- {Aria's note: validated dev's React Grab work / re-inspected because {reason} / deferred — MCP unavailable at {timestamp}}
```

## USER GATE

After the report:

> ⏸ For each finding, please decide:
>
> - [Fix now] — I'll apply the fix (or re-dispatch the specialist if multi-file).
> - [Dismiss] — finding noted but not addressed; rationale will be recorded in the story's Review Record.
>
> Or shorthand: *"fix all CRITICAL+HIGH, dismiss the others"*, *"fix everything"*, *"dismiss #3 and #5, fix the rest"*.

⏸ **HALT — wait for user decisions.** Do NOT change status until step 12.

## SUCCESS METRICS

✅ Report formatted inline; Override callout present iff Eva NACK + `[O]verride`.
✅ Test verification output is the captured one from step 08 (no paraphrase).
✅ User asked to decide per finding.
✅ Status not changed.

## FAILURE MODES

❌ Writing the report to a separate file — re-introduces the bug v6.0.0 fixed.
❌ Auto-applying fixes without the user's per-finding decision — the user controls priorities.
❌ Changing status to `done` at this step — premature.

## NEXT STEP

After the user decides per finding, load `.aped/aped-review/steps/step-10-fix-cycle.md` to apply fixes and re-verify.
