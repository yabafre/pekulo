---
step: 6
reads:
  - "src/**"
  - "tests/**"
  - ".aped/scripts/find-polluter.sh"
writes:
  - "src/**"
  - "tests/**"
mutates_state: false
---

# Step 6: Phase 4 — Instrument (one variable at a time)

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 Each probe maps to a specific prediction from step 05
- 🛑 Change ONE variable at a time
- 🚫 Never "log everything and grep"

## YOUR TASK

Add targeted probes (debugger preferred, then logs) to falsify hypotheses. Tag temporary logs `[DEBUG-XXXX]` for cleanup at step 08.

## TOOL PREFERENCE

1. **Debugger / REPL inspection** if env supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

## `[DEBUG-XXXX]` TAG CONVENTION

Every temporary log added during instrumentation gets a unique tag, e.g. `[DEBUG-a4f2]` (4 random hex characters). The tag enables a single grep at step 08 cleanup.

```typescript
// Phase 4 instrumentation — removed at step 08.
console.error('[DEBUG-a4f2] git init', { directory, cwd: process.cwd() });
```

```python
# Phase 4 instrumentation — removed at step 08.
print(f"[DEBUG-7c91] cart.checkout", flush=True)
```

Untagged probes survive; tagged probes die at cleanup.

## SUB-DISCIPLINE — ROOT-CAUSE TRACING

Bugs often manifest deep in the call stack. Your instinct is to fix where the error appears — that's treating a symptom.

**Trace backward through the call chain until you find the original trigger; then fix at the source.**

Decision flow:
1. **Observe the symptom** verbatim (`Error: git init failed in /Users/...`).
2. **Find the immediate cause** — what code directly produces this?
3. **Walk one level up** — what called this? What value was passed at this frame?
4. **Keep tracing up** — at which frame does the bad value originate?
5. **Find the original trigger** — where did the bad value come from?
6. **Fix at the source**, not the leaf operation.

If manual tracing dead-ends, instrument with `[DEBUG-XXXX]` logs at each component boundary; capture the stack with `new Error().stack` (Node) or `traceback.extract_stack()` (Python). Log **before** the dangerous operation, not after it fails.

## PERFORMANCE BRANCH

For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## FIND POLLUTER (test pollution)

If something appears during tests but you don't know which test triggers it, run the bisection script:

```bash
bash .aped/scripts/find-polluter.sh 'tmp/test-state.db' 'tests/**/*.test.ts'
```

Pass (1) a path that should NOT exist before any test runs, and (2) a glob of test files. The script runs tests one-by-one, stops at the first that creates or mutates the state path.

## END OF PHASE 4

⏸ **HALT — Phase 4 ends with a confirmed cause statement of the form** *"the failure happens because &lt;specific code path&gt; does &lt;specific behaviour&gt; when &lt;specific condition&gt;"*, with the exact `file:line` reference.

## NEXT STEP

Load `.aped/aped-debug/steps/step-07-fix-and-regression-test.md`.
