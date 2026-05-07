---
name: aped-arch-audit
keep-coding-instructions: true
description: 'Use when user says "audit architecture", "find shallow modules", "deepen modules", "deletion test", "depth analysis", "leverage analysis", "scan for refactor opportunities", "improve codebase architecture", "pass-through wrappers", "audit module depth", "aped arch audit", or invokes aped-arch-audit. Surfaces deepening candidates in an existing codebase — produces a report and HALTs; never auto-refactors.'
argument-hint: "[area or module to audit]"
allowed-tools: "Read Grep Glob Bash Agent"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.3.2
---

Follow the instructions in `.aped/aped-arch-audit/workflow.md`.
