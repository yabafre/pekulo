# Out-of-scope knowledge base

This directory holds APED's persistent rejection memory. Each `<concept>.md` file
captures a scope decision that should not be re-litigated next sprint.

## Format

Each entry is a markdown file named after the concept slug
(`dark-mode.md`, `mobile-app.md`, `social-login.md`):

```markdown
---
concept: dark-mode
rejected_at: YYYY-MM-DD
decided_by: <name>
---

## Why this is out of scope

<!-- One paragraph. Reference the PRD section, FR ID, or design decision
     that establishes the scope boundary this concept would violate. -->

## Prior requests

<!-- Append-only. Most recent at top. Each entry:
     date -- source (issue ID / PR / conversation) -- one-line summary. -->

- YYYY-MM-DD -- initial decision (PRD section reference).
```

## How APED uses this directory

`aped-from-ticket` and `aped-quick` scan these entries before drafting a story
or quick-spec. If the incoming request matches a filename token (exact word
equality, see those skills for the heuristic), the user is offered:

- `[K]` Keep the refusal -- abort the draft with a clear refusal message.
- `[O]` Override -- append the new request to the entry's "Prior requests"
        list and continue with the draft.
- `[U]` Update -- the rejection is stale; rename the entry to
        `<concept>-resolved-YYYY-MM-DD.md` and continue with the draft.

`aped-prd` Section 2 (Out of Scope) lets you promote a per-PRD decision to
this KB for cross-PRD persistence.

## Conventions

- Resolved entries are renamed, never deleted -- the audit trail survives.
- This directory is committed to the repo; the KB is shared across the team.
- Empty KB (only this README present) is the default shape after `npx aped-method`.
