<!-- AUTO-GENERATED from workflow.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.


# APED Arch Audit — Surface Deepening Candidates

Audit an existing codebase for **deepening opportunities** — places where shallow modules (interface nearly as complex as the implementation) could be merged into deep ones for higher leverage and locality. The skill body inlines its own LANGUAGE / DEEPENING / INTERFACE-DESIGN vocabulary; multi-doc decomposition is Phase 2 work.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in EVERY message to the user — progress lines, tool preambles, summaries, and questions all included. This overrides your default; never narrate in English when `{communication_language}` is not English.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Critical Rules

- This skill **identifies** candidates and **grills** the user on the most promising ones. It never edits code, never opens a PR, never invokes `aped-dev`.
- The Vocabulary section is non-negotiable. Use `module` / `interface` / `seam` / `adapter` / `leverage` / `locality` exactly. Do NOT drift to `component` / `service` / `API` / `boundary` even if the project's own code uses those words.
- Apply the deletion test honestly. A candidate that "feels" shallow but passes the deletion test (deletion concentrates complexity) is a wrong candidate — drop it from the report.
- Phase 5 (Design It Twice / parallel sub-agents) is opt-in via the grilling loop's `[P]` menu. Never spawn parallel design sub-agents by default — they cost tokens and only pay back when the user is committed to deepening one specific candidate.

### Iron Law

