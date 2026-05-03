
# APED Iterate — Post-Ship Router

Routes a post-ship delta ("we shipped X, now we realise we need Y") to the correct downstream skill. Classifies the delta into Patch / Plan / Design level via a short interview, recommends the right APED tool with rationale, then hands off — never implements the change itself.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Critical Rules

- This is a **router skill**, not an implementation skill. The output is a recommendation + a handoff message. Never carry the work past the routing step.
- Run AFTER something shipped — a release, a merge to main, or a deployment. If a story is currently in-progress, use `aped-course` instead (see Disposition below).
- Quality of classification determines quality of routing. Resist the urge to skip the interview when the delta seems "obvious" — the user invoked this skill because the right tool wasn't obvious to them.
- Do NOT auto-invoke the recommended downstream skill. Print the invocation, let the user decide.

### Iron Law

**Classify FIRST, route SECOND.** Never skip the classification interview, even when the delta description seems to point at one specific skill. The user came here because they weren't sure — guessing past the question is exactly the failure mode this skill exists to prevent.

### Red Flags

Phrases that mean you are about to skip classification. If you catch yourself thinking any of these, stop.

| Phrase | Why it's wrong |
|--------|----------------|
| "This is obviously a quick fix" | If it were obvious, the user would have run `aped-quick` directly. |
| "Sounds like a simple PRD update" | "Sounds like" is the rationalisation. Run the questions. |
| "Let me skip the interview, I'll just route" | The interview surfaces unknowns the user hadn't stated. Skipping ships the wrong recommendation. |
| "This is too small for an interview" | The interview is 3 questions. The cost of skipping is rerouting once you discover the recommendation was wrong. |
| "I'll route AND start implementing" | This skill HALTS at the recommendation. Implementation belongs in the downstream skill. |

### Rationalizations

| Excuse | Reality |
|--------|---------|
| "The user said exactly which skill they wanted" | They named the skill they think they want. The classification often surfaces a better fit they hadn't considered. |
| "I can run the interview faster by inferring answers from the delta description" | Inferring is guessing. Ask. |
| "The handoff message is verbose, I'll trim it" | The handoff message is the user's instructions for the next step. Trim and you ship a router that doesn't actually route. |

## Disposition vs `aped-course`

`aped-course` and `aped-iterate` look similar but operate at different points in the pipeline:

| | `aped-course` | `aped-iterate` |
|---|---|---|
| When | Mid-sprint, while a story is in-progress | After a release / merge, nothing in-flight |
| Pre-condition | Active worktrees + sprint state populated | Recent merge or release; clean tree |
| Side-effect | Sets `sprint.scope_change_active: true`, posts notifications to active tickets, gates upstream-lock hook | None — read-only routing |
| Output | Updates PRD / architecture / UX inline, propagates to active worktrees | Recommendation + handoff message — no artefact mutation |

If you find an active worktree (`sprint.stories.*.status` is `in-progress | review-queued | review` with a non-null `worktree`) when you start `aped-iterate`, HALT and tell the user: *"Active worktree detected for story `{key}`. Use `aped-course` for mid-sprint scope changes — `aped-iterate` is for post-ship reflection only."*

## Discovery

Before any classification, gather just enough state to make the recommendation grounded.

1. **Recent merge / release.** `git log --oneline -10` for the last 10 commits on the current branch. Note the most recent merge commit and any tag: `git tag --sort=-creatordate | head -3`.
2. **Latest done artefact.** Glob `docs/stories/*.md` and `docs/quick-specs/*.md` — surface the most recent `done` artefact (the thing that just shipped). Read its title + AC.
3. **Active sprint check.** Read `docs/state.yaml`. If `sprint.stories.*` contains any `in-progress | review-queued | review`, HALT per Disposition above.
4. **Diff since last merge.** `git diff HEAD~5..HEAD --stat` for a quick sense of what changed; reach further back only if the last merge was earlier.

Present a compact discovery report (adapt to `communication_language`):

> Discovery for `aped-iterate`:
> - Last shipped: {{recent merge subject + short SHA}}
> - Latest done artefact: {{title of last done story / quick-spec}}
> - Active sprint stories: {{count and statuses, or "none"}}
> - Delta description from invocation: {{argument or "none — will ask"}}

If the delta description is missing, ask the user for one before continuing.

## Out-of-Scope KB Scan

Before classification, check the project's persistent rejection memory at `.aped/.out-of-scope/`. The directory may not exist on pre-4.2 scaffolds — treat the missing directory as an empty KB and skip this section silently.

1. **List entries.** `ls .aped/.out-of-scope/*.md 2>/dev/null` excluding `README.md`. If no entries (or directory missing), skip the rest of this section.

