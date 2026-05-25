---
name: aped-arch
keep-coding-instructions: true
description: 'Use when user says "create architecture", "technical architecture", "solution design", "system design", "design the architecture", or invokes aped-arch. Runs between PRD and Epics.'
allowed-tools: Read Write Edit Glob Grep Bash Agent TaskCreate TaskUpdate
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.12.3
---

Follow the instructions in `.aped/aped-arch/workflow.md`.
