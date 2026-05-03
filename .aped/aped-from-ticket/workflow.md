
# APED From-Ticket — External Ticket Intake

Bridge an external ticket (one that was NOT planned via `aped-epics`) into the project's story flow. The skill fetches the ticket, analyses the codebase context, drafts a project-conformant story, persists it under the right placement, and optionally posts a comment back on the source ticket.

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

- This skill is for **tickets that have no entry in `epics.md` / `state.yaml` yet**. For stories already planned in the sprint, use `aped-story`.
- The ticket system in use is determined by `ticket_system` in `.aped/config.yaml` — never assume or default.
- If `ticket_system: none`, refuse to run with a clear message: this skill requires a configured ticket system.
- **Provider parity is mandatory.** The skill must handle every value the APED installer offers (`linear`, `jira`, `github-issues`, `gitlab-issues`). For `linear` and `jira`, that means the corresponding MCP must be configured in the user's Claude Code; for `github-issues` and `gitlab-issues`, `gh` / `glab` CLIs must be installed and authenticated.
- **Do not auto-chain into dev.** After the story is written, ask the user how to proceed — do not silently run `aped-dev`.
- **Do not modify the ticket without permission.** Comment-back is opt-in via config.

> **Setup pointer.** Requires `ticket_system != 'none'` in `.aped/config.yaml` — refuses to run otherwise. Run `npx aped-method` to configure a provider. Hard-dep matrix: `docs/skills-classification.md`.

## Setup

1. From `.aped/config.yaml` (already loaded at activation), resolve the skill-specific keys:
   - `from_ticket.story_placement.mode` (default: `ask`) — one of `bucket` | `auto_match` | `ask`
   - `from_ticket.story_placement.bucket_epic` (default: `external-tickets`)
   - `from_ticket.ticket_comment.enabled` (default: `false`)
   - `from_ticket.ticket_comment.template` (default: `"Picked up — story drafted at {story_path}"`)
   - `from_ticket.sprint_integration.auto_add` (default: `false`)
   - `from_ticket.handoff.after_story` (default: `ask`) — one of `ask` | `stop` | `continue_to_dev`

   If a key is missing, use the default. Keys are read-only here; this skill does not write `config.yaml`.

2. Read `docs/state.yaml` — note current phase, sprint, and existing story keys (for collision avoidance).

3. Read `docs/epics.md` — load the epic list (needed for `auto_match` and `ask` placement modes).

## Refusal Gate

If `ticket_system == none`:

> "ticket_system is set to 'none' in `.aped/config.yaml`. `aped-from-ticket` requires a configured ticket system (linear, jira, github-issues, or gitlab-issues). Reconfigure APED or use `aped-quick` instead."

HALT.

## Open the sync log

Before any provider call, capture an audit-log path. The provider name is the value of `ticket_system` from config; pass it verbatim:

```bash
LOG=$(bash .aped/scripts/sync-log.sh start <provider>)
```

Capture `$LOG` once and reuse it for every subsequent `phase` / `record` / `end` call. If `sync_logs.enabled: false`, the helper exits silently and `$LOG` is empty — downstream calls become no-ops; that's expected.

## Provider Readiness Check

Before fetching, verify the toolchain for the configured `ticket_system`:

- `github-issues`: `gh auth status` must succeed → otherwise HALT with `"gh CLI not authenticated. Run 'gh auth login' first."`
- `gitlab-issues`: `glab auth status` must succeed → otherwise HALT with `"glab CLI not authenticated. Run 'glab auth login' first."`
- `linear`: the Linear MCP must be available in this Claude Code session (i.e., a tool prefixed `mcp__linear` is exposed) → otherwise HALT with `"Linear MCP is not configured in Claude Code. Configure it before using aped-from-ticket."`
- `jira`: the Atlassian/Jira MCP must be available → otherwise HALT with `"Jira/Atlassian MCP is not configured in Claude Code. Configure it before using aped-from-ticket."`

Never silently downgrade to a different provider. The user chose `ticket_system` at install — respect it.

After the auth check completes:

```bash
bash .aped/scripts/sync-log.sh phase $LOG auth_check complete
bash .aped/scripts/sync-log.sh record $LOG api_calls_total 1
```

## Argument Parsing

The user passes `<ticket-id-or-url>`. Accept all of:

- Bare ID: `LIN-1234`, `PROJ-42`, `#42`, `42`
- Full URL: `https://linear.app/{team}/issue/LIN-1234/...`, `https://github.com/{owner}/{repo}/issues/42`, `https://gitlab.com/{owner}/{repo}/-/issues/42`, `https://{tenant}.atlassian.net/browse/PROJ-42`

