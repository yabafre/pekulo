# Sprint Status Dashboard Format

## Pipeline Progress Bar

Display format:
```
Pipeline: A[✓] → P[✓] → UX[✓] → E[✓] → D[▶] → R[ ]
```

Symbols:
- `✓` = phase done
- `▶` = phase in-progress
- ` ` = phase not started
- `—` = phase skipped

## Epic Progress Bar

```
Epic 1: {{title}}  [████████░░] 80% (4/5 stories)
```

- Bar: 10 chars wide, `█` for done, `░` for remaining
- Show fraction and percentage

## Story Status Icons

| Status | Icon | Meaning |
|--------|------|---------|
| done | ✓ | Story completed and reviewed |
| review | ⟳ | Waiting for adversarial review |
| in-progress | ▶ | Currently being implemented |
| ready-for-dev | ○ | Ready to start |
| backlog | · | Not yet planned |
| blocked | ✗ | Blocked by issue |

## Blocker Categories

- **[AI-Review]** items — review findings not yet addressed
- **HALT** — dev stopped due to missing config/dependency/ambiguity
- **Stuck** — in-progress for multiple sessions without progress
- **Dependency** — blocked by another story

## Next Action Logic

| Current State | Suggestion |
|---------------|------------|
| Stories ready-for-dev | "Run aped-dev to implement next story" |
| Stories in review | "Run aped-review to review completed story" |
| All stories done | "Pipeline complete! Run aped-qa for E2E tests" |
| Blockers found | Describe each blocker and resolution path |
| No state file | "Run aped-analyze to start the pipeline" |
