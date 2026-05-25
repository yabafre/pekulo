---
name: aped-debug
keep-coding-instructions: true
description: 'Use when user says "debug", "diagnose", "troubleshoot", "why is X failing", "find the root cause", "feedback loop", "hypothesise", "aped debug", or invokes aped-debug. Also invoked from aped-dev on persistent test red (≥3 failed attempts) and from aped-review on findings that need root-cause investigation.'
allowed-tools: Read Edit Bash Grep Glob Agent
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.12.3
---

Follow the instructions in `.aped/aped-debug/workflow.md`.
