---
step: 5
reads:
  - "docs/stories/{story-key}.md"
  - "git/diff"
writes: []
mutates_state: false
---

# Step 5: Frontend Detection & Visual Dev Loop

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 If the story touches `.tsx` / `.jsx` / `.vue` / `.svelte`, the Visual Dev Loop is mandatory at every GREEN
- 🛑 NEVER assume `npm` — detect the runner via `aped/scripts/detect-package-runner.sh`
- ⚠️ React Grab MCP unavailable → log a WARNING, proceed without the visual check (review will catch it)

## CONTEXT BOUNDARIES

- Story classified single-layer / fullstack.
- Epic-context cache loaded.

## YOUR TASK

Detect frontend story; if so, ensure the dev server is running and inspect the root layout once via React Grab MCP before any UI task.

## DETECTION

Detect if this is a frontend story:

- Check if the story's File List contains `.tsx`, `.jsx`, `.vue`, `.svelte` files.
- Check if `docs/ux/` exists.

If neither matches, **skip this step** — go straight to step 06.

## VISUAL DEV LOOP (frontend stories)

(Applies to both single-layer frontend mode and Leo in fullstack mode.)

### 1. Ensure the dev server is running

Detect the runner deterministically:

```bash
PKG=$(bash .aped/scripts/detect-package-runner.sh)
"$PKG" run dev
```

Never assume `npm` — projects on bun/pnpm/yarn fail the script silently if you guess the wrong runner.

### 2. Inspect root layout (baseline)

Before writing any component, use `mcp__react-grab-mcp__get_element_context` to inspect the **root layout** — understand the existing component tree, props, and styles as baseline.

### 3. Visual check at GREEN

After each GREEN pass on a UI task (step 06):

- Use React Grab to inspect the implemented component.
- Verify it renders correctly in the component tree.
- Compare with UX spec (`docs/ux/design-spec.md`) — correct tokens, spacing, typography?
- Check the component is properly nested in the layout hierarchy.

### 4. Visual issues found

If visual issues are found: **fix before moving to REFACTOR.**

This is systematic — every frontend task gets a visual check at GREEN, not just at review time.

## REACT GRAB UNAVAILABLE FALLBACK

If React Grab MCP is unavailable (connection error, not configured):

- Log a WARNING to the user.
- Proceed without the visual check.
- Mention in the Dev Agent Record that visual verification was deferred to review.

Never block dev on MCP availability — `aped-review`'s Aria persona will catch missed visual issues.

## SUCCESS METRICS

✅ Backend / devops-only stories: this step skipped explicitly.
✅ Frontend stories: dev server confirmed running, root layout inspected.
✅ Visual check protocol established for step 06.

## FAILURE MODES

❌ Assuming `npm` — silently fails on bun/pnpm projects.
❌ Skipping baseline root-layout inspection — first component goes in blind.
❌ Blocking dev on MCP failure — review catches it later.

## NEXT STEP

Load `.aped/aped-dev/steps/step-06-tdd-cycle.md` to run the RED → GREEN → REFACTOR → GATE cycle for each story task.
