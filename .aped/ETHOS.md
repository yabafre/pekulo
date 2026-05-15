# APED ETHOS — The Iron Laws

This file is the canonical home of APED's Iron Laws. Each skill that has an Iron Law cites this file by section anchor. The skill body keeps the heading and the citation; the verdict and rationale live here only.

**Why hoist?** Before 6.5.0, Iron Laws were duplicated across 13+ skill files. Editing one risked drift. Centralizing them makes the discipline auditable in one place, gives a reader the full APED stance in a single document, and lets a lint (`tests/ethos-citation-lint.test.js`) catch any silent skew.

**Scaffolded.** This file ships into every APED-scaffolded project at `<apedDir>/ETHOS.md`, sibling to the skill directories. Relative citation paths (`../ETHOS.md#...`) resolve both in the source repo and in scaffolded projects.

**What an Iron Law is.** A non-negotiable directive at the start of a skill. Shape: an all-caps verdict in one sentence, then 1-3 sentences of justification. The verdict is the rule; the justification is why the rule exists so an agent can apply it to edge cases without re-asking. Not all skills have one — only skills where a specific failure mode is so common that pre-empting it changes the output.

---

## The Iron Laws

### aped-arch-audit

**SURFACE CANDIDATES, NEVER AUTO-REFACTOR.** The skill's job is identification + grilling. Implementation belongs to the user's downstream choice — typically a story drafted via `aped-story` and built via `aped-dev`. Never write code in this skill, never modify the modules under audit, never open files outside the report path.

### aped-debug

**THE FEEDBACK LOOP IS THE SKILL.** Everything else is mechanical. If you have a fast, deterministic, agent-runnable pass/fail signal for the bug, you will find the cause — bisection, hypothesis-testing, and instrumentation all just consume that signal. Spend disproportionate effort on step 03.

### aped-design-twice

1. **Two designs minimum.** One design is a decision. Two designs is a choice. Never skip Design B.
2. **Design B must be structurally different.** Not "same thing with a different name" — different trade-off axis (e.g. Design A optimises for read speed, Design B for write simplicity).
3. **Decision is explicit.** The user picks. The agent does not default to Design A.

### aped-discuss-epic

1. **Decisions are concrete, not aspirational.** Each bullet names a path, type, shape, error class, or invariant — never a goal ("we will be consistent", "errors will be handled properly"). If a story re-reading this can pick a different answer, the decision isn't concrete.
2. **SPIDR walks all five axes.** Spike, Paths, Interfaces, Data, Rules. An empty axis is `N/A — <reason>`, never omitted. The discipline matters because the absence of a decision is itself a decision — make it explicit.
3. **Runs BEFORE `aped-story` for the target epic.** If stories of the epic are already in flight, decisions retro-fitted here drift from what was actually built. Lock decisions first; write stories second.

### aped-dev

**NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.** Code written before its test must be deleted, not adapted — sunk cost is the strongest force pulling toward "tests after". Watching the test fail is irreplaceable: if you didn't see RED, you don't know the test exercises the right path.

### aped-glossary

**ONE WORD, ONE MEANING, ONE PLACE.** If two skills use different words for the same thing, the glossary picks the winner and lists the loser as `_Avoid:_`. Drift compounds; clarity is cheap to sustain, expensive to retrofit.

### aped-iterate

**Classify FIRST, route SECOND.** Never skip the classification interview, even when the delta description seems to point at one specific skill. The user came here because they weren't sure — guessing past the question is exactly the failure mode this skill exists to prevent.

### aped-prd

**NO PRD SHIPPED WITH PLACEHOLDERS.** FR sections must contain real `FR#: [Actor] can [capability]` lines (no FR-less FR section); Goals / Non-goals / NFRs / Success Metrics must contain real prose, not `TBD`, `TODO`, `<placeholder>`, lone ellipses, or `to be defined`. Placeholders fail the lint and block the user gate.

### aped-pre-mortem

1. **The project has failed.** This is not a question — it's the premise. Start from failure, not from "what might go wrong."
2. **Every risk must have a mitigation or an explicit acceptance.** "We'll deal with it" is not a mitigation.
3. **Pre-mortem runs BEFORE implementation, not during.** If you're already coding, use `aped-checkpoint` instead.

### aped-receive-review

**NO PERFORMATIVE AGREEMENT — TECHNICAL VERIFICATION FIRST.** "You're absolutely right!" / "Great point!" / "Let me implement that now" before checking the codebase is the failure mode this skill exists to prevent. The reviewer wants their finding addressed, not their ego stroked. Verify the claim, restate the technical requirement, then either acknowledge factually ("Fixed in `src/auth/jwt.ts:42`") or push back with evidence (the command you ran + its output).

### aped-review

**NO PASS WITHOUT FRESH EVIDENCE IN THIS MESSAGE.** *"Should work"*, *"looks good"*, *"probably fine"*, *"tests should pass"* are not evidence — they are the words of a reviewer who didn't run the verification. Re-run, capture the output, paste it.

The `aped-review` step-05 finalize also enforces a procedural Iron Laws sub-list — those are step-local mechanics (update remote BEFORE local state, Review Record lives in the story file, never merge here, never target the base branch in PR creation). They stay inline at point-of-use in `step-05-finalize.md` rather than being hoisted, because they describe step-specific procedure rather than skill-wide discipline.

### aped-skills-writing-discipline

**Short, sharp, slightly human. The diff proves the work — prose adds the *why*, never re-narrates the *what*.** If a sentence repeats what the diff already shows, it's noise. If a section feels like it's there to *prove* the work happened, cut it.

### aped-story

**NO STORY WITHOUT EXACT FILE PATHS, FULL CODE BLOCKS, EXACT TEST COMMANDS.** The persona reading this story is the *enthusiastic junior with poor taste*. If the story leaves room for interpretation, that junior will pick the wrong path. Verbosity in the story is cheaper by an order of magnitude than ambiguity in the implementation.

### aped-triage

1. **Evidence before classification.** Never assign priority/severity until Steps 1-3 complete. "This feels like a P1" is a hallucination — cite the evidence.
2. **Out-of-scope is a destination, not a waste bin.** Items routed to `.out-of-scope/` get a full triage record so they can be reconsidered later without re-investigation.
3. **Scope verification precedes priority.** An issue outside the current sprint/epic scope is OUT regardless of severity. Check scope FIRST.
