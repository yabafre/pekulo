---
name: aped-prd
keep-coding-instructions: true
description: 'Use when user says "create PRD", "generate PRD", "draft requirements", "product requirement", "write the prd", "aped prd", or invokes aped-prd. Headless mode available via --headless.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
argument-hint: "[--headless]"
license: MIT
metadata:
  author: yabafre
  version: 6.3.2
---

Follow the instructions in `.aped/aped-prd/workflow.md`.