2. **Tokenize the delta description.** Use the argument passed to the skill plus any phrasing the user gave when invoking. Lowercase, strip punctuation, split on whitespace, `-`, and `_`. Drop tokens of ≤2 characters and common stop-words (`add`, `fix`, `update`, `the`, `a`, `an`, `to`, `for`, `with`).

3. **Match entries.** For each entry file, tokenize its filename the same way (drop the `.md` extension first; resolved files end with `-resolved-YYYY-MM-DD` — strip that suffix before tokenizing so old decisions still match). An entry matches if any delta token equals any filename token (exact word equality, no substring or fuzzy matching).

4. **No match → continue silently** to Classification Interview.

5. **One or more matches → surface to user.** For each match, show the entry's frontmatter (`concept`, `rejected_at`, `decided_by`) plus its `## Why this is out of scope` paragraph (~10 lines), then present the menu:

   ```
   ⚠️ Out-of-scope KB match: .aped/.out-of-scope/{matched-file}

   {entry summary}

   [K] Keep refusal — abort this iteration, the rejection still holds
   [O] Override — append this iteration to the entry's "Prior requests" list, then continue
   [U] Update — the rejection is stale; rename the entry to {concept}-resolved-{today}.md and continue
   ```

   ⏸ **HALT — wait for user choice per match.**

