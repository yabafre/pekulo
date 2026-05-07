---
name: aped-review
keep-coding-instructions: true
description: 'Use when user says "review code", "run review", "aped review", or invokes aped-review.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "[story-key]"
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.3.2
---

Follow the instructions in `.aped/aped-review/workflow.md`.
