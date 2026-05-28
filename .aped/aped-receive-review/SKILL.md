---
name: aped-receive-review
keep-coding-instructions: true
description: 'Use when receiving code review feedback or when aped-dev hands back review comments to address. Invoked from aped-dev after aped-review reports issues, or standalone when user pastes external review feedback (PR comments, GitHub thread, senior engineer Slack message). Triggers on phrases like "address review", "address PR comments", "fix the review feedback", "the reviewer said", "received PR comments".'
allowed-tools: Read Edit Bash Grep Glob Agent
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.13.0
---

Follow the instructions in `.aped/aped-receive-review/workflow.md`.
