---
step: 4
reads:
  - "docs/epic-{N}-context.md"
  - "docs/prd.md"
  - "docs/architecture.md"
  - "docs/ux/**"
  - "docs/project-context.md"
writes:
  - "docs/epic-{N}-context.md"
mutates_state: false
---

# Step 4: Epic Context Cache + Story Context Gathering

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 The cache is reused across stories of the same epic — never recompile if fresh
- 📖 The cache is the input to every TDD cycle's grounding
- 🚫 Do not invent FR/NFR IDs — every test traces back to a real one (verified in step 06)

## CONTEXT BOUNDARIES

- Pre-implementation checklist passed.
- Story is `in-progress`.
- Story tasks tracked.

## YOUR TASK

Compile (or load) the epic-context cache. Run two parallel agents to gather story-specific context. Classify the story (single-layer / fullstack).

## EPIC CONTEXT CACHE

**Cache path:** `docs/epic-{N}-context.md` (where `N` = epic number from story key — e.g. `1-2-jwt` → epic `1` → cache at `docs/epic-1-context.md`).

### If cache exists and is fresh

- Read it — skip compilation.
- A cache is "fresh" if no stories in this epic have been completed since the cache was written.
- Check: compare cache file mtime with the latest story completion timestamp in `state.yaml`.

### If cache is missing or stale

Launch an Agent to compile the epic context:

- `subagent_type: "Explore"`
- `run_in_background: false` (need the result before proceeding)

The agent reads and compiles into a single `epic-{N}-context.md`:

1. **PRD excerpts** — FRs mapped to this epic (from `docs/prd.md`).
2. **Architecture decisions** — relevant patterns and conventions (from `docs/architecture.md` if exists).
3. **UX references** — screens and components for this epic (from `docs/ux/` if exists).
4. **Project context** — existing-system constraints and conventions (from `docs/project-context.md` if exists — brownfield only).
5. **Lessons** — entries from `docs/lessons.md` with `Scope: aped-dev` or `Scope: all` (rules to enforce during implementation; missing on the first epic of a project).
6. **Completed stories** — implementation details and decisions from already-done stories in this epic (from `docs/stories/`).
7. **Key code patterns** — scan the codebase for established patterns relevant to this epic.

Write the compiled context to `docs/epic-{N}-context.md`.

This compilation runs **once per epic** and is reused across all stories in the epic.

## STORY CONTEXT GATHERING

With epic context loaded, launch **2 Agent tool calls in parallel** for story-specific context:

### Agent 1: Code Context

- `subagent_type: "Explore"`
- Read story Dev Notes for architecture, file paths, dependencies.
- Read existing code files mentioned in story.
- Map the current state of files to modify.

### Agent 2: Library Docs (if dependencies listed)

- `subagent_type: "general-purpose"`
- Use MCP context7 (`resolve-library-id` then `query-docs`) for libraries in Dev Notes.
- Extract relevant API patterns and usage examples.

## STORY CLASSIFICATION

Analyze the story's File List to determine the implementation mode.

Detect:

- **backend files** — server code (apps/api, services/, packages/*/src, .py/.go/.rs/.java, business logic).
- **frontend files** — `.tsx`/`.jsx`/`.vue`/`.svelte`, apps/web, src/pages, src/components.
- **devops files** — `.github/workflows`, Dockerfile, terraform, k8s, cdk.

### Single-layer mode (default)

If the story touches ONE layer only: you (main Claude) implement directly. No team spawning. Continue to step 05.

### Fullstack team mode

If the story touches 2+ layers (backend + frontend is the typical case): spawn a **dev team** to align on the contract and implement in parallel.

```
TeamCreate(name: "dev-{story-key}")
```

Spawn 3 team members (in parallel, same message):

**api-designer** — **Kenji**, API Architect, contract-first — *"The contract is law."*
- Goes FIRST (others wait for the contract).
- Reads the story, relevant FRs from PRD, `architecture.md` for conventions.
- Writes the contract: types, endpoints/procedures, validation schemas, error codes.
- Commits to the shared `packages/contract` (or whatever the project's monorepo declares).
- Posts contract summary in team: *"Contract ready at {path}"*.

**backend-dev** — **Amelia**, Senior Backend Engineer — *"Tests first, always."*
- Waits for Kenji's contract, then starts TDD on backend.
- Implements endpoints/handlers against the contract.
- If contract needs adjustment: `SendMessage(kenji)` to negotiate; kenji updates contract; Amelia rebases.
- Follows the full TDD cycle (RED → GREEN → REFACTOR → GATE).

**frontend-dev** — **Leo**, Senior Frontend Engineer — *"The user never waits in silence."*
- Waits for Kenji's contract, then starts TDD on frontend.
- Implements UI against the contract.
- Uses React Grab at each GREEN.
- If UX needs backend support: `SendMessage(kenji)` to request.
- Follows the full TDD cycle.

### Team rules

1. **Kenji first** — backend and frontend block until contract is ready.
2. **Contract changes are negotiations** — no teammate modifies the contract unilaterally. Always propose via `SendMessage(kenji)`, kenji decides.
3. **Divergence detection** — if backend and frontend end up with conflicting assumptions, the team halts and escalates to the Lead (you).
4. **Shared tests** — contract-level integration tests live where both can reference them.

### When all teammates are done

- Lead (you) verifies all team GATEs passed.
- Lead merges the work, runs full test suite (including integration tests).
- Lead handles the completion workflow (git, ticket).
- Lead calls `TeamDelete(name: "dev-{story-key}")` to release the team threads.

## SUCCESS METRICS

✅ Epic-context cache loaded fresh or recompiled.
✅ 2 parallel agents returned (or skipped because no deps listed).
✅ Story classified single-layer / fullstack.
✅ Fullstack mode: team spawned with Kenji blocking.

## FAILURE MODES

❌ Recompiling cache when fresh — wastes tokens.
❌ Story classification skipped — fullstack stories implemented as single-layer cause backend/frontend divergence.
❌ Skipping `TeamDelete` — threads linger until session end.

## NEXT STEP

Load `.aped/aped-dev/steps/step-05-frontend-detection.md` to set up the visual dev loop if frontend, otherwise proceed to step 06.
