# Writing Discipline — Commits, PRs, Comments, Reviews, Tickets

**Iron Law.** Short, sharp, slightly human. The diff proves the work — prose adds the *why*, never re-narrates the *what*. See [`ETHOS.md` § aped-skills-writing-discipline](../ETHOS.md#aped-skills-writing-discipline) for full rationale.

## What this applies to

- **Commit messages** — subject + optional body
- **PR titles + bodies**
- **Code comments** authored mid-implementation
- **Review reports** (summary, findings, decisions in Review Records)
- **Ticket comments** (Linear / Jira / GitHub / GitLab — issue updates, descope notes, sync comments)

## What this does NOT apply to

PRDs, stories, architecture docs, retros, project-context. Those are structured specs by design — keep them detailed.

## The rules

### Commits

- **Subject:** one line, imperative, ≤ 70 chars, says the change in human terms.
- **Body:** only if there is a non-obvious *why*. 2–4 sentences. No bullet inventories. No file lists. No test counts. No "boundaries respected" checkboxes.
- A metaphor or framing line is welcome where it fits ("kill switch with memory", "drift gets a fence"). Don't force it.

### PRs

- **Always open as draft.** Pass `--draft` to `gh pr create` (or `--draft` to `glab mr create`). Mark ready (`gh pr ready <n>` / `glab mr update --ready`) only once the validation block in the body has been re-run and is green.
- **Title:** short and recognizable. Same rules as commit subject. ≤ 70 chars.
- **No project-internal jargon in the body.** A reviewer who doesn't know this codebase must grasp the change without a glossary. Never let these terms reach the emitted body: `/aped-X` slash names, internal phase names, sprint-mode labels ("Path A"), and the words `AC`, `story`, `umbrella`, `baseline`, `FR`. Translate before writing: `AC` → describe the behaviour; `story` → "the change" / "the feature"; `umbrella` → "the integration branch"; `baseline` → "previous behaviour"; `FR` → name the requirement plainly. Describe what the *code* does ("the parallel sprint dispatcher writes a worktree marker"), not which internal command runs.
- **Body shape.** Five sections, in this order. Plain prose, why + how. Omit any section that has nothing to say (usually Notes):

  ```markdown
  ## Summary

  <What shipped, in one or two plain sentences.>

  ## Problems

  <What was broken or missing — the why. Plain terms a reviewer recognizes.>

  ## Solution

  <What was done about it — the how. One concrete change per line if you list them.>

  ## Verification

  <The exact commands a reviewer can copy-paste, and what coverage moved. Short.>

  ## Notes

  <Caveats, follow-ups, anything left for later. Omit this section if empty.>
  ```

- **Trivial PRs** (typo, one-liner, dep bump): the full shape is overkill — keep `## Summary` + `## Verification` and drop the rest.
- Drop "Migration notes", "Boundaries respected", per-commit tables, file lists, test counts, themed per-area sections. Unless the user asks.

### Code comments

- Only when WHY is non-obvious. Never restate WHAT.
- Never reference "this PR" / "issue #" / "added for the X flow" — those rot.
- One short line. Multi-paragraph docstrings only when public-API contract demands it.

### Review reports / Review Records

- Lead with the verdict and the *one thing* that matters.
- Findings: severity, file:line, one-sentence rationale, fix or defer. No padding.
- "Minimum findings floor" doesn't mean "pad to N". If you genuinely have fewer, say so and stop.

### Ticket comments

- Status change + one-line context. Link to the artefact (story file, commit, PR) that explains the rest.
- Don't re-narrate the work in the ticket.

## Smell test (run before sending)

1. Could a reader skim this in 10 seconds and know what changed and why?
2. Would I be embarrassed reading this back as a senior engineer?
3. Is there any sentence that's there to look thorough rather than to inform?

If any answer is no/yes/yes — cut.