Parsing rules:
- If a URL is given and its host doesn't match `ticket_system`: HALT, do NOT fall back. Tell the user: `"URL host doesn't match ticket_system={ticket_system}. Reconfigure APED or pass an ID consistent with the configured provider."`
- If only a number is given for `linear`/`jira`: HALT and ask the user for the team/project key prefix.
- If no argument is given: ask the user interactively.

## Ticket Fetch

Fetch the ticket using the configured provider's tool. Capture: title, body/description, labels, status, assignees, comments (most recent 10), URL, ticket id.

- `github-issues`: `gh issue view {id} --json title,body,labels,comments,assignees,state,url`
- `gitlab-issues`: `glab issue view {id} --output json`
- `linear`: use the Linear MCP tool to fetch the issue by identifier
- `jira`: use the Jira/Atlassian MCP tool to fetch the issue by key

If the fetch fails (404, permission denied, etc.): HALT and report the underlying error verbatim. Do not invent ticket content.

After the fetch:

```bash
bash .aped/scripts/sync-log.sh phase $LOG ticket_fetch complete '{"calls":1,"ticket":"<id>"}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total 1
```

## Out-of-Scope KB Scan

Before drafting, check the project's persistent rejection memory at `.aped/.out-of-scope/`. The directory may not exist on pre-4.2 scaffolds — treat the missing directory as an empty KB and skip this section silently.

1. **List entries.** `ls .aped/.out-of-scope/*.md 2>/dev/null` excluding `README.md`. If no entries (or directory missing), skip the rest of this section.

2. **Tokenize the ticket title.** Lowercase, strip punctuation, split on whitespace, `-`, and `_`. Each word becomes a token. Drop tokens of ≤2 characters and common stop-words (`add`, `fix`, `update`, `the`, `a`, `an`, `to`, `for`, `with`).

3. **Match entries.** For each entry file, tokenize its filename the same way (drop the `.md` extension first; resolved files end with `-resolved-YYYY-MM-DD` — strip that suffix before tokenizing so old decisions still match). An entry matches if any title token equals any filename token (exact word equality, no substring or fuzzy matching).

4. **No match → continue silently** to Codebase & Project Context Compilation.

5. **One or more matches → surface to user.** For each match, show the entry's frontmatter (`concept`, `rejected_at`, `decided_by`) plus its `## Why this is out of scope` paragraph (~10 lines), then present the menu:

   ```
   ⚠️ Out-of-scope KB match: .aped/.out-of-scope/{matched-file}

   {entry summary}

   [K] Keep refusal — abort this intake, the rejection still holds
   [O] Override — append this ticket to the entry's "Prior requests" list, then continue
   [U] Update — the rejection is stale; rename the entry to {concept}-resolved-{today}.md and continue
   ```

   ⏸ **HALT — wait for user choice per match.**

