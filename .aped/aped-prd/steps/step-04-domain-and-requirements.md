---
step: 4
reads:
  - ".aped/aped-prd/references/fr-rules.md"
writes:
  - "docs/prd.md"
  - "subagent/raj"
  - "subagent/eva"
  - "subagent/marcus"
mutates_state: false
---

# Step 4: Section 3 (Domain — conditional) + Section 4 (FRs + NFRs)

## MANDATORY EXECUTION RULES (READ FIRST):

- ✋ HALT for the A/P/C menu after each section in interactive mode
- 🛑 EVERY FR matches `FR#: [Actor] can [capability]`
- 🛑 EVERY NFR has a measurable threshold (no bare *"fast"*, *"scalable"*, *"secure"*)
- 🚫 No placeholders — Iron Law applies

## YOUR TASK

Generate Section 3 (Domain Requirements — only if domain-complexity flagged medium/high) and Section 4 (Functional + Non-Functional Requirements). Present A/P/C menu after each.

## SECTION 3: DOMAIN REQUIREMENTS (CONDITIONAL)

- Only include if domain-complexity detection (step 01) flagged medium/high.
- Include mandatory compliance, regulations, certifications from `key_concerns`.
- Skip this section entirely for low-complexity/general domains.

⏸ **Interactive (when included): present + A/P/C menu. Headless: continue.**

## SECTION 4: REQUIREMENTS

### Functional Requirements (target 10–80 FRs)

- **Format:** `FR#: [Actor] can [capability] [context/constraint]`
- Group by capability area.
- Read `.aped/aped-prd/references/fr-rules.md` to validate quality.

### Non-Functional Requirements (relevant categories only)

- **Format:** `The system shall [metric] [condition] [measurement method]`
- Categories: performance, scalability, security, reliability, accessibility, observability.
- Every NFR has a threshold (e.g. `< 200ms p95`, `99.9% uptime`).
- Canonical example: `NFR-1: The system shall respond to inventory queries within 200ms at p95.`

⏸ **Interactive: present + A/P/C menu. Headless: continue.**

## A/P/C MENU (Section 3 / Section 4 specifics)

After Section 3 (Domain): the focused sub-team is **Raj (Compliance)** auditing regulatory coverage.

After Section 4 (Requirements): the focused sub-team is **Eva (QA)** + **Marcus (Staff Eng)** pressure-testing FRs (testability + ambiguity + edge cases).

```
Section {N} of 4 — {section name} draft complete.
[A] aped-elicit (socratic / pre-mortem / red team / shark tank)
[P] Council — see above per-section roster
[C] Continue
[Other] Direct feedback
```

⏸ **HALT — wait. Never auto-pick `[C]`.**

## SUCCESS METRICS

✅ Section 3 included iff domain-complexity flagged medium/high.
✅ Every FR matches `FR#: [Actor] can [capability]`.
✅ Every NFR has a measurable threshold with units.
✅ FR count between 10 and 80.
✅ A/P/C menu offered after each section.

## FAILURE MODES

❌ Vague NFRs (*"the system shall be fast"*) — fails oracle-prd.sh's NFR check.
❌ FRs without `[Actor] can` — breaks `aped-epics`'s FR coverage matrix.
❌ Skipping Section 3 for healthcare/fintech — compliance gaps land in production.

## NEXT STEP

Load `.aped/aped-prd/steps/step-05-validate-and-spec-review.md`.
