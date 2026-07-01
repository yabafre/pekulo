---
name: aped-sprint
keep-coding-instructions: true
description: 'Use when user says "parallel sprint", "dispatch stories", "aped sprint", or invokes aped-sprint. Only runs inside the main project, not inside a worktree. Creates worktrees only — story-ready and state flips are owned by aped-story.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.14.0
---

Follow the instructions in `.aped/aped-sprint/workflow.md`.
