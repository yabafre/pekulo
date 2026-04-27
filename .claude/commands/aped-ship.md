---
name: aped-ship
description: 'End-of-sprint batch merge + pre-push composite review on main. Merges all done stories in conflict-minimizing order, runs secret scan, typecheck, lint, db:generate, state.yaml + worktree consistency. Never pushes — HALTs for user. Use when user says "ship", "merge sprint", "pre-push", "aped ship", or invokes /aped-ship. Only runs from the main project on the main branch.'
---

Read and follow the SKILL.md at ${CLAUDE_PROJECT_DIR}/.aped/aped-ship/SKILL.md
