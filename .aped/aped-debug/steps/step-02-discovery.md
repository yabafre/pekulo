---
step: 2
reads:
  - ".aped/.last-test-exit"
  - "docs/state.yaml"
  - ".aped/.out-of-scope/*.md"
  - "git/diff"
  - "git/log"
writes:
  - ".aped/.out-of-scope/*.md"
mutates_state: false
---

# Step 2: Discovery + Out-of-Scope KB Scan

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If `.aped/.last-test-exit` is missing, run `run-tests.sh` once before continuing
- 🛑 OOS-KB match → present user `[K]` / `[O]` / `[U]` menu; `[K]` aborts immediately

## YOUR TASK

Gather just enough state to anchor the loop. Check OOS KB before investing Phase 1 effort.

## DISCOVERY

1. **Failing artefacts.** Recent test output: `cat .aped/.last-test-exit` (canonical exit-code cache, written by `run-tests.sh`); the most recent failing run's stdout / stderr if captured. **If `.aped/.last-test-exit` is absent**, run `bash .aped/aped-dev/scripts/run-tests.sh` once before continuing — debugging from a missing test signal is debugging in the dark. Then the most recent merge or commit, the working-tree diff.

2. **Caller context.** If invoked from `aped-dev`, the story file. If invoked from `aped-review`, the review finding. If standalone, the user's description.

3. **Sprint state.** Read `docs/state.yaml` to know whether a sprint is active (informs whether `aped-arch-audit` or `aped-retro` is the right step 08 handoff candidate).

⏸ **HALT — confirm the failure description with the user before building the loop.** A wrong loop catches a different bug; a different bug means a wrong fix.

## OUT-OF-SCOPE KB SCAN

Bug reports can match a previously-rejected scope. Check `.aped/.out-of-scope/` before investing step 03 effort. The directory may not exist on pre-4.2 scaffolds — treat the missing directory as an empty KB and skip silently.

1. **List entries.** `ls .aped/.out-of-scope/*.md 2>/dev/null` excluding `README.md`. Empty → skip.

2. **Tokenize the bug description.** Lowercase, strip punctuation, split on whitespace, `-`, `_`. Drop ≤2-character tokens and stop-words (`add`, `fix`, `update`, `the`, `a`, `an`, `to`, `for`, `with`).

3. **Match entries.** For each entry file, tokenize its filename (drop `.md`; strip `-resolved-YYYY-MM-DD` suffix). Match if any bug token equals any filename token (exact word equality).

4. **No match → continue silently** to step 03.

5. **Match → surface to user.** Show the entry's frontmatter + `## Why this is out of scope` body, then present:

   ```
   ⚠️ Out-of-scope KB match: .aped/.out-of-scope/{matched-file}

   {entry summary}

   [K] Keep refusal — abort this debug, the rejection still holds
   [O] Override — append this bug report to the entry's "Prior requests" list, then continue
   [U] Update — the rejection is stale; rename the entry to {concept}-resolved-{today}.md and continue
   ```

   ⏸ **HALT — wait for user choice per match.**

6. **Behaviour by choice:**
   - `[K]` → abort with refusal message (concept + rejection date + rationale). Exit cleanly.
   - `[O]` → prepend `- {today} — debug ({user_name}): {bug description}` to `## Prior requests`. Continue.
   - `[U]` → rename to `{concept}-resolved-{YYYY-MM-DD}.md` and append `## Resolved on {YYYY-MM-DD}\n\n{one-line note}`. Continue.

7. **Multi-match.** Adjudicate per entry; any single `[K]` aborts the whole debug.

## NEXT STEP

Load `.aped/aped-debug/steps/step-03-build-loop.md`.
