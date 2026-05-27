---
name: aped-glossary
keep-coding-instructions: true
description: 'Use when user says "build glossary", "update glossary", "domain dictionary", "shared language", "sharpen language", "canonicalize terms", "glossary check", or invokes aped-glossary. Builds and maintains a project-wide domain glossary at docs/aped/glossary.md so every APED skill, persona, and downstream artefact uses the same vocabulary. Acts as the project-wide CONTEXT.md analog. Not for divergent ideation (use aped-brainstorm), not for stress-testing decisions (use aped-grill).'
allowed-tools: "Read Edit Write Glob Grep"
allowed-paths:
  write: ["docs/**", ".aped/**"]
  read-only: ["src/**", "tests/**", "package.json"]
disable-model-invocation: true
license: MIT
metadata:
  author: yabafre
  version: 6.12.5
---
<!-- AUTO-GENERATED from SKILL.md.tmpl. Edits will be overwritten. Run: npm run gen:skill-docs -->

**Activation guard (6.2.0):** Before any other action, run `bash .aped/scripts/check-enabled.sh`. If it exits non-zero, print "APED disabled — run aped-method enable" and HALT.

# APED Glossary — Project-wide Domain Dictionary

Build and maintain `docs/glossary.md` — the canonical place where every domain term used across PRD, architecture, stories, and code is defined once. Eliminates the "different word, same concept" drift that costs every team tokens and clarity.

## On Activation

Read `.aped/config.yaml` and resolve `{user_name}` / `{communication_language}` / `{document_output_language}`. ✅ YOU MUST speak in `{communication_language}` and write `glossary.md` in `{document_output_language}`. HALT if config is missing.

## Critical Rules

- 🛑 The glossary is **append + revise**, never **rewrite**. Existing entries stay unless the user explicitly retires them.
- 🛑 Each term has **exactly one canonical name**. Synonyms are listed under `_Avoid:_` so future skills can flag drift.
- ✋ HALT before any write — the user confirms each new entry or revision.
- 🚫 Do NOT invent terms. Every entry must come from an upstream artefact (PRD, architecture, stories) or from the user's most recent message.
- 🔍 When a term conflicts with an existing entry, surface the conflict immediately — don't silently overwrite.

## Iron Law

