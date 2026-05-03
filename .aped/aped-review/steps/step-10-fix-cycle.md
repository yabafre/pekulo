---
step: 10
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

# Step 10: Apply Fixes & Re-Verify

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 After EACH fix lands, run tests
- 🛑 Re-dispatch the specialist who flagged the finding to verify the fix is correct
- 🚫 NEVER auto-fix HIGH+ findings without understanding them
- 🚫 NEVER use `git add .`

## CONTEXT BOUNDARIES

- User has decided per finding (fix vs dismiss).
- Story status still `review` — do NOT change it here.

## YOUR TASK

For each finding the user wants fixed: apply the fix, run tests, re-dispatch the relevant specialist for verification. Iterate until clean.

## FIX TAXONOMY

- **Simple fix** (< 20 lines, single file, ownership clear): Lead applies directly.
- **Cross-specialist fix** (finding touches another domain, or ownership ambiguous): Lead re-dispatches the affected specialist as a subagent asking *"Does this approach break anything you own? Confirm or propose a fix."* Apply only after the specialist's answer arrives.
- **Complex fix** (multi-file, architectural): Lead re-dispatches the relevant specialist as a fix agent with the finding + suggested approach. Specialist applies the fix and reports back.

Rule of thumb: if a specialist raised the finding, the Lead either applies the fix alone (if clearly scoped) or loops that specialist back in as a one-shot subagent for a sanity check.

## PER-FIX SEQUENCE

1. **Apply fix** — Edit / Write / specialist re-dispatch.
2. **Run tests**:

   ```bash
   bash .aped/aped-dev/scripts/run-tests.sh
   ```

   Capture output verbatim in this message.

3. **Stage and commit** specific files (NEVER `git add .`):

   ```bash
   git add <files-just-changed>
   git commit -m "fix({ticket}): {short description of fix}"
   ```

   Drop `({ticket})` if `ticket_system: none`.

4. **Frontend fixes**: re-inspect via React Grab MCP (if available) and capture output.

## RE-VERIFY

After ALL fixes land:

1. **Re-dispatch the specialists that flagged the fixed findings** — they verify the fix is correct and no new issues introduced. Send a single Agent message with one tool call per specialist (parallel).

2. **Run the full test suite** (not just the failing ones):

   ```bash
   bash .aped/aped-dev/scripts/run-tests.sh
   ```

3. **Re-run Rex's git audit** to confirm no out-of-scope changes leaked into the fix commits:

   ```bash
   bash .aped/aped-review/scripts/git-audit.sh
   ```

4. **If any specialist reports the fix is incomplete or introduces a regression**, loop back to step 10 (apply another fix, re-verify).

## DISMISSED FINDINGS

For findings the user dismissed:

- Note the rationale in your working state — it goes into the Review Record (step 11).
- Do NOT silently drop dismissed findings — they are recorded as *"dismissed: {reason}"* in the story file.

## STATUS DECISION

After re-verify is clean:

- All findings resolved (fixed or dismissed) → story will flip to `done` in step 12.
- Unresolved findings remain → story stays `review`. The user can re-run `aped-review` after addressing them.

Do NOT flip the status here — that's step 12's job. This step's output is the **decision** about the next status.

## SUCCESS METRICS

✅ Each fix has a captured test-run output in this message.
✅ Specialist re-dispatch verified each fix (parallel).
✅ Rex's git audit re-ran on the fix commits.
✅ Dismissed findings are tracked with rationale (for step 11).

## FAILURE MODES

❌ Applying multiple fixes before running tests — can't bisect which broke what.
❌ `git add .` — accidental commits.
❌ Auto-fixing a HIGH finding without understanding it — introduces a new bug atop the original.
❌ Forgetting dismissed-finding rationale — Review Record loses the audit trail.

## NEXT STEP

Load `.aped/aped-review/steps/step-11-finalize-and-update-remote.md` to update the ticket, open/update the PR, and write the Review Record into the story file.
