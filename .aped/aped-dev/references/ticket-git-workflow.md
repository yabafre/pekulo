# Ticket System & Git Provider Integration

Read `ticket_system` and `git_provider` from config.yaml to adapt all instructions below.

---

## Ticket System Sync Rules

### If ticket_system = "none"
Skip all ticket references. Use plain commit messages without ticket IDs.

### If ticket_system = "linear"

**BEFORE starting a story:**
1. Find the corresponding Linear issue
2. Move issue status to **In Progress**
3. Use the **Linear-suggested git branch name** (from Linear UI: "Copy git branch name")
4. Add a comment on the issue: what you're about to implement

**DURING development:**
- Reference the Linear issue ID in EVERY commit message
- Use **Linear magic words** for auto-linking:
  - `Part of TEAM-XX` — links without closing (use in intermediate commits)
  - `Fixes TEAM-XX` — links and auto-closes issue on merge
- Commit format: `type(TEAM-XX): description\n\nPart of TEAM-XX`

**AFTER completing:**
1. Create PR with issue ID: `gh pr create --title "feat(TEAM-XX): Story X.Y - Description" --body "Fixes TEAM-XX"`
2. Move issue to **In Review**
3. After merge: move to **Done**
4. Update state.yaml to match

### If ticket_system = "jira"

**BEFORE:** Find JIRA issue (PROJ-XX), move to In Progress, use branch: `feature/PROJ-XX-description`

**DURING:**
- Reference JIRA issue ID in every commit: `type(PROJ-XX): description`
- JIRA smart commits: `PROJ-XX #in-progress`, `PROJ-XX #done`

**AFTER:**
- PR title: `feat(PROJ-XX): Story X.Y - Description`
- JIRA auto-links PRs via issue ID in branch name or commit

### If ticket_system = "github-issues"

**BEFORE:** Find GitHub issue #XX, assign yourself

**DURING:**
- Reference in commits: `type(#XX): description`
- Use `Closes #XX` or `Fixes #XX` in final commit/PR body

**AFTER:**
- `gh pr create --title "feat: Story X.Y" --body "Closes #XX"`
- Issue auto-closes when PR merges

### If ticket_system = "gitlab-issues"

**BEFORE:** Find GitLab issue #XX, assign yourself

**DURING:**
- Reference: `type(#XX): description`
- Use `Closes #XX` in commit/MR body

**AFTER:**
- `glab mr create --title "feat: Story X.Y" --description "Closes #XX"`
- Issue auto-closes when MR merges

---

## Git Provider Workflow

### If git_provider = "github"

**Branch strategy:**
```
main (production)
  └── develop (integration, if configured)
        └── feature/{ticket-id}-description
```

**Commands:**
```bash
# Start story
git checkout main  # or develop if exists
git pull
git checkout -b feature/{ticket-id}-description

# During dev
git add <specific-files>  # NEVER git add . or git add -A
git commit -m "type({ticket-id}): description"

# Complete
git push -u origin feature/{ticket-id}-description
gh pr create --base main --title "type({ticket-id}): Story X.Y - Title" --body "Fixes {ticket-id}"

# After merge
git checkout main && git pull
git branch -d feature/{ticket-id}-description
```

### If git_provider = "gitlab"

**Commands:**
```bash
# Start
git checkout main && git pull
git checkout -b feature/{ticket-id}-description

# Complete
git push -u origin feature/{ticket-id}-description
glab mr create --base main --title "type({ticket-id}): Story X.Y" --description "Closes {ticket-id}"

# After merge
git checkout main && git pull
git branch -d feature/{ticket-id}-description
```

### If git_provider = "bitbucket"

**Commands:**
```bash
# Start
git checkout main && git pull
git checkout -b feature/{ticket-id}-description

# Complete
git push -u origin feature/{ticket-id}-description
# Create PR via Bitbucket web UI or API
```

---

## Commit Message Format

```
type({ticket-id}): short description

[Optional body]

{Magic word} {ticket-id}
```

| Prefix | Usage |
|--------|-------|
| feat | New feature / story implementation |
| fix | Bug fix |
| refactor | Code restructuring (no behavior change) |
| test | Adding or updating tests |
| docs | Documentation changes |
| chore | Build, config, tooling changes |

---

## State Sync

Local state.yaml and ticket system MUST agree:

| state.yaml | Linear | Jira | GitHub/GitLab Issues |
|------------|--------|------|---------------------|
| backlog | Backlog | Backlog | No label |
| ready-for-dev | Todo | To Do | "ready" label |
| in-progress | In Progress | In Progress | "in progress" label |
| review | In Review | In Review | PR linked |
| done | Done | Done | Closed |

**If they diverge, the ticket system is the authority.** Update state.yaml to match.

---

## Epic/Milestone Tracking

- When first story of an epic moves to In Progress → update epic/milestone status
- When ALL stories in an epic are Done → mark milestone complete
- Keep milestone descriptions updated if scope changes

---

## Critical Rules

1. NEVER commit directly to main
2. ALWAYS create feature branch before starting
3. ALWAYS include ticket ID in every commit message
4. ALWAYS update ticket status: In Progress → In Review → Done
5. ALWAYS stage specific files — never `git add .` or `git add -A`
6. ALWAYS use ticket system's suggested branch name when available
7. NEVER commit secrets (.env, API keys, settings.local.json)
