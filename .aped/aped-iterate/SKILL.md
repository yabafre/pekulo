---
name: aped-iterate
keep-coding-instructions: true
description: 'Use when user says "iterate", "rework", "after merge", "post-ship", "what now after merge", "we shipped X, now we need Y", "address the gap", or invokes aped-iterate. Routes a post-ship delta to the right downstream skill — does not implement the change itself.'
argument-hint: "[short delta description]"
allowed-tools: "Read Grep Glob Bash"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.3.1
---

Follow the instructions in `.aped/aped-iterate/workflow.md`.