**SURFACE CANDIDATES, NEVER AUTO-REFACTOR.** See [`ETHOS.md` § aped-arch-audit](../ETHOS.md#aped-arch-audit) for full rationale.

### Red Flags

Phrases that mean you are about to violate the Iron Law. If you catch yourself thinking any of these, stop.

| Phrase | Why it's wrong |
|--------|----------------|
| "I can just merge the module right here while we discuss" | The skill produces a report. Merging is a story for `aped-dev`, not this skill. |
| "Let me sketch the deepened interface in the candidate's source file" | No edits to source files. Sketches go in the audit report at `docs/architecture-audit.md`. |
| "This is obviously shallow, skip the deletion test" | The deletion test is the discipline. Shortcutting it ships false positives. |
| "Phase 5 sub-agents would be useful here, let me spawn them" | Phase 5 is opt-in. Default-spawning makes the skill expensive and noisy. |
| "Use `service` since that's what the codebase calls it" | Vocabulary inconsistency is exactly what this skill exists to surface. Use `module`. |

### Rationalizations

| Excuse | Reality |
|--------|---------|
| "Three sub-agents in parallel will save time on Phase 5" | They cost tokens; the user must opt in. Time saved is irrelevant if they didn't ask. |
| "The user wants me to refactor, not just audit" | The user can run `aped-arch-audit` AND `aped-dev` separately. This skill's contract is the audit. |
| "I'll relax the Vocabulary for one suggestion" | One slip leaks into every later suggestion. Hold the line. |
| "I can apply the deletion test mentally without writing it down" | The report needs the reasoning so the user can challenge it. Write it. |

## Disposition vs `aped-arch`

`aped-arch` and `aped-arch-audit` operate at different points and produce different artefacts:

| | `aped-arch` | `aped-arch-audit` |
|---|---|---|
| When | Before code exists, or when a major architectural decision is on the table | After code exists, when the codebase needs leverage / locality cleanup |
| Input | PRD + UX + product brief | The codebase itself + (optional) `architecture.md` + (optional) `project-context.md` |
| Output | `docs/architecture.md` (greenfield arch decisions) | `docs/architecture-audit.md` (ranked deepening candidates) |
| Side-effect | Writes the canonical architecture artefact | Produces a report; mutates nothing else |
| Council | Architecture personas (Winston, Lena, Raj, Nina, Maya) | Optional Phase 5 sub-agents only when the user opts in |

Run `aped-arch` for new architecture decisions. Run `aped-arch-audit` when the architecture exists but feels shallow / hard to test / hard to navigate. Both can co-exist on the same project.

## Vocabulary

Every suggestion this skill makes uses these terms exactly. Inconsistent vocabulary is the first failure mode of architecture conversations — hold the line.

### Terms

- **Module** — anything with an interface and an implementation: a function, class, package, slice. Scale-agnostic. *Avoid* `unit`, `component`, `service`.
- **Interface** — everything a caller must know to use the module correctly: type signature, invariants, ordering constraints, error modes, required configuration, performance characteristics. *Avoid* `API`, `signature` — those are too narrow (type-level surface only).
- **Implementation** — what's inside the module. Distinct from `adapter`: a thing can be a small adapter with a large implementation (a Postgres repo) or a large adapter with a small implementation (an in-memory fake). Reach for `adapter` when the seam is the topic; `implementation` otherwise.
- **Depth** — leverage at the interface. The amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. **Deep** = large behaviour behind a small interface. **Shallow** = interface nearly as complex as the implementation.
- **Seam** *(from Michael Feathers)* — a place where you can alter behaviour without editing in that place. The *location* at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it. *Avoid* `boundary` — overloaded with DDD's bounded context.
- **Adapter** — a concrete thing that satisfies an interface at a seam. Describes role (what slot it fills), not substance (what's inside).
- **Leverage** — what callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.
- **Locality** — what maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.

### Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface.
- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test *past* the interface, the module is probably the wrong shape.
- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it.

### The deletion test (one-line litmus)

> If I deleted this module, would complexity vanish, or would it reappear across N callers? Vanish → it was a pass-through (drop it from the audit). Reappear → it was earning its keep (deepening worth investigating).

### Forbidden synonyms

The skill MUST NOT use these words even if the codebase uses them. Use the term in parentheses instead.

- `component` (use `module`)
- `service` (use `module`)
- `API` (use `interface`)
- `boundary` (use `seam`)
- `signature` alone (use `interface` — signature is one part of it)

## Discovery

Before any inventory work, gather just enough context to ground the audit.

1. **APED architecture artefact.** Read `docs/architecture.md` if it exists — note any pattern decisions the audit must respect. If the candidate would contradict an existing decision, mark it clearly in the report (e.g. _"contradicts architecture.md §2.2 — but worth reopening because…"_) and don't suggest contradicting decisions casually.
2. **Brownfield context.** Read `docs/project-context.md` if it exists — extract the modules and integration points the existing codebase already documents.
3. **Domain glossary (optional).** If the project has a `CONTEXT.md` at the root (not yet an APED convention but compatible), read it. Use those domain terms when describing candidates ("the Order intake module", not "the FooBarHandler"). If absent, use names from the codebase's own folder structure.
4. **Stack signals.** `Read package.json` / `pyproject.toml` / `Cargo.toml` / `go.mod` — note framework conventions (Next.js page router vs app router, NestJS modules, Django apps) so the audit talks in the codebase's idiom.
5. **Argument scope.** If the user passed an argument like `[area]`, restrict Phase 1 inventory to that area. If no argument, propose to scan the highest-leverage areas first (route handlers, data access, service layer) and ask the user to confirm before walking the whole tree.

Present a compact discovery report (adapt to `communication_language`):

> Discovery for `aped-arch-audit`:
> - Architecture artefact: {{path or "none — no upstream architecture decisions to respect"}}
> - Project context: {{path or "none — greenfield audit"}}
> - Stack signals: {{detected framework}}
> - Audit scope: {{argument or "whole tree, will propose start point"}}

⏸ **HALT — confirm the scope before walking the codebase.**

## Out-of-Scope KB Scan

Before producing candidates, check the project's persistent rejection memory at `.aped/.out-of-scope/`. The directory may not exist on pre-4.2 scaffolds — treat the missing directory as an empty KB and skip this section silently.

1. **List entries.** `ls .aped/.out-of-scope/*.md 2>/dev/null` excluding `README.md`. If no entries (or directory missing), skip the rest of this section.

2. **Tokenize the audit scope.** Use the argument and any phrasing the user gave when invoking. Lowercase, strip punctuation, split on whitespace, `-`, and `_`. Drop tokens of ≤2 characters and stop-words (`add`, `fix`, `update`, `the`, `a`, `an`, `to`, `for`, `with`).

3. **Match entries.** For each entry file, tokenize its filename (drop the `.md` extension; strip `-resolved-YYYY-MM-DD` suffix so old decisions still match). An entry matches if any audit token equals any filename token (exact word equality, no substring).

4. **No match → continue silently** to Phase 1.

5. **Match → surface to user.** Show the entry's frontmatter + `## Why this is out of scope` body, then present:

   ```
   ⚠️ Out-of-scope KB match: .aped/.out-of-scope/{matched-file}

   {entry summary}

   [K] Keep refusal — abort this audit, the rejection still holds
   [O] Override — append this audit to the entry's "Prior requests" list, then continue
   [U] Update — the rejection is stale; rename the entry to {concept}-resolved-{today}.md and continue
   ```

   ⏸ **HALT — wait for user choice per match.**

6. **Behaviour by choice:**
   - `[K]` → abort with: `"Concept '{concept}' was declared out of scope on {rejected_at} (reason: {one-line rationale}). Refusing to audit this area. To revisit, re-invoke and pick [U] on the same match."` Exit cleanly.
   - `[O]` → prepend `- {today} — audit ({user_name}): {audit scope}` to the entry's `## Prior requests` list. Continue to Phase 1.
   - `[U]` → rename the file to `{concept}-resolved-{YYYY-MM-DD}.md` and append `## Resolved on {YYYY-MM-DD}\n\n{one-line note from user}`. Continue to Phase 1.

7. **Multi-match.** Adjudicate per entry; any single `[K]` aborts the whole audit.

## Phase 1 — Module Inventory

Walk the codebase organically. Don't follow rigid heuristics — note where you experience friction. Use `Agent` with `subagent_type=Explore` if the area is large; otherwise inline `Glob` + `Read` is fine.

Friction signals to watch for:

- **Pass-through wrappers.** A module whose every method delegates to one underlying call (`getUser` → `db.users.find`).
- **Shallow service / repository layers.** Many small files in one folder, each method in interface mapping 1:1 to an implementation method.
- **Pure functions extracted "for testability"** when the real bugs are in how they're called, not what they compute (no **locality**).
- **Tight coupling that leaks across seams.** Module A imports module B's internal types directly.
- **Dead seams.** A `port` interface that has only one implementation and isn't tested through.
- **Untested or hard-to-test areas.** If a module's interface forces you to test through a database, the seam is in the wrong place.

Output of Phase 1 is a working list (not yet ranked, not yet a report). For each suspect module record: file paths, why you noticed it, which friction signal applies. Keep the list internal — don't surface to the user yet.

## Phase 2 — Deletion Test (deepening candidates)

For each suspect from Phase 1, apply the deletion test honestly:

> If I deleted this module, would complexity vanish, or would it reappear across N callers?

- **Vanishes** → drop the module from the audit. It was a pass-through, not a deepening candidate. Note it in your working list as "rejected by deletion test" so you don't re-evaluate it.
- **Reappears across N callers** → the module was earning its keep, BUT it might still be shallow. Apply the **interface check**: is the interface nearly as complex as the implementation? If yes → keep as a deepening candidate. If no (deep already) → drop.
- **Reappears in fewer than 2 callers** → not earning its keep yet. Note it as "premature seam" and consider whether deepening would actually merge it into its single caller.

Produce a ranked list of survivors. Rank by leverage estimate: how many caller files would benefit from a deepened version + how much each caller's complexity would shrink. Top of the list is the highest-leverage deepening.

For each candidate record:

- **Files** — which files / modules are involved (real paths, no abstraction).
- **Problem** — why the current shape is shallow (one paragraph, in Vocabulary terms).
- **Solution sketch** — plain English description of what would change. NO code. NO interface signatures yet — those come in Phase 4 / 5.
- **Benefits** — explained in **leverage** + **locality** terms; also mention how tests would improve.
- **Risks** — what could go wrong; ADRs or decisions the candidate touches.

## Phase 3 — Dependency Classification

For the top-ranked candidates, classify their dependencies — the category determines how the deepened module is tested and whether a port is justified.

### Categories

1. **In-process** — pure computation, in-memory state, no I/O. Always deepenable; merge the modules and test through the new interface directly. No adapter needed.
2. **Local-substitutable** — dependencies with local test stand-ins (PGLite for Postgres, in-memory filesystem). Deepenable if the stand-in exists. The deepened module is tested with the stand-in running in the test suite. Seam is internal; no port at the module's external interface.
3. **Remote but owned** — your own services across a network boundary (microservices, internal APIs). Define a **port** at the seam. The deep module owns the logic; the transport is injected as an **adapter**. Tests use an in-memory adapter; production uses HTTP / gRPC / queue.
4. **True external** — third-party services (Stripe, Twilio, etc.) you don't control. The deepened module takes the external dependency as an injected port; tests provide a mock adapter.

### Seam discipline

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically production + test). A single-adapter seam is just indirection.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them.

### Testing strategy: replace, don't layer

- Old unit tests on shallow modules become waste once tests at the deepened module's interface exist — propose to delete them.
- Recommend new tests at the deepened module's interface. The interface is the test surface.
- Tests assert on observable outcomes through the interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation.

Annotate each candidate from Phase 2 with its dependency category and the implied testing strategy.

## Phase 4 — Grilling Loop

Present the ranked candidate list to the user and ask: *"Which one would you like to explore?"* Then, for the chosen candidate, drop into a grilling conversation. Walk the design tree:

- The constraints any deepened module would need to satisfy.
- The shape of the deepened interface (in plain English; resist sketching code yet).
- What sits behind the seam and what stays at the call sites.
- Which tests survive and which get rewritten.
- Whether an existing decision in `architecture.md` would be touched.

After enough back-and-forth on one candidate, present the A/P/C menu:

```
Candidate: {{candidate_name}}

Choose:
[A] Accept — record this candidate in the report with the agreed shape
[P] Parallel-design — opt into Phase 5 (Design It Twice / 3 sub-agents in parallel)
[C] Reject — record the candidate as rejected with the user's reason; offer to add to the OOS KB
[Other] Direct edit — type adjustments, redisplay the menu
```

⏸ **HALT — wait for user choice.**

- `[A]` → write the agreed shape into the working report. Loop back to "which one next?".
- `[P]` → proceed to Phase 5 for this candidate. Phase 5 returns a recommendation; write it into the report.
- `[C]` → record rejection + reason. Offer: *"Add this to the OOS KB so future audits don't re-suggest it?"* If yes, draft an entry at `.aped/.out-of-scope/{concept}.md` (don't write it yourself — show the proposed content and ask the user to drop it in). Loop back.
- Direct edit → apply, redisplay menu.

Continue until the user runs out of candidates or says "enough".

## Phase 5 — Design It Twice (opt-in)

Triggered only by `[P]` in Phase 4's menu — never default-spawn. The user has chosen one candidate and wants to explore radical alternatives before locking in a shape.

### Step 1 — Frame the problem space

Write a user-facing explanation:

- The constraints any new interface would need to satisfy (gathered in Phase 4 grilling).
- The dependency category (Phase 3) and what that implies for ports / adapters.
- A rough illustrative code sketch — NOT a proposal. Just a way to make the constraints concrete so the sub-agents have something to push against.

Show this to the user, then proceed to Step 2 immediately. The user reads while sub-agents work in parallel.

### Step 2 — Spawn sub-agents

Spawn 3 (or 4 if the dependency category is `remote but owned`) sub-agents using the `Agent` tool with `subagent_type=Explore`. Each must produce a **radically different** interface for the deepened module. Give each a different design constraint:

- **Agent 1**: *Minimize the interface — aim for 1–3 entry points max. Maximise leverage per entry point.*
- **Agent 2**: *Maximise flexibility — support many use cases and extension points.*
- **Agent 3**: *Optimise for the most common caller — make the default case trivial.*
- **Agent 4** *(only if dependency category is "remote but owned")*: *Design around ports & adapters for cross-seam dependencies.*

Pass each sub-agent: the file paths, coupling details, dependency category from Phase 3, what sits behind the seam, the Vocabulary for terminology consistency.

Each sub-agent outputs:

1. Interface (types, methods, params — plus invariants, ordering, error modes).
2. Usage example showing how callers use it.
3. What the implementation hides behind the seam.
4. Dependency strategy and adapters.
5. Trade-offs — where leverage is high, where it's thin.

### Step 3 — Present and compare

Present designs sequentially so the user can absorb each one, then compare them in prose. Contrast by **depth** (leverage at the interface), **locality** (where change concentrates), and **seam placement**.

After comparing, give your own recommendation: which design you think is strongest and why. If elements from different designs would combine well, propose a hybrid. Be opinionated — the user wants a strong read, not a menu. The recommendation goes into the report alongside the user's `[A]` decision in Phase 4.

## Output

Write the audit report to `docs/architecture-audit.md` (NEVER `architecture.md` — that's `aped-arch`'s artefact). Structure:

```markdown
# Architecture Audit — {{date}}

**Scope:** {{argument or "whole tree"}}
**Auditor:** {{user_name}} (with aped-arch-audit)

## Executive summary

<!-- 2-3 sentences: how many candidates, top recommendation, what's deferred -->

## Vocabulary check

<!-- Note any vocabulary the project's own code uses that conflicts with the
     skill's vocabulary (e.g. project says "service", we say "module").
     This is documentation, not a fix request — the audit doesn't rename. -->

## Candidates

### Candidate 1: {{name}} (accepted | rejected | deferred)

- Files: {{paths}}
- Problem: {{Vocabulary-aware paragraph}}
- Solution sketch: {{plain English}}
- Dependency category: {{1 of 4}}
- Benefits: leverage / locality / testing
- Risks: {{ADR conflicts, etc.}}
- Decision: {{Accept / Reject / Phase 5 hybrid}}
- Phase 5 recommendation: {{only if [P] was picked}}

[... repeat per candidate ...]

## Rejected by deletion test

<!-- One-line each — pass-throughs noticed but dropped. Useful for the next
     auditor so they don't re-suggest. -->

## Suggested OOS KB entries

<!-- For [C] rejects with load-bearing reasons, list the proposed
     .aped/.out-of-scope/{concept}.md entries. -->
```

Update `docs/state.yaml` if applicable: log the audit timestamp under `arch_audits.last_run` so future invocations know when the codebase was last reviewed.

## Handoff

Tell the user:

> *"Audit complete. {{N}} candidates accepted, {{M}} rejected, {{K}} deferred. Report at `docs/architecture-audit.md`. To act on a candidate: invoke `aped-story` with the candidate's name to draft the implementation story; the story will pull the candidate's solution sketch + dependency category from the report."*

**Do NOT auto-chain.** This skill never invokes `aped-story` or `aped-dev` — the user decides which candidates to act on, and in what order.

## Common Issues

- **"The codebase is huge — where do I start?"**: ask the user for an entry point (a folder, a feature, a recent merge). Phase 1 doesn't have to scan everything; it has to scan the highest-friction area the user can name.
- **"All candidates contradict `architecture.md`"**: stop. Either the architecture is stale (offer to flag in the report) or the audit scope is wrong (ask user to narrow). Don't ship an audit that mass-overrides existing decisions silently.
- **"User wants me to pick `[P]` for every candidate"**: refuse politely — Phase 5 is expensive. Recommend `[P]` for the top 1–2 candidates only, and `[A]` for the rest with a one-line rationale.
- **"User picked `[U]` on an OOS KB match but the candidate is still bad"**: `[U]` only marks the rejection stale; it doesn't accept the candidate. Continue the audit normally and surface the candidate for grilling.
- **"My candidate would touch `aped-arch`'s domain"**: that's expected sometimes — `aped-arch-audit` finds shallow modules wherever they are. Mark the candidate clearly and recommend the user run `aped-arch` to revisit the architecture decision before scheduling the deepening.

## Example

User runs `aped-arch-audit "src/auth"`:

1. Discovery: `architecture.md` exists, mentions JWT-based auth; no `project-context.md`. Stack: Node/TypeScript with Vitest. Audit scope: `src/auth/`.
2. OOS KB scan: no match.
3. Phase 1 inventory: noted 4 suspects — `src/auth/jwt.ts` (wrapper around `jsonwebtoken`), `src/auth/session.ts` (delegates to Redis), `src/auth/permissions.ts` (pure functions), `src/auth/middleware.ts` (Express middleware).
4. Phase 2 deletion test:
   - `jwt.ts`: deletion → callers each import `jsonwebtoken` directly. **Pass-through, drop.**
   - `session.ts`: deletion → 6 callers each touch Redis directly. **Earning its keep**, interface is shallow (one method per Redis op). **Candidate.**
   - `permissions.ts`: deletion → callers re-implement permission checks inconsistently. **Earning its keep**, interface is deep already (3 methods, lots of behaviour). **Drop.**
   - `middleware.ts`: deletion → Express middleware can't be deleted, only relocated. **N/A.**
5. Phase 3 dependency: `session.ts` is "local-substitutable" (PGLite-style stand-in possible for Redis via ioredis-mock).
6. Phase 4 grilling on `session.ts`: user wants to explore. We discuss the deepened interface (one `Session` module that owns CRUD + expiry + refresh, instead of 6 thin Redis wrappers). User picks `[P]` Phase 5.
7. Phase 5: 3 sub-agents in parallel produce minimal / flexible / common-case-optimised designs. Recommendation: minimal interface (`getOrCreate`, `revoke`, `extend`) with internal seams for testability.
8. Output: `docs/architecture-audit.md` lists `session.ts` as the single accepted candidate with the Phase 5 hybrid recommendation; `jwt.ts` and `permissions.ts` listed in "Rejected by deletion test".
9. Handoff: *"Audit complete. 1 candidate accepted (`Session` module deepening). Report at `docs/architecture-audit.md`. Invoke `aped-story` with 'Session module deepening' to draft the implementation story."*

## Next Step

Tell the user: *"Audit shipped to `docs/architecture-audit.md`. Invoke `aped-story` per accepted candidate, when ready. `aped-arch-audit` does not auto-chain."*

**Do NOT auto-chain.** The user decides when to proceed.