6. **Behaviour by choice:**
   - `[K]` → abort with: `"Concept '{concept}' was declared out of scope on {rejected_at} (reason: {one-line rationale from the entry}). Refusing to iterate on this delta. To revisit, re-invoke and pick [U] on the same match."` Exit cleanly.
   - `[O]` → prepend `- {today} — iteration ({user_name}): {delta description}` to the entry's `## Prior requests` list. Continue to Classification Interview.
   - `[U]` → rename the file to `{concept}-resolved-{YYYY-MM-DD}.md` (today's date, ISO). Append a final section to the entry's body: `## Resolved on {YYYY-MM-DD}\n\n{one-line user-supplied note}` (ask the user for the note; default is `"Resolved while iterating"`). Continue to Classification Interview.

7. **Multi-match adjudication.** If multiple entries match the same delta, present each in order; the user adjudicates each independently. If any single match resolves to `[K]`, abort the whole iteration.

## Classification Interview

Ask these questions sequentially. After each answer, present the running classification picture; offer the A/P/C menu after Q3.

### Q1 — Layer of impact

> **Q1. Where does the change land?**
>
> [a] Existing FR or NFR needs adjustment (wording, threshold, edge case) — same product surface as before
> [b] New capability that wasn't in the last PRD at all
> [c] Architectural pattern needs to change (new module boundary, new tech, contract change)
> [d] Mix — multiple of the above

Capture the answer verbatim; do not infer from the delta description alone.

### Q2 — Blast radius

> **Q2. How many files / modules will this touch?**
>
> [a] ≤ 5 files in one module — local
> [b] 6–20 files across 2–3 modules — moderate
> [c] > 20 files OR a cross-cutting concern (auth, logging, i18n) — broad
> [d] Unsure — need a quick scan first

If `[d]`, run `git grep` for the most relevant keyword from the delta description, present the file count, then re-pose Q2 with a sharper choice.

### Q3 — Reversibility

> **Q3. Is the change reversible?**
>
> [a] Yes — easy to roll back (UI, config, isolated logic)
> [b] Mostly — needs a migration but data is preserved
> [c] No — schema change, API contract, or data shape break

### A/P/C menu after Q3

Present the running classification, then offer:

```
Classification so far:
- Layer: {Q1 answer}
- Blast radius: {Q2 answer}
- Reversibility: {Q3 answer}

[A] Add more context — ask Q4 (motivation) or Q5 (timeline)
[P] Pivot — re-pose Q1–Q3 (the user wants to reclassify)
[C] Continue — produce the routing recommendation
```

### Q4 (optional) — Motivation

> **Q4. What forced this iteration?**
>
> [a] User feedback on the shipped feature
> [b] Bug surfaced in production
> [c] New requirement from a stakeholder
> [d] Internal realisation while reviewing the merge

### Q5 (optional) — Timeline pressure

> **Q5. Does this need to ship before the next sprint?**
>
> [a] Yes — partner / customer commitment
> [b] No — can be planned into the next sprint normally

## Routing Recommendation

Map the interview answers to a recommendation using this matrix as the **starting point**. Then write a one-paragraph rationale that names the specific signals from the interview.

| Q1 layer | Q2 blast | Q3 reversibility | Recommended skill |
|---|---|---|---|
| `[a]` existing FR/NFR | `[a]` ≤5 files | `[a]` reversible | `aped-quick` |
| `[a]` existing FR/NFR | `[b]` 6–20 files | `[a]`–`[b]` | `aped-epics` (re-plan affected stories) |
| `[a]` existing FR/NFR | any | `[c]` irreversible | `aped-prd` (revise FR/NFR) → `aped-arch` if structural |
| `[b]` new capability | `[a]` ≤5 files | `[a]` reversible | `aped-quick` (carve a quick-spec) — flag for next epic |
| `[b]` new capability | any | any | `aped-prd` (add FR) → `aped-epics` (story breakdown) |
| `[c]` architectural | any | any | `aped-arch` (decision council) → `aped-prd` if NFRs shift |
| `[d]` mix | any | any | `aped-prd` first to disentangle, then re-run `aped-iterate` on each goal |

If Q5 picked `[a]` (timeline pressure), bias one tier lighter when the matrix is borderline (e.g. recommend `aped-quick` instead of `aped-epics` if the user can defer the planning round to the next iteration).

**Output template** (substitute values from the interview):

> ## Recommendation
>
> Run **`{{recommended_skill}}`** next.
>
> **Rationale.** {{One paragraph naming the Q1 / Q2 / Q3 signals that drove the recommendation, and what the alternative skills would have done less well.}}
>
> **Invocation phrase.** Tell Claude Code: *"{{natural-language phrase that matches the recommended skill's description}}"*
>
> **What `{{recommended_skill}}` will do next.** {{2–3 bullets on the skill's first phase: the file it'll consume, the gate it'll halt at, the artefact it'll produce.}}
>
> [A] Apply — I'll print the invocation, you run it
> [P] Pick another — show me the alternatives I might have considered
> [C] Cancel — defer the iteration

## Handoff

⏸ **HALT — wait for user A / P / C choice on the recommendation.**

- `[A]` → print the invocation phrase verbatim, then add: *"Run that, and the recommended skill will pick up from here. `aped-iterate` is done — invoke me again if the next step surfaces a new layer of delta."* Exit cleanly.
- `[P]` → show the next-best two recommendations from the matrix with their rationale, then re-pose the A/P/C menu on the recommendation.
- `[C]` → exit with: *"Iteration deferred. Re-invoke `aped-iterate` whenever you want to revisit."*

**Do NOT auto-chain.** Even on `[A]`, the user invokes the next skill themselves. This skill is read-only on artefacts and never writes state.

## Common Issues

- **"The recommended skill says it needs a PRD but I don't have one"**: the recommendation assumes the project followed APED from the start. If the codebase predates APED, run `aped-context` first to capture brownfield state, then re-run `aped-iterate`.
- **"My delta is two unrelated things"**: Q1 `[d]` (mix) routes you to `aped-prd` first to split. Once split, run `aped-iterate` on each goal.
- **"I picked `[U]` on an OOS KB match but the entry didn't have a Resolved section"**: that's expected — the resolved suffix carries the rename + audit trail; the rationale lives in the next PRD section if the decision needs to be re-litigated formally.
- **"Active worktree found, skill HALTed"**: by design — `aped-course` is the right tool while a story is in flight. Run `aped-iterate` between sprints.
- **"The matrix recommended `aped-quick` but my Q5 says timeline pressure is yes"**: the matrix already biases toward the lighter skill on `Q5: [a]`. If the bias still feels wrong, pick `[P]` to see the alternatives.

## Example

User runs `aped-iterate "we shipped the dashboard but export to CSV is missing — partner is asking for it"`:

1. Discovery: last merge `feat: dashboard MVP`, latest done artefact `2-3-dashboard-render.md`, no active sprint.
2. OOS KB scan: no match (`export`, `csv` aren't in `.aped/.out-of-scope/`).
3. Q1 layer: user picks `[b]` (new capability — export wasn't in the dashboard MVP scope).
4. Q2 blast: `[a]` (≤5 files — one endpoint, one button, one util).
5. Q3 reversibility: `[a]` (reversible — adds a feature, doesn't break existing).
6. A/P/C after Q3: user picks `[C]` Continue.
7. Recommendation: **`aped-quick`** — new capability but small blast and fully reversible, no need for a full PRD update unless the partner ask grows. Rationale names Q1 `[b]` + Q2 `[a]` + Q3 `[a]`.
8. User picks `[A]` Apply.
9. Handoff: *"Tell Claude Code: 'quick fix add CSV export to dashboard'. That'll invoke `aped-quick`."*

## Next Step

Tell the user: *"Recommendation made. Invoke the recommended skill yourself when ready. `aped-iterate` does not auto-chain."*

**Do NOT auto-chain.** The user decides when to proceed.