**ONE WORD, ONE MEANING, ONE PLACE.** See [`ETHOS.md` § aped-glossary](../ETHOS.md#aped-glossary) for full rationale.

## Inputs (consumed in this order)

1. The user's most recent message (the trigger / topic).
2. `.aped/config.yaml` (loaded above).
3. Existing glossary at `docs/glossary.md` — if present, treat as authoritative starting point.
4. Upstream APED artefacts that exist:
   - `docs/prd.md` — most term-rich source (FRs, NFRs, user roles).
   - `docs/architecture.md` — technical concepts.
   - `docs/ux/**` — UI / interaction terms.
   - `docs/product-brief.md` — business / market terms.
   - `docs/project-context.md` (brownfield) — existing-system terms.
   - `docs/stories/*.md` — story-specific vocabulary that may have drifted.
5. Any `CONTEXT.md` at the project root — domain context file, treat as authoritative if present.

If none of the upstream artefacts exist, ask the user what corpus to glossarise against and HALT until they answer.

## Workflow

### 1. Discover

Glob `docs/**`. Load every artefact found. Read existing `glossary.md` if it exists. Report to the user:

```
Glossary discovery
─────────────────
Existing glossary: {N entries | none}
Upstream sources: {prd.md, architecture.md, stories/STK-1.md, ...}
```

### 2. Extract candidate terms

Scan the loaded sources for terms that:

- Appear ≥ 2 times across distinct artefacts (signal: load-bearing).
- Are domain-specific (not common English).
- Have alternative spellings, capitalisations, or near-synonyms in the corpus (signal: drift candidate).

Cross-reference against the existing glossary. Bucket the candidates:

- **NEW** — not in glossary, used in corpus.
- **DRIFT** — in glossary under name X, but corpus uses Y at least once.
- **STALE** — in glossary, no longer used in corpus.

Present the buckets to the user with counts. **HALT** for `[A]ll | [N]ew only | [D]rift only | [P]ick` selection.

### 3. Per-term loop

For each selected candidate, ask ONE question at a time. Pattern:

> **Term:** {candidate}
> **Found in:** {list of files with line numbers}
> **Proposed canonical name:** {your suggestion, often the most-used variant}
> **Proposed definition:** {1 sentence based on usage in the corpus}
> **Avoid:** {alternative spellings/synonyms found}
>
> Confirm canonical name? `[K]eep proposed | [E]dit | [S]kip this term | [A]bandon glossary session`

Wait for the user's answer. Record their choice. Move to the next term.

For DRIFT entries, additionally ask: *"The new usage [Y] differs from the glossary's [X]. Update the glossary to use [Y], retire [X] to Avoid, or keep [X] and flag [Y] as misuse?"*

For STALE entries, ask: *"This term hasn't been used in the corpus since {date}. Retire it (move to `## Retired`) or keep it as future-reserved?"*

### 4. Write

Once the user has walked the candidate list (or stopped early with `[A]bandon`), write `docs/glossary.md` using the format below. Append + revise the existing file; never rewrite from scratch.

⏸ **GATE:** Show the diff (or full file if new). User confirms write.

### 5. Cross-skill notification

After write, list the skills that consume the glossary at runtime:

- `aped-prd` — uses glossary terms in FR/NFR phrasing.
- `aped-arch` — uses glossary terms in decision rationales.
- `aped-story` — uses glossary terms in story titles + ACs.
- `aped-review` (Eva) — flags drift in reviewed code/tests against the glossary.
- `aped-grill` — references glossary for term-precision questions.

Report: *"Glossary now has N entries. Run `aped-prd`/`aped-story`/etc. to see updated discipline downstream."*

## Output format

```markdown
# {{project_name}} — Domain Glossary

> Maintained by `aped-glossary`. Every APED skill reads this file at entry; every dev/review session validates against it.
> Last updated: {ISO date}

## Active

### {Canonical Term}

{1-2 sentences: what it is, what it isn't, in the project's idiom.}

_Avoid:_ {alternative-spelling}, {near-synonym}, {wrong-but-common-paraphrase}

_First seen:_ {file:line where it was canonicalised}

---

### {Next term}

...

## Retired

### {Term that used to mean X but is no longer used}

{Why it was retired and what replaced it.}
```

## Integration with other skills

Skills that consume the glossary should fail loudly when an `_Avoid:_` form appears in their input. The simplest enforcement is a grep-based check at skill entry:

```bash
yq -r '."Avoid"[]' docs/glossary.md | while read avoid; do
  if grep -q "$avoid" "$ARTEFACT_PATH"; then
    echo "GLOSSARY DRIFT: avoid form '$avoid' appeared in $ARTEFACT_PATH"
  fi
done
```

This is advisory in v6.0; structural enforcement (a hook that blocks edits introducing avoid forms) is future work.

## Output (final)

When the session closes (user confirms write or abandons), summarise in one paragraph:

> *"Glossary updated: N new entries, M revised, K retired. The next `aped-{prd, arch, story, review}` runs will use the new vocabulary."*

If the session was abandoned mid-walk: *"Glossary unchanged. Resume with `aped-glossary` whenever ready."*

## What this skill is NOT

- ❌ Not a brainstorm — terms come from the corpus, not divergent ideation. Use `aped-brainstorm` for that.
- ❌ Not a critique — glossary doesn't judge whether the project's vocabulary is *good*, only that it's *consistent*. Use `aped-grill` for adversarial term-precision.
- ❌ Not a code refactor tool — the glossary may say *the canonical name is X* but won't rename `var Y` in your code. Pair with `aped-iterate` if a glossary update demands a rename.
