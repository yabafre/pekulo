---
step: 3
reads:
  - "subagent/findings"
  - ".aped/scripts/aped-review/merge-findings.mjs"
writes: []
mutates_state: false
---

# Step 3: Merge + Verify (Iron Law gate)

## Spec NACK triage (before merge)

If the **Spec auditor** verdict is `CHANGES_REQUESTED`, present the gate menu **before** merging the rest:

```
Spec auditor flagged AC gap(s):
{Spec findings — file:line + AC ID per finding}

[F] Fix — return story to dev (status flips back to in-progress, aped-review exits)
[O] Override — proceed with the other auditors' findings despite the AC gap. Reason will be recorded as the first line of the merged report.
```

⏸ **HALT — wait for `[F]` or `[O]`.**

- **`[F]`** — `bash .aped/scripts/sync-state.sh set-story-status {key} in-progress`. Exit `aped-review`.
- **`[O]`** — prompt for a non-empty reason. Re-loop until non-empty. Set `OVERRIDE_REASON="<text>"` for step 04's report header. Continue.

If Spec verdict is `APPROVED`, skip the menu, continue to merge.

## Merge

Pipe each subagent report through the merge script:

```bash
echo "$ALL_FINDINGS_YAML" | node .aped/scripts/aped-review/merge-findings.mjs
```

Output: a deduplicated, severity-ranked finding list (`BLOCKER > MAJOR > MINOR > NIT`). Same `file:line:category` from multiple auditors collapses to one entry with the union of evidence.

Include the `git-audit.sh` output in the input — out-of-scope changes and missing-expected changes are findings too.

## Iron Law — verification gate (run BEFORE step 04 presents anything)

**NO PASS WITHOUT FRESH EVIDENCE IN THIS MESSAGE.** See [`ETHOS.md` § aped-review](../../ETHOS.md#aped-review) for full rationale.

The merged report claims X passes / Y is correct. For every claim, this message must show fresh tool output captured in this conversation — re-run the verification, capture the output, paste it.

### Forbidden phrases

If the report draft contains any of these and the message has no captured tool output below, the gate fails — re-run the verification step before presenting anything.

- *"should work"* / *"should pass"*
- *"looks good"* / *"appears correct"*
- *"probably"* / *"likely"*
- *"tests should pass"*

### Evidence required

- Test command run inline, with exit status + key counts visible.
- Build command run if the story changed types or schema.
- Git status / diff captured at this commit.

### No minimum-findings floor

If the auditors found fewer than three findings and the evidence is genuine, that's the answer — say so. Do not re-dispatch to pad the count. (Padding produces false positives under pressure; integrity beats inflation.)

## NEXT

Read fully and follow `.aped/aped-review/steps/step-04-decide-and-iterate.md`.
