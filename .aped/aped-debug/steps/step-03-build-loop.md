---
step: 3
reads:
  - "src/**"
  - "tests/**"
  - ".aped/scripts/hitl-loop.template.sh"
writes:
  - "tests/**"
mutates_state: false
---

# Step 3: Phase 1 — Build the Feedback Loop

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 THIS IS THE SKILL — spend disproportionate effort here
- 🛑 No loop = no debug. If you can't build one, HALT and surface
- 🚫 Forbidden: arbitrary `setTimeout` waits — use `waitFor()` (condition-based)

## YOUR TASK

Build a fast, deterministic, agent-runnable pass/fail signal for the bug. Iterate on the loop itself.

## CONSTRUCTION METHODS (try in roughly this order)

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e. Cheapest signal when a seam exists.
2. **Curl / HTTP script** against a running dev server. Bypasses the test framework when the bug is in request handling.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot. Works for batch / pipeline tools.
4. **Headless browser** (Playwright / Puppeteer) — drives the UI, asserts on DOM / console / network. Required when the bug surfaces only in the rendered page.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and watch for the failure mode.
8. **Bisection harness.** Automate "boot at state X, check, repeat" so `git bisect run` works.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL bash script.** Last resort. If a human must click, drive *them* with `.aped/scripts/hitl-loop.template.sh` (if shipped) so the loop is still structured.

Build the right feedback loop, and the bug is 90% fixed.

## ITERATE ON THE LOOP ITSELF

Treat the loop as a product. Once you have *a* loop, ask:

- **Faster?** Cache setup, skip unrelated init, narrow the test scope.
- **Sharper?** Assert on the specific symptom, not "didn't crash".
- **More deterministic?** Pin time, seed RNG, isolate filesystem, freeze network.

A 30-second flaky loop is barely better than no loop. A 2-second deterministic loop is a debugging superpower.

## SUB-DISCIPLINE — CONDITION-BASED WAITING

Flaky tests often guess at timing with arbitrary delays. **Wait for the actual condition you care about, not a guess about how long it takes.**

Forbidden patterns:
- **Polling too fast** (`setTimeout(check, 1)`) — wastes CPU. Poll every 10ms.
- **No timeout** (`while (!cond) { ... }`) — loops forever. Always include a timeout with a clear error.
- **Stale data** (caching a getter result above the loop) — the loop checks the cached value forever. Call the getter inside the loop.

Reference `waitFor(condition, description, timeoutMs = 5000)` in the project's test utilities. Exception: when the test is *about* timing behaviour (debounce, throttle), document why arbitrary timing is correct.

## NON-DETERMINISTIC BUGS

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not — keep raising the rate until it is.

## WHEN YOU GENUINELY CANNOT BUILD A LOOP

Stop. Say so explicitly. List what you tried. Ask the user for: (a) access to the environment that reproduces, (b) a captured artefact (HAR file, log dump, core dump, screen recording with timestamps), or (c) permission to add temporary production instrumentation. Do NOT proceed to step 04 without a loop you believe in.

## NEXT STEP

Load `.aped/aped-debug/steps/step-04-reproduce.md`.
