---
name: aped-brainstorm
keep-coding-instructions: true
description: 'Use when user says "brainstorm", "ideate", "generate ideas", "divergent thinking", or invokes aped-brainstorm. Horizontal — invokable at any phase.'
when_to_use: 'Use when user says "brainstorm", "help me ideate", "explore ideas". Runs before aped-analyze when the idea is still fuzzy.'
argument-hint: "[topic]"
allowed-tools: Read Write Edit Glob Grep Bash TaskCreate TaskUpdate
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.14.0
---

Follow the instructions in `.aped/aped-brainstorm/workflow.md`.
