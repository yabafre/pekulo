---
name: aped-write-skill
keep-coding-instructions: true
description: 'Use when user says "write a skill", "create a skill", "new APED skill", "extend APED with my own skill", "make a custom skill", "add a custom slash command", "scaffold a skill", or invokes aped-write-skill. Meta-skill: walks the user through writing a Claude Code skill that follows APED conventions. Not for routing-time invocation discipline — see aped-claude for that.'
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
license: MIT
metadata:
  author: yabafre
  version: 6.12.3
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Write Skill — Meta-Skill for Writing APED-Style Skills

Walk the user through writing a new Claude Code skill that follows APED conventions: description-routed invocation, fresh-read discipline, FR/NFR grounding, explicit ⏸ gates, no auto-chain, optional sub-agent dispatch.

## On Activation

Before any other action, read `.aped/config.yaml` and resolve:
- `{user_name}` — for greeting and direct address
- `{communication_language}` — for ALL conversation with the user
- `{document_output_language}` — for artefacts written under `docs/`
- `{ticket_system}` / `{git_provider}` — routing for ticket / PR I/O (skip if `none`)

✅ YOU MUST speak `{communication_language}` in every message to the user.
✅ YOU MUST write artefact content in `{document_output_language}`.
✅ If `.aped/config.yaml` is missing or unreadable, HALT and tell the user to run `npx aped-method`.

## Critical Rules

- The skill produces a single drop-in artefact. Do NOT modify the upstream APED package itself — that's a contribution PR, not a custom skill.
- Description is the routing surface. A vague description means the skill never fires (or fires when it should not). Spend the time on it.
- Cross-references in the body MUST use the fully-qualified `aped-X` form (never bare "the X skill") — APED's lint test enforces this on every commit.

## Setup

1. Read 2-3 existing APED skill bodies (`.aped/aped-checkpoint/SKILL.md`, `.aped/aped-iterate/SKILL.md`, `.aped/aped-debug/SKILL.md`) — APED voice and structure.
2. Read `.aped/skills/SKILL-INDEX.md` — confirm the slug you pick is not already taken.

## Step 1: Scope Discovery

Ask the user, one question at a time:

1. **What does the skill DO?** — one sentence, verb-first (e.g. "Surface API contract drift between two branches").
2. **WHEN does it fire?** — 2-5 concrete trigger phrases the user would say (e.g. "compare API contracts", "check for breaking changes").
3. **What it does NOT do?** — anti-triggers (collisions with existing skills). Pick at least one ("not for hotfixes — see aped-quick", "not for unit tests — see aped-dev").
4. **Single-file or multi-doc?** — guide:
   - Body ≤ 200 lines + no large reference material → single-file (`aped-X.md`).
   - Body > 200 lines OR ships templates / checklists / vocabulary → multi-doc with companions (`aped-X/SKILL.md` + companions). 4.4.0+ engine.
5. **Rigid or flexible discipline?** — rigid skills (TDD, debug, review) carry the four-stack (Iron Law / Red Flags / Rationalizations / Critical Rules). Flexible skills carry one short Critical Rules block. Most user-authored skills should be flexible.

⏸ **GATE: Confirm scope answers before drafting frontmatter.**

## Step 2: Frontmatter

Draft:

```yaml
---
name: aped-{slug}
keep-coding-instructions: true
description: 'Use when user says "trigger phrase 1", "trigger phrase 2", or invokes aped-{slug}. Anti-trigger / scope qualifier / negative case.'
license: MIT
metadata:
  author: {user_name}
  version: 1.0.0
---
```

