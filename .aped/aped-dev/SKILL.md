---
name: aped-dev
keep-coding-instructions: true
description: 'Use when user says "start dev", "implement story", "aped dev", "TDD", "TDD cycle", "red green refactor", "failing test first", "generate unit tests", or invokes aped-dev. Not for hotfixes or single-file isolated changes — see aped-quick for those. Not for E2E tests — see aped-qa for that.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "[story-key]"
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.12.5
---

Follow the instructions in `.aped/aped-dev/workflow.md`.
