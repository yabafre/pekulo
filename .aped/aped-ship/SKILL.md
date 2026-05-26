---
name: aped-ship
keep-coding-instructions: true
description: 'Use when user says "ship", "sprint pr", "pre-push", "aped ship", "open the umbrella PR", "end of sprint", "composite review", or invokes aped-ship. Only runs from the main project on the base branch — never from inside a worktree. HALTs before push.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.12.4
---

Follow the instructions in `.aped/aped-ship/workflow.md`.
