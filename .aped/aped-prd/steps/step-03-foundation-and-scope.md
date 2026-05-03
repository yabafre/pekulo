---
step: 3
reads:
  - ".aped/templates/prd.md"
  - "docs/product-brief.md"
writes:
  - "docs/prd.md"
  - "subagent/mary"
  - "subagent/derek"
  - "subagent/pm"
mutates_state: false
---

# Step 3: Section 1 (Foundation) + Section 2 (Scope & Journeys)

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the A/P/C menu after each section in interactive mode
- 🛑 NEVER auto-pick `[C]`
- 🚫 No placeholders — Iron Law applies

## YOUR TASK

Generate Section 1 (Foundation) and Section 2 (Scope & Journeys) using `.aped/templates/prd.md` as structure. After each section, present the A/P/C menu (interactive mode) or continue (headless).

## SECTION 1: FOUNDATION

- Executive Summary from brief's Core Vision.
- Product vision and purpose statement.

⏸ **Interactive: present + A/P/C menu. Headless: continue.**

## SECTION 2: SCOPE & JOURNEYS

- **Success Criteria** — User / Business / Technical / Measurable Outcomes.
- **Product Scope** — MVP / Growth / Vision phases.
- **Out of Scope** — explicit list of capabilities considered and decided NOT to do, one-line why each. Required — prevents scope creep in epics/arch downstream.
   - Cross-PRD recurring exclusions (reused product strategy, recurring partner asks) can be promoted to `.aped/.out-of-scope/<concept>.md`.
- **User Journeys** — key end-to-end workflows.

⏸ **Interactive: present + A/P/C menu. Headless: continue.**

## A/P/C MENU PATTERN (interactive only)

After **each** section is drafted:

```
Section {N} of 4 — {section name} draft complete.

Choose your next move:
[A] Advanced elicitation — invoke aped-elicit on this section to stress-test
    (socratic / pre-mortem / red team / first principles / shark tank, etc.)
[P] Party / Council — invoke a focused sub-team to challenge this section:
      • Section 1 (Foundation): Mary (Market) + Derek (Domain) cross-check vision
      • Section 2 (Scope): a Product Manager persona pushes back on MVP boundary
[C] Continue — accept this section, move to the next
[Other] Direct feedback — type your changes; I'll apply them and redisplay this menu
```

⏸ **HALT — wait for user choice. Never auto-pick `[C]`.** In `--headless` mode, skip the menu and treat every section as `[C]` Continue automatically.

### Behaviour by choice

- `[A]` → invoke `aped-elicit` with the current section as target. When elicit returns enhanced content, ask: *"Apply these changes? (y/n/other)"*. On `y`: replace the section. Then redisplay the same A/P/C menu.
- `[P]` → dispatch the section-specific sub-team via the `Agent` tool, in parallel. Each subagent reviews the section through its persona's lens and returns 2–4 findings. Merge findings, present as *"Council says: …"*, ask: *"Apply any of these? (numbers / all / none)"*. Integrate; redisplay.
- `[C]` → mark the task `completed` and move to the next section.
- Direct feedback → apply edits to the section, redisplay.

## SUCCESS METRICS

✅ Sections 1 + 2 drafted with no placeholders.
✅ A/P/C menu offered after each section in interactive mode.
✅ User confirmed `[C]` before advancing.

## NEXT STEP

Load `.aped/aped-prd/steps/step-04-domain-and-requirements.md`.
