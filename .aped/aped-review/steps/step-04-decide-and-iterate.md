---
step: 4
reads:
  - "src/**"
  - "tests/**"
writes:
  - "src/**"
  - "tests/**"
  - "git/commits"
  - ".aped/.last-test-exit"
mutates_state: false
---

# Step 4: Present + Iterate

## Present the merged report inline

The Review Record will be persisted in step 05 (inside the story file). **Do not write a separate file.**

> **Writing discipline.** Read `.aped/aped-skills/writing-discipline.md` before drafting. Lead with the verdict and the *one thing* that matters. Per-finding lines: severity + file:line + one-sentence rationale + fix-or-defer. No padding.

If `OVERRIDE_REASON` was captured in step 03, the report opens with:

```markdown
> **Override:** AC gap accepted — reason: "{OVERRIDE_REASON}"
```

Then the report:

```markdown
## Review Report — {story-key}

**Auditors:** Spec, Code, Edge & Hallucination{, Aria}
**Findings:** {N} ({BLOCKER}/{MAJOR}/{MINOR}/{NIT})
**Verdict:** APPROVED | CHANGES_REQUESTED

### Findings

#### {SEVERITY}
- {1-sentence description} [file:line]
  - Source: {auditor}
  - Suggested fix: {how}
  - Decision: [pending]
…
```

Show this inline. **Do not change story status here.**

## Per-finding decision menu

For each finding, present:

```
[F] Fix now — apply the suggested fix, run tests, re-verify with the relevant auditor
[D] Dismiss — finding noted, rationale will be recorded in the Review Record
```

⏸ **HALT — wait per finding.**

`[D]ismiss` requires a one-line rationale. Empty → re-prompt.

## Apply fixes

For each `[F]` decision:

1. Apply the fix. Stage specific files only — never `git add .`.
2. Run the project's test command. Capture stdout + exit code.
3. If green, commit per the writing discipline (subject ≤ 70 chars, body only when WHY is non-obvious):
   ```bash
   git commit -m "fix({ticket}): {finding-one-liner} [aped-review]"
   ```
4. **Re-dispatch** the relevant auditor (Spec / Code / Edge / Aria) for verification of that single finding. Single Agent message, focused prompt.
5. Auditor confirms `RESOLVED` → mark the finding as fixed in the in-memory report. Auditor still flags → loop, max 3 attempts.

After 3 failed attempts on the same finding, HALT and surface to the user — the discipline is the same as `aped-debug`'s 3-failed-fixes rule. The 4th attempt costs more than stepping back.

## All findings closed?

Once every finding is `RESOLVED` or `DISMISSED` with a rationale, continue to step 05 to finalize.

## NEXT

Read fully and follow `.aped/aped-review/steps/step-05-finalize.md`.
