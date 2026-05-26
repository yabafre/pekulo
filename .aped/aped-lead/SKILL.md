---
name: aped-lead
keep-coding-instructions: true
description: 'Use when user says "lead", "check approvals", "check sprint check-ins", "aped lead", or invokes aped-lead. Runs from the main project, not a worktree.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.12.4
---

Follow the instructions in `.aped/aped-lead/workflow.md`.
