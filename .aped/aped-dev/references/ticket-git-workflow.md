# Ticket System & Git Provider Integration

Read `ticket_system` and `git_provider` from config.yaml to adapt all instructions below.

---

## Ticket System Sync Rules

### If ticket_system = "github-issues"

**BEFORE:** Find GitHub issue #XX, assign yourself

**DURING:**
- Reference in commits: `type(#XX): description`
- Use `Closes #XX` or `Fixes #XX` in final commit/PR body

**AFTER:**
- `gh pr create --title "feat: Story X.Y" --body "Closes #XX"`
- Issue auto-closes when PR merges

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

---

## Commit Message Format

```
type({ticket-id}): short description

[Optional body — only when WHY is non-obvious]

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

**Writing discipline.** Read `{{APED_DIR}}/aped-skills/writing-discipline.md` before drafting commits, PR titles/bodies, code comments, review reports, or ticket comments. Iron Law: short, sharp, slightly human; the diff proves the work, prose adds the *why*. No file lists, no test counts, no boundary checkboxes, no "you're absolutely right" preambles.

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