6. **Behaviour by choice:**
   - `[K]` → abort the skill with: `"Concept '{concept}' was declared out of scope on {rejected_at} (reason: {one-line rationale from the entry}). Refusing to ingest ticket {ticket-id}. To revisit, re-invoke and pick `[U]` on the same match."` Update the sync log: `bash .aped/scripts/sync-log.sh phase $LOG oos_refused complete '{"concept":"<concept>"}'`. Exit cleanly.
   - `[O]` → prepend `- {today} — {ticket-id} ({source-url}): {one-line ticket framing}` to the entry's `## Prior requests` list (most recent at top, after the section header). Commit nothing yet (the story write later will batch this with the story file commit on the feature branch). Continue to Codebase Compilation.
   - `[U]` → rename the file to `{concept}-resolved-{YYYY-MM-DD}.md` (today's date, ISO). Append a final section to the entry's body: `## Resolved on {YYYY-MM-DD}\n\n{one-line user-supplied note}` (ask the user for the note; default is `"Resolved while drafting from {ticket-id}"`). Continue to Codebase Compilation.

7. **Multi-match adjudication.** If multiple entries match the same title, present each in order; the user adjudicates each independently. If any single match resolves to `[K]`, abort the whole intake.

## Codebase & Project Context Compilation

Before drafting the story, gather context — same spirit as `aped-story` but starting from the ticket, not from a planned epic:

1. **PRD** — read `docs/prd.md` if it exists. Identify FRs/NFRs that semantically overlap with the ticket; flag in the draft.
2. **Architecture** — read `docs/architecture.md` if it exists. Note any constraint that affects how the ticket should be implemented.
3. **UX spec** — read `docs/ux/` if it exists. Surface any screen/component the ticket touches.
4. **Existing epics & stories** — re-scan `epics.md` for stories that look related (overlapping files, similar domain). Useful for `auto_match` and to flag duplication risk to the user.
5. **Codebase** — scan the working tree for files / patterns the ticket references (function names, modules, routes mentioned in the ticket body).

## Story Placement

Determine where the story goes, based on `from_ticket.story_placement.mode`:

- **`bucket`** — place under the `from_ticket.story_placement.bucket_epic` (default `external-tickets`). If that epic does not exist in `epics.md`, create a stub entry: `## Epic E-ext: External Tickets — Stories ingested from outside the planned epics.` Use a stable epic key like `ext` so story keys stay predictable.
- **`auto_match`** — score each existing epic against the ticket (title + body keyword overlap with epic title + story summaries). Pick the best match if score is decisive; otherwise fall back to bucket. Show the user the chosen epic and offer to override before writing.
- **`ask`** — present the user with: (a) the best-scored epic candidates from `auto_match`, (b) the bucket option. Let them pick.

In all modes, the user gets a final confirmation before the story file is written.

### Story Key Convention

For external tickets, story keys use the prefix of the chosen epic plus the ticket reference and a slug:

- Bucket placement: `ext-{ticket-id-slug}-{title-slug}` (e.g., `ext-lin-1234-fix-login-redirect`)
- Auto-match placement: `{epic#}-X-{ticket-id-slug}-{title-slug}` where `X` is the next free index in that epic

Slugs are lowercase, hyphenated, max 30 chars. Verify the key is unique against `state.yaml`'s existing story keys before assigning.

## Collaborative Story Design

Present a draft story to the user (no file written yet):

- **Title** — derived from the ticket title, rephrased as a user-value outcome if needed
- **Origin** — `Ticket: {ticket_id} ({ticket_url})`
- **As a / I want / So that** — drafted from the ticket body
- **Acceptance Criteria** — Given/When/Then derived from the ticket; flag any ambiguity
- **Tasks** — with `[AC: AC#]` references
- **Dev Notes** — file paths, patterns, dependencies surfaced during context compilation
- **Risk / overlap flags** — any duplication with existing stories, or PRD FRs the ticket overlaps

### Discussion Points

- "The ticket is ambiguous on X — propose Y, ok?"
- "This overlaps story `1-3-...` — should we defer to that one instead?"
- "Scope feels right for one dev session?"

⏸ **GATE: User must validate the placement, key, scope, and ACs before the file is written.**

## Story File Creation

Use template `.aped/templates/story.md`. In addition to the standard sections required by `aped-story`:

- Header includes:
  - `**Source:** ticket`
  - `**Ticket ID:** {ticket_id}`
  - `**Ticket URL:** {ticket_url}`
  - `**Origin:** aped-from-ticket`
- An `## Origin` section near the top reproducing the ticket title and a 2-3 line summary of the ticket body, plus the URL.

Write the file to `docs/stories/{story-key}.md`. Status: `ready-for-dev`.

After the story file is written:

```bash
bash .aped/scripts/sync-log.sh phase $LOG story_drafted complete '{"path":"docs/stories/<story-key>.md"}'
```

## State.yaml Integration

Update `docs/state.yaml`:

1. If the chosen epic does not exist as a key under `sprint` or `epics`, create the synthetic entry. For the bucket case, this means seeding an `epics.ext` entry with a description marking it as external-origin.
2. Add the story under `sprint.stories.{story-key}`:
   ```yaml
   sprint:
     stories:
       {story-key}:
         status: ready-for-dev
         ticket: "{ticket_id}"
         source: from_ticket
         worktree: null
         depends_on: []
   ```
3. **Sprint integration**:
   - If `from_ticket.sprint_integration.auto_add: false` (default): do NOT touch `sprint.active_epic` or any sprint-ordering field. The story is registered but kept out of the active sprint until the user explicitly promotes it.
   - If `auto_add: true`: append the story key to the active sprint's ordered list, after all currently-pending stories.

State.yaml authority — same rule as the rest of APED: in worktree mode, write the worktree's local state.yaml; resolution to main happens at `aped-ship` time. In solo mode, write directly.

After state registration:

```bash
bash .aped/scripts/sync-log.sh phase $LOG state_registered complete '{"story_key":"<key>"}'
```

## Comment Back to Ticket

If `from_ticket.ticket_comment.enabled: true`:

- Render the template `from_ticket.ticket_comment.template` with `{story_path}` substituted.
- Post the comment via the configured provider:
  - `github-issues`: `gh issue comment {id} --body "..."`
  - `gitlab-issues`: `glab issue note create {id} --message "..."`
  - `linear`: Linear MCP comment tool
  - `jira`: Jira/Atlassian MCP comment tool

If the post fails, report the error but do NOT roll back the story file — the local artefact stands on its own.

If `enabled: false` (default): skip silently.

After the ticket-comment attempt (whether posted or skipped):

```bash
bash .aped/scripts/sync-log.sh phase $LOG ticket_commented complete '{"calls":N,"posted":<true|false>}'
bash .aped/scripts/sync-log.sh record $LOG api_calls_total N   # N=0 if skipped, 1 if posted
bash .aped/scripts/sync-log.sh end $LOG
```

Surface the log path to the user.

## Handoff

Per `from_ticket.handoff.after_story`:

- **`ask`** (default): present the user with three options:
  ```
  Story drafted at docs/stories/{story-key}.md.
  [D] Run aped-dev {story-key} now
  [P] Promote to current sprint (add to sprint ordering)
  [S] Stop here — I'll pick this up later
  ```
- **`stop`**: report the path and exit.
- **`continue_to_dev`**: invoke `aped-dev {story-key}` directly.

**Do NOT auto-chain unless `continue_to_dev` is explicitly configured.**

## Self-review (run before user gate)

Before presenting the drafted story to the user, walk this checklist. Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Placeholder lint** — run `bash .aped/scripts/lint-placeholders.sh docs/stories/<story-key>.md`.
- [ ] **Same checks as `aped-story`** — exact file paths, full code blocks, exact test commands, Given/When/Then ACs, reader-persona check.
- [ ] **Ticket reference preserved** — the source ticket ID and link appear verbatim in the story frontmatter.
- [ ] **Dependencies resolved** — every `depends_on:` story is `done` (or the story is correctly placed in the bucket epic).
- [ ] **Sync log emitted** at `docs/sync-logs/<provider>-sync-<ISO>.json` (or skipped silently if `sync_logs.enabled: false` in `config.yaml`).

## Output

1. Story file at `docs/stories/{story-key}.md`
2. Updated `docs/state.yaml` (story registered, sprint ordering untouched unless `auto_add`)
3. (Optional) comment posted on the source ticket
4. Console summary: ticket id, story path, story key, placement (epic), sprint membership status, handoff next step

## Example

User: `aped-from-ticket LIN-1234`

Configured: `ticket_system: linear`, defaults otherwise (placement=ask, comment=disabled, sprint=manual, handoff=ask).

1. Provider check: Linear MCP available — OK.
2. Fetch LIN-1234: title "Login redirect loops on /admin", body, labels, 3 comments.
3. Context: PRD has FR-8 (auth flows) — flag overlap. No matching story in `epics.md`.
4. Placement (mode=ask): present "match Epic 2: Auth & sessions" or "bucket: external-tickets". User picks bucket.
5. Story key: `ext-lin-1234-fix-login-redirect-loop`.
6. Draft story shown — user adjusts AC-2.
7. ⏸ User validates → file written, state.yaml updated (story registered, NOT added to active sprint).
8. Handoff prompt → user picks `[P]` → story key appended to sprint ordering.
9. Console: "Story `ext-lin-1234-fix-login-redirect-loop` ready and queued in sprint. Run `aped-dev` when ready."

## Common Issues

- **Ticket has minimal description** (e.g., one-liner production bug): proceed, but the draft story will be sparse — flag it to the user, suggest enriching the ticket first OR proceed with the user's verbal clarification captured in `## Dev Notes`.
- **Multiple identical-looking tickets**: the skill operates on one ticket per invocation; do not auto-merge.
- **Ticket already linked to an existing story** (state.yaml has it): HALT, point the user at the existing story; suggest `aped-story` to refresh from the ticket instead.
- **MCP / CLI absent**: HALT with the exact remediation message — never silently fall back.
- **`ticket_system: none`**: refuse early — see Refusal Gate.

## Next Step

After successful run, follow `from_ticket.handoff.after_story`. By default, ask the user — never auto-chain.

## Completion Gate

BEFORE declaring this skill complete, Read `.aped/skills/aped-skills/checklist-from-ticket.md` and verify every item. Do NOT skip this step. If any item is unchecked, you are NOT done.