Description requirements (APED's lint tests enforce these):
- Wrapped in **single quotes** (avoids the unquoted-`: ` silent-skip footgun where YAML parses the value as a nested mapping and the skill silently fails to register).
- ≤ 1024 characters.
- Includes 2+ trigger phrases the user would actually say.
- Includes ≥1 anti-trigger pointing at the adjacent skill that handles the contrasting case.

⏸ **GATE: User validates frontmatter.**

## Step 3: Body Drafting

Body sections in order (skip what doesn't apply):

1. **Title + tagline** — what the skill does, in one sentence.
2. **Critical Rules** (always) — 3-5 bullets the agent must respect.
3. **Iron Law** (rigid only) — one bold sentence the agent cannot violate.
4. **Red Flags** (rigid only) — table of forbidden thoughts → why they're rationalizations.
5. **Setup** — read config, state, references.
6. **Input Discovery** (producer skills only) — glob locations, ✱-required artefacts, HALT message on missing required input.
7. **Steps / Phases** — the actual procedure.
8. **Self-review** — checklist run before output.
9. **Output** — what gets written, where.
10. **Common Issues** — known footguns + fixes.

Each step:
- Names the agent's action explicitly ("Read X", "Ask the user Y", "Write Z").
- Cites concrete file paths using `.aped` / `docs` placeholders. **Always insert an explicit slash** between the placeholder and the next path segment — `.aped/aped-X/SKILL.md`. The placeholder substitutes raw to the configured directory name (default `.aped`, no trailing slash), so a missing slash collapses two segments into one broken path; APED's `tests/scaffold-references.test.js` blocks any such occurrence in CI (the 4.2.1 substitution-bug class).
- Includes ⏸ gates where user input is required.

## Step 4: Multi-doc Decomposition (optional)

If the skill is multi-doc (chosen in Step 1), decide which content lives in `SKILL.md` (the routed body) vs companions:

- `SKILL.md` — Critical Rules, Iron Law, Setup, Input Discovery, Step entry-points, references to companions. Target ≤ 200 lines.
- `process.md` — detailed procedural steps (the bulk of the body).
- `references/<topic>.md` — vocabulary, templates, checklists, examples.
- `scripts/<name>.sh` — executable helpers (rare; usually unnecessary for user-authored skills).

Reference companions from `SKILL.md` with explicit `Read` instructions:

> Read `.aped/aped-{slug}/process.md` for the full procedure.

## Step 5: Self-review

Walk this checklist before showing the draft to the user. Each `[ ]` must flip to `[x]` or HALT.

- [ ] **Description is single-quoted**, ≤ 1024 chars, includes 2+ triggers + ≥1 anti-trigger.
- [ ] **Cross-references use fully-qualified `aped-X` form** — no bare "the X skill" / "invoke X".
- [ ] **Slash after `.aped`** — every path uses the explicit slash form `.aped/aped-X/...`. The 4.2.1 substitution-bug class shipped 25 broken Read references before it was caught; APED's `tests/scaffold-references.test.js` now blocks any new occurrence in CI.
- [ ] **No leftover slash-command echoes** (4.0.0 contract: description-routed, no `.claude/commands/aped-*.md` stubs).
- [ ] **Fresh-read discipline declared** (for skills consuming PRD / story / architecture in production).
- [ ] **FR/NFR grounding declared** (for skills producing code or design decisions).
- [ ] **No auto-chain** — skill ends with "Run aped-X when ready" or equivalent, never auto-invokes another.
- [ ] **Slug uniqueness** — `aped-{slug}` does not collide with an existing skill in `.aped/skills/SKILL-INDEX.md`.

## Step 6: Output

Write the skill to one of:

- **Project-local** — `.aped/skills/aped-{slug}.md` (single-file) or `.aped/skills/aped-{slug}/SKILL.md` plus companions (multi-doc). Add an entry to `.aped/skills/SKILL-INDEX.md` so discovery stays consistent.
- **User-global** — `~/.claude/skills/aped-{slug}.md` (single-file) or `~/.claude/skills/aped-{slug}/SKILL.md`. The skill is then available across all your Claude Code projects.

## No State Change

This is a meta-skill. It does not advance APED phase state and does not modify `state.yaml`.

## Next Step

Tell the user: "Skill drafted at `<path>`. Test it by invoking with a natural-language phrase that matches your description. Iterate on the body until the skill consistently fires when you want and stays silent when you don't. Re-run `aped-write-skill` if the description needs tightening."
