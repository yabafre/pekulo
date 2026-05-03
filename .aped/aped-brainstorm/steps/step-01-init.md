---
step: 1
reads:
  - "docs/brainstorm/session-{date}.md"
writes:
  - "docs/brainstorm/"
mutates_state: false
---

# Step 1: Initialization & Resume Check

## YOUR TASK

Check for existing session, prompt for topic, prepare output directory.

## SETUP

1. Check for existing session file: `docs/brainstorm/session-{date}.md`.
   - If exists and < 7 days old: ask user — *"Resume previous session ({date})? Or start fresh?"*
2. Ensure output directory exists:

   ```bash
   mkdir -p docs/brainstorm
   ```

3. If user passed a topic argument, use it. Else ask: *"What are we brainstorming today? One sentence."*

## NEXT STEP

Load `.aped/aped-brainstorm/steps/step-02-framing.md` (or `step-04-facilitation.md` if resuming).
